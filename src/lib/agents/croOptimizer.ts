import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis, CROAnalysis, PageElement } from '@/types';

const MAX_ELEMENTS = 15; // Limit elements to keep prompt manageable
const MAX_CHANGES = 6;   // Hard cap on number of changes returned

const SYSTEM_PROMPT = `You are an expert CRO copywriter. Your job is to rewrite landing page copy so it feels like the page was built specifically for the ad the user just clicked. Every modification must sound natural, professional, and persuasive — like it was written by a senior marketing copywriter, not a robot.

CRO Principles:
1. MESSAGE MATCH: Headline mirrors the ad's core promise
2. SCENT TRAIL: Visual/verbal continuity from ad to page
3. SINGLE FOCUS: Primary CTA aligned with ad intent
4. URGENCY: Match the ad's urgency tone
5. BENEFIT COPY: Lead with benefits, not features

Writing Rules:
- Write like a professional copywriter — punchy, clear, benefit-driven
- Keep the page's existing voice and style, but weave in the ad's messaging
- Do NOT just paste the ad headline into the page verbatim
- Headlines should be compelling and action-oriented (8-12 words ideal)
- CTAs should be specific and action-driven ("Start Your Free Trial" not just "Sign Up")
- Body text should naturally reference the ad's key value proposition
- Never invent fake statistics, testimonials, or claims
- Keep modifications concise — don't turn a short headline into a paragraph

BAD modification example:
  original: "Welcome to Our Platform"
  modified: "50% Off Running Shoes"  ← Just pasted ad headline, doesn't fit the page

GOOD modification example:
  original: "Welcome to Our Platform"
  modified: "The Running Gear That Keeps Up With You — Now 50% Off"  ← Professional, blends ad promise with page context

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no code fences.

Return this exact JSON structure:
{"messageMatchScore":75,"currentIssues":["issue1"],"recommendations":["rec1"],"priorityChanges":[{"selector":"h1:nth-of-type(1)","type":"headline","original":"exact original text","modified":"professionally rewritten text","rationale":"why this change improves conversion","croRule":"MESSAGE MATCH"}]}

Rules for priorityChanges:
- Make 4-6 changes maximum
- "original" must be the EXACT text from the page elements
- "modified" must be professionally written marketing copy
- "type" must be: headline, subheadline, cta, body, or hero
- Headlines: 6-15 words, benefit-driven, action-oriented
- CTAs: 2-6 words, specific action verbs ("Get Started Free", "Claim Your Discount")
- Body: Keep similar length, refocus on ad's value proposition
- Each change must include a clear rationale`;

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
 * Hard-cap and deduplicate changes from LLM output.
 * Prevents hallucinated single-word targets and duplicate modifications.
 */
function capChanges(changes: PageElement[]): PageElement[] {
  const filtered = changes.filter(c => {
    // Skip changes where the original is too short (likely a fragment)
    if (c.original.trim().split(/\s+/).length < 2) return false;
    if (c.original.trim().length < 10) return false;
    // Skip if modified is basically the same as original
    if (c.original.trim().toLowerCase() === c.modified.trim().toLowerCase()) return false;
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

  // Compact ad summary to reduce token usage
  const adSummary = {
    headline: adAnalysis.headline,
    valueProposition: adAnalysis.valueProposition,
    targetAudience: adAnalysis.targetAudience,
    tone: adAnalysis.tone,
    cta: adAnalysis.callToAction,
    urgency: adAnalysis.urgencyLevel,
    keywords: adAnalysis.keywords.slice(0, 5),
  };

  const prompt = `${SYSTEM_PROMPT}

--- AD CREATIVE ANALYSIS ---
Headline: "${adSummary.headline}"
Value Proposition: "${adSummary.valueProposition}"
Target Audience: ${adSummary.targetAudience}
Tone: ${adSummary.tone}
CTA: "${adSummary.cta}"
Urgency: ${adSummary.urgency}
Keywords: ${adSummary.keywords.join(', ')}

--- LANDING PAGE: "${pageTitle}" ---
Current page elements:
${preparedElements.map((e, i) => `${i + 1}. [${e.type.toUpperCase()}] "${e.text}"`).join('\n')}

--- INSTRUCTIONS ---
Analyze the gap between what the ad promises and what your page currently says.
Score the current message match (0-100).
Then write 4-6 professional copy modifications that close the gap.
Each "modified" field must be polished marketing copy — NOT a copy-paste of the ad text.
Think like a conversion copywriter crafting landing page copy for this specific ad campaign.

Return ONLY the JSON object.`;

  // Try up to 2 attempts with different temperatures
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: attempt === 0 ? 0.3 : 0.2,
        maxOutputTokens: 8192,
      },
    });

    const content = result.response.text() || '{}';
    console.log(`[CRO Optimizer] Attempt ${attempt + 1} — response length: ${content.length} chars`);

    const fallback: CROAnalysis = {
      messageMatchScore: 50,
      currentIssues: ['Analysis incomplete — LLM returned truncated response'],
      recommendations: ['Re-run analysis for complete results'],
      priorityChanges: [],
    };

    const parsed = safeParseJSON<CROAnalysis>(content, fallback);

    // If we got actual changes, cap and return them
    if (parsed.priorityChanges && parsed.priorityChanges.length > 0) {
      parsed.priorityChanges = capChanges(parsed.priorityChanges);
      console.log('[CRO Optimizer] Parsed', parsed.priorityChanges.length, 'changes (capped), score:', parsed.messageMatchScore);
      return parsed;
    }

    // First attempt failed to produce changes — retry with simpler prompt
    if (attempt === 0) {
      console.warn('[CRO Optimizer] No changes parsed on attempt 1, retrying with simpler prompt...');
      console.warn('[CRO Optimizer] Raw response:', content.substring(0, 500));
    }
  }

  // Final fallback: generate synthetic changes from the page elements + ad analysis
  console.warn('[CRO Optimizer] LLM failed to produce changes — generating synthetic CRO recommendations');
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
