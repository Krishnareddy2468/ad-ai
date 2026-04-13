import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis, CROAnalysis, PageElement } from '@/types';
import crypto from 'crypto';

const MAX_ELEMENTS = 15;
const MAX_CHANGES = 6;

// In-memory cache: same ad + same page → identical CRO output
const croCache = new Map<string, CROAnalysis>();

/**
 * SYSTEM prompt — acts as a fixed "persona" that never changes.
 * Uses structured-output anchoring + algorithmic rules to force
 * the same answer every time for the same input.
 */
const SYSTEM_PROMPT = `You are a deterministic CRO copy-rewriting function.
You receive a numbered list of page elements and an ad analysis.
You output a fixed JSON object with exactly 6 rewritten elements.

## SELECTION ALGORITHM (follow this exact order — no skipping):
Step 1: Select the FIRST element whose type is HEADLINE.
Step 2: Select the FIRST element whose type is SUBHEADLINE.
Step 3: Select the FIRST element whose type is CTA.
Step 4: Select the FIRST element whose type is HERO or BODY.
Step 5: Select the SECOND element whose type is SUBHEADLINE (or next BODY if none).
Step 6: Select the SECOND element whose type is CTA (or next BODY if none).
If fewer than 6 distinct elements exist, return as many as available.
Never select the same element twice.

## REWRITING RULES:
R1. "original" = copy the element text CHARACTER-FOR-CHARACTER from the numbered list. Do not change a single letter.
R2. "modified" = rewrite to blend the ad's promise with the page's voice.
R3. Keep modified within ±30% word count of original.
R4. Do NOT paste the ad headline verbatim.
R5. Do NOT invent statistics, testimonials, or claims absent from the ad.
R6. Headlines → 6-12 words, benefit-driven.
R7. CTAs → 2-5 words, action verb (e.g. "Start Free Trial").
R8. Body → same sentence count, naturally weave in ad value prop.

## OUTPUT FORMAT (return ONLY this JSON, nothing else):
{"messageMatchScore":<0-100>,"currentIssues":["..."],"recommendations":["..."],"priorityChanges":[{"selector":"<from list>","type":"<headline|subheadline|cta|body|hero>","original":"<exact text>","modified":"<rewrite>","rationale":"<1 sentence>","croRule":"<MESSAGE MATCH|SCENT TRAIL|SINGLE FOCUS|BENEFIT COPY|URGENCY>"}]}`;

/**
 * FEW-SHOT EXAMPLE — anchors the model to a fixed output pattern.
 * Same example every time → model mimics the structure exactly.
 */
const FEW_SHOT_EXAMPLE = {
  user: `--- AD ANALYSIS ---
Headline: "Run Faster With CloudFoam Shoes"
Value Proposition: "Ultra-lightweight running shoes with CloudFoam cushioning"
Target Audience: Runners and fitness enthusiasts
Tone: Energetic, motivational
CTA: "Shop CloudFoam Now"
Urgency: medium
Keywords: running, shoes, CloudFoam, lightweight, cushioning

--- LANDING PAGE: "SportGear Pro" ---
Page elements:
  1. [HEADLINE] "Welcome to SportGear Pro"
  2. [SUBHEADLINE] "The best gear for every athlete"
  3. [CTA] "Shop Now"
  4. [HERO] "We carry thousands of products from top brands to fuel your passion for sports."
  5. [SUBHEADLINE] "Trusted by athletes worldwide"
  6. [CTA] "Browse Collection"
  7. [BODY] "Free shipping on orders over $50. Easy returns within 30 days."`,
  assistant: `{"messageMatchScore":45,"currentIssues":["Primary headline is generic and does not reference CloudFoam or running","CTA does not match ad call-to-action","Body copy does not mention lightweight cushioning"],"recommendations":["Align headline with CloudFoam running shoes promise","Match CTA to ad creative","Weave cushioning benefit into body copy"],"priorityChanges":[{"selector":"h1:nth-of-type(1)","type":"headline","original":"Welcome to SportGear Pro","modified":"Run Lighter, Run Faster — Discover CloudFoam Cushioning","rationale":"Aligns headline with ad promise of lightweight CloudFoam running shoes","croRule":"MESSAGE MATCH"},{"selector":"h2:nth-of-type(1)","type":"subheadline","original":"The best gear for every athlete","modified":"The Running Gear Engineered for Speed and Comfort","rationale":"Narrows focus from generic athletes to runners matching ad audience","croRule":"SCENT TRAIL"},{"selector":"cta-0","type":"cta","original":"Shop Now","modified":"Shop CloudFoam Now","rationale":"Mirrors ad CTA for consistent scent trail","croRule":"SINGLE FOCUS"},{"selector":"hero-p-0","type":"hero","original":"We carry thousands of products from top brands to fuel your passion for sports.","modified":"Ultra-lightweight CloudFoam cushioning meets elite performance — built for runners who demand more.","rationale":"Replaces generic pitch with ad-specific value proposition","croRule":"BENEFIT COPY"},{"selector":"h2:nth-of-type(2)","type":"subheadline","original":"Trusted by athletes worldwide","modified":"Trusted by Runners Who Choose CloudFoam","rationale":"Reinforces target audience alignment with ad","croRule":"SCENT TRAIL"},{"selector":"cta-1","type":"cta","original":"Browse Collection","modified":"Explore CloudFoam Shoes","rationale":"Secondary CTA maintains consistent product focus","croRule":"SINGLE FOCUS"}]}`
};

/**
 * Prepare elements for the prompt — limit count, shorten long texts, 
 * prioritize high-impact elements (headlines, CTAs).
 */
function prepareElements(
  elements: { type: string; selector: string; text: string }[]
): { type: string; selector: string; text: string }[] {
  // Prioritize: headlines first, then CTAs, then body
  const priority: Record<string, number> = {
    headline: 0,
    subheadline: 1,
    cta: 2,
    hero: 3,
    body: 4,
    meta: 5,
  };

  const sorted = [...elements].sort(
    (a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99)
  );

  return sorted.slice(0, MAX_ELEMENTS).map((el) => ({
    ...el,
    text: el.text.length > 200 ? el.text.substring(0, 200) + '…' : el.text,
  }));
}

/**
 * Hard-cap and validate changes from LLM output.
 * Enforces: no fragments, no hallucinated originals, no duplicates.
 */
function capChanges(
  changes: PageElement[],
  knownTexts: Set<string>
): PageElement[] {
  const filtered = changes.filter(c => {
    const orig = c.original.trim();
    // Skip fragments: must have ≥3 words and ≥15 chars
    if (orig.split(/\s+/).length < 3) return false;
    if (orig.length < 15) return false;
    // Skip no-ops
    if (orig.toLowerCase() === c.modified.trim().toLowerCase()) return false;
    // Anti-hallucination: "original" must closely match a real page element
    const origNorm = orig.toLowerCase().replace(/\s+/g, ' ');
    const origCollapsed = origNorm.replace(/\s/g, '');
    let matchFound = false;
    for (const known of Array.from(knownTexts)) {
      const knownNorm = known.toLowerCase().replace(/\s+/g, ' ');
      const knownCollapsed = knownNorm.replace(/\s/g, '');
      // Exact, substring, or collapsed match (handles spacing differences)
      if (
        knownNorm === origNorm ||
        knownCollapsed === origCollapsed ||
        knownNorm.includes(origNorm) ||
        origNorm.includes(knownNorm) ||
        knownCollapsed.includes(origCollapsed) ||
        origCollapsed.includes(knownCollapsed)
      ) {
        matchFound = true;
        break;
      }
    }
    if (!matchFound) return false;
    return true;
  });
  // Deduplicate by original text
  const seen = new Set<string>();
  const deduped = filtered.filter(c => {
    const key = c.original.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.slice(0, MAX_CHANGES);
}

export async function analyzeCRO(
  pageElements: { type: string; selector: string; text: string }[],
  adAnalysis: AdAnalysis,
  pageTitle: string
): Promise<CROAnalysis> {
  const preparedElements = prepareElements(pageElements);

  // Deterministic cache key: hash of (ad headline + page title + element texts)
  const cacheInput = JSON.stringify({
    h: adAnalysis.headline,
    v: adAnalysis.valueProposition,
    t: pageTitle,
    e: preparedElements.map(e => e.text),
  });
  const cacheKey = crypto.createHash('md5').update(cacheInput).digest('hex');
  
  if (croCache.has(cacheKey)) {
    console.log('[CRO Optimizer] Cache hit — returning identical analysis');
    return croCache.get(cacheKey)!;
  }

  // Build a set of known page texts for anti-hallucination validation
  const knownTexts = new Set<string>(preparedElements.map(e => e.text));

  // Compact ad summary
  const adSummary = {
    headline: adAnalysis.headline,
    valueProposition: adAnalysis.valueProposition,
    targetAudience: adAnalysis.targetAudience,
    tone: adAnalysis.tone,
    cta: adAnalysis.callToAction,
    urgency: adAnalysis.urgencyLevel,
    keywords: adAnalysis.keywords.slice(0, 5),
  };

  // Numbered element list with types — deterministic ordering
  const elementList = preparedElements
    .map((e, i) => `  ${i + 1}. [${e.type.toUpperCase()}] "${e.text}"`)
    .join('\n');

  // User message for the REAL task (follows the few-shot pattern exactly)
  const userMessage = `--- AD ANALYSIS ---
Headline: "${adSummary.headline}"
Value Proposition: "${adSummary.valueProposition}"
Target Audience: ${adSummary.targetAudience}
Tone: ${adSummary.tone}
CTA: "${adSummary.cta}"
Urgency: ${adSummary.urgency}
Keywords: ${adSummary.keywords.join(', ')}

--- LANDING PAGE: "${pageTitle}" ---
Page elements:
${elementList}`;

  // Multi-turn: system → few-shot example → real request
  // Few-shot anchoring forces the model to follow the EXACT same pattern
  const result = await generateWithFallback({
    systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      // Few-shot: example input
      { role: 'user', parts: [{ text: FEW_SHOT_EXAMPLE.user }] },
      // Few-shot: example output (model learns the pattern)
      { role: 'model', parts: [{ text: FEW_SHOT_EXAMPLE.assistant }] },
      // Real request
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature: 0,          // Fully deterministic — greedy decoding
      topP: 1,                 // No nucleus sampling
      topK: 1,                 // Pick the single most likely token every time
      maxOutputTokens: 4096,
    },
  });

    const content = result.response.text() || '{}';
    console.log(`[CRO Optimizer] Response length: ${content.length} chars`);

    const fallback: CROAnalysis = {
      messageMatchScore: 50,
      currentIssues: ['Analysis incomplete — LLM returned truncated response'],
      recommendations: ['Re-run analysis for complete results'],
      priorityChanges: [],
    };

    const parsed = safeParseJSON<CROAnalysis>(content, fallback);

    // Validate and cap changes using known page texts
    if (parsed.priorityChanges && parsed.priorityChanges.length > 0) {
      parsed.priorityChanges = capChanges(parsed.priorityChanges, knownTexts);
      console.log('[CRO Optimizer] Validated', parsed.priorityChanges.length, 'changes, score:', parsed.messageMatchScore);
      if (parsed.priorityChanges.length > 0) {
        croCache.set(cacheKey, parsed);
        return parsed;
      }
    }

  // Fallback: generate synthetic changes from the page elements + ad analysis
  console.warn('[CRO Optimizer] LLM produced no valid changes — generating synthetic CRO recommendations');
  const synthetic = generateSyntheticCRO(preparedElements, adAnalysis, pageTitle);
  croCache.set(cacheKey, synthetic);
  return synthetic;
}

/**
 * Fallback: Generate CRO changes locally when the LLM fails.
 * Uses simple heuristics to align page text with ad messaging.
 */
function generateSyntheticCRO(
  elements: { type: string; selector: string; text: string }[],
  ad: AdAnalysis,
  pageTitle: string
): CROAnalysis {
  const changes: PageElement[] = [];

  // Find headlines and craft a professional replacement
  const headlines = elements.filter((e) => e.type === 'headline');
  if (headlines.length > 0 && ad.headline) {
    // Craft a headline that blends ad promise with page context
    const headline = ad.valueProposition
      ? `${ad.headline} — ${ad.valueProposition}`
      : ad.headline;
    // Keep it punchy: max 15 words
    const words = headline.split(/\s+/);
    const modified = words.length > 15 ? words.slice(0, 15).join(' ') : headline;
    changes.push({
      selector: headlines[0].selector,
      type: 'headline',
      original: headlines[0].text,
      modified,
      rationale: 'Primary headline aligned with ad creative promise for immediate message match',
      croRule: 'MESSAGE MATCH',
    });
  }

  // Find subheadlines and write benefit-driven copy
  const subheadlines = elements.filter((e) => e.type === 'subheadline');
  if (subheadlines.length > 0 && ad.valueProposition) {
    const audience = ad.targetAudience || 'you';
    const modified = `Built for ${audience.toLowerCase()} — ${ad.valueProposition.toLowerCase()}.`;
    changes.push({
      selector: subheadlines[0].selector,
      type: 'subheadline',
      original: subheadlines[0].text,
      modified: modified.charAt(0).toUpperCase() + modified.slice(1),
      rationale: 'Subheadline reinforces value proposition and speaks directly to the target audience',
      croRule: 'SCENT TRAIL',
    });
  }

  // Find CTAs and make them specific and action-driven
  const ctas = elements.filter((e) => e.type === 'cta');
  if (ctas.length > 0 && ad.callToAction) {
    // Make CTA more action-oriented if the ad's CTA is generic
    let ctaText = ad.callToAction;
    const genericCTAs = ['learn more', 'click here', 'submit', 'sign up', 'get started'];
    if (genericCTAs.some(g => ctaText.toLowerCase().includes(g)) && ad.valueProposition) {
      // Generate a more specific CTA
      if (ad.urgencyLevel === 'high') {
        ctaText = `Get ${ad.valueProposition.split(' ').slice(0, 3).join(' ')} Now`;
      } else {
        ctaText = `Start Your ${ad.valueProposition.split(' ').slice(0, 2).join(' ')} Today`;
      }
    }
    changes.push({
      selector: ctas[0].selector,
      type: 'cta',
      original: ctas[0].text,
      modified: ctaText,
      rationale: 'CTA matches ad creative intent with clear action verb',
      croRule: 'SINGLE FOCUS',
    });
  }

  // Find hero/body text and weave in ad messaging naturally
  const heroElements = elements.filter((e) => e.type === 'hero');
  const bodyElements = elements.filter((e) => e.type === 'body');
  const textEl = heroElements[0] || bodyElements[0];
  if (textEl && ad.keywords.length > 0) {
    const topKeywords = ad.keywords.slice(0, 3).join(', ');
    const benefit = ad.valueProposition || ad.headline || '';
    const modified = benefit
      ? `Discover how ${topKeywords} can help you ${benefit.toLowerCase()}. Join thousands who have already made the switch.`
      : textEl.text;
    changes.push({
      selector: textEl.selector,
      type: textEl.type as 'body' | 'hero',
      original: textEl.text,
      modified,
      rationale: 'Supporting copy reinforces ad keywords and value proposition',
      croRule: 'BENEFIT COPY',
    });
  }

  // Add urgency if the ad has high urgency
  if (ad.urgencyLevel === 'high' && bodyElements.length > 1) {
    const el = bodyElements[1] || bodyElements[0];
    if (el && !changes.some(c => c.original === el.text)) {
      changes.push({
        selector: el.selector,
        type: 'body',
        original: el.text,
        modified: `Don't miss out — ${ad.valueProposition || ad.headline}. Limited availability.`,
        rationale: 'Urgency messaging mirrors the ad creative tone',
        croRule: 'URGENCY',
      });
    }
  }

  const score = changes.length > 0 ? Math.min(65, 30 + changes.length * 10) : 30;

  return {
    messageMatchScore: score,
    currentIssues: [
      'Page messaging does not reflect ad creative',
      'CTA text differs from ad call-to-action',
      changes.length < 3 ? 'Limited actionable elements found on page' : 'Multiple elements need alignment',
    ].filter(Boolean),
    recommendations: [
      'Align headline with ad promise',
      'Match CTA language to ad creative',
      'Reinforce value proposition in supporting copy',
    ],
    priorityChanges: changes,
  };
}
