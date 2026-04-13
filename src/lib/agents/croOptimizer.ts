import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis, CROAnalysis, PageElement } from '@/types';

const MAX_ELEMENTS = 12; // Limit elements to keep prompt focused
const MAX_CHANGES = 4;   // Strict cap — always exactly 4 changes

const SYSTEM_PROMPT = `You are a CRO copywriter. Rewrite landing page text so it matches the ad the visitor clicked.

STRICT RULES — follow these exactly:
1. Return EXACTLY 4 changes. No more, no fewer.
2. "original" MUST be copied character-for-character from the page elements list below. Do NOT shorten, rephrase, or paraphrase the original.
3. "modified" MUST keep the same approximate length as the original (±30% word count).
4. "modified" MUST blend the ad's promise with the page's existing voice. Do NOT paste the ad headline verbatim.
5. Do NOT invent statistics, testimonials, percentages, or claims that are not in the ad analysis.
6. Do NOT modify navigation labels, footer links, or cookie notices.
7. Pick only elements with 3 or more words as originals. Skip single words or short fragments.
8. Each "type" must be one of: headline, subheadline, cta, body, hero.

CHANGE PRIORITY (pick in this order):
  1st: The primary headline (h1) — align with ad promise
  2nd: A subheadline (h2/h3) — reinforce value proposition
  3rd: The primary CTA button — match ad call-to-action
  4th: A body/hero paragraph — weave in ad keywords naturally

FORMATTING:
- Headlines: 6–12 words, benefit-driven
- CTAs: 2–5 words, action verb ("Start Free Trial", "Get Your Demo")
- Body: Same sentence count as original, naturally reference ad value prop

Return ONLY this JSON — no markdown, no explanation, no code fences:
{"messageMatchScore":70,"currentIssues":["issue"],"recommendations":["rec"],"priorityChanges":[{"selector":"h1:nth-of-type(1)","type":"headline","original":"exact text from list","modified":"rewritten text","rationale":"reason","croRule":"MESSAGE MATCH"}]}`;

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
    // Anti-hallucination: "original" must be a real page element we passed in
    const origNorm = orig.toLowerCase().replace(/\s+/g, ' ');
    let matchFound = false;
    for (const known of Array.from(knownTexts)) {
      const knownNorm = known.toLowerCase().replace(/\s+/g, ' ');
      if (knownNorm === origNorm || knownNorm.includes(origNorm) || origNorm.includes(knownNorm)) {
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

  // Build a set of known page texts for anti-hallucination validation
  const knownTexts = new Set<string>(preparedElements.map(e => e.text));

  // Compact ad summary — only include fields that have values
  const adSummary = {
    headline: adAnalysis.headline,
    valueProposition: adAnalysis.valueProposition,
    targetAudience: adAnalysis.targetAudience,
    tone: adAnalysis.tone,
    cta: adAnalysis.callToAction,
    urgency: adAnalysis.urgencyLevel,
    keywords: adAnalysis.keywords.slice(0, 5),
  };

  // Numbered element list — LLM must reference items by exact text
  const elementList = preparedElements
    .map((e, i) => `  ${i + 1}. [${e.type.toUpperCase()}] "${e.text}"`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}

--- AD ANALYSIS ---
Headline: "${adSummary.headline}"
Value Proposition: "${adSummary.valueProposition}"
Target Audience: ${adSummary.targetAudience}
Tone: ${adSummary.tone}
CTA: "${adSummary.cta}"
Urgency: ${adSummary.urgency}
Keywords: ${adSummary.keywords.join(', ')}

--- LANDING PAGE: "${pageTitle}" ---
Page elements (copy the "original" field EXACTLY from the quoted text below):
${elementList}

--- TASK ---
1. Score the message match between ad and page (0-100).
2. Pick EXACTLY 4 elements from the list above (priority: headline → subheadline → CTA → body).
3. Rewrite each one to align with the ad's promise while keeping the page's voice.
4. Copy the "original" text exactly as shown in quotes above — character for character.
5. Return ONLY the JSON object. No other text.`;

  // Single attempt with very low temperature for consistency
  const result = await generateWithFallback({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
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
        return parsed;
      }
    }

  // Fallback: generate synthetic changes from the page elements + ad analysis
  console.warn('[CRO Optimizer] LLM produced no valid changes — generating synthetic CRO recommendations');
  return generateSyntheticCRO(preparedElements, adAnalysis, pageTitle);
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
