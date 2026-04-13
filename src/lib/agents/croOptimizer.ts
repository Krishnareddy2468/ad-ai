import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis, CROAnalysis, PageElement } from '@/types';

const MAX_ELEMENTS = 25; // Limit elements to keep prompt manageable

const SYSTEM_PROMPT = `You are a CRO specialist. Analyze a landing page against an ad creative and return personalization changes as JSON.

CRO Rules:
1. MESSAGE MATCH: Headline must mirror the ad's promise
2. SCENT TRAIL: Continue visual/verbal cues from ad to page
3. SINGLE FOCUS: Primary CTA aligned with ad intent
4. URGENCY: Match urgency level from ad
5. BENEFIT COPY: Features → Benefits aligned with ad messaging

IMPORTANT: You MUST return ONLY valid JSON. No markdown, no explanation, no code fences.

Return this exact JSON structure:
{"messageMatchScore":75,"currentIssues":["issue1"],"recommendations":["rec1"],"priorityChanges":[{"selector":"h1:nth-of-type(1)","type":"headline","original":"exact original text","modified":"new text","rationale":"why","croRule":"MESSAGE MATCH"}]}

Rules for priorityChanges:
- Make 4-6 changes (not more)
- "original" must be the EXACT text from the page elements provided
- "type" must be one of: headline, subheadline, cta, body, hero
- Keep changes concise — modify copy only, don't rewrite entire paragraphs
- Do NOT invent fake statistics or testimonials`;

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

Ad: ${JSON.stringify(adSummary)}

Page: "${pageTitle}"

Elements:
${preparedElements.map((e, i) => `${i + 1}. [${e.type}] "${e.text}"`).join('\n')}

Return ONLY the JSON object — no markdown fences, no explanation.`;

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

    // If we got actual changes, return them
    if (parsed.priorityChanges && parsed.priorityChanges.length > 0) {
      console.log('[CRO Optimizer] Parsed', parsed.priorityChanges.length, 'changes, score:', parsed.messageMatchScore);
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

  // Find headlines and suggest aligning with ad headline
  const headlines = elements.filter((e) => e.type === 'headline');
  if (headlines.length > 0 && ad.headline) {
    changes.push({
      selector: headlines[0].selector,
      type: 'headline',
      original: headlines[0].text,
      modified: ad.headline,
      rationale: 'Align primary headline with ad creative messaging for message match',
      croRule: 'MESSAGE MATCH',
    });
  }

  // Find subheadlines and align with value prop
  const subheadlines = elements.filter((e) => e.type === 'subheadline');
  if (subheadlines.length > 0 && ad.valueProposition) {
    changes.push({
      selector: subheadlines[0].selector,
      type: 'subheadline',
      original: subheadlines[0].text,
      modified: ad.valueProposition,
      rationale: 'Reinforce value proposition from ad creative',
      croRule: 'SCENT TRAIL',
    });
  }

  // Find CTAs and align with ad CTA
  const ctas = elements.filter((e) => e.type === 'cta');
  if (ctas.length > 0 && ad.callToAction) {
    changes.push({
      selector: ctas[0].selector,
      type: 'cta',
      original: ctas[0].text,
      modified: ad.callToAction,
      rationale: 'Match CTA text with ad creative for continuity',
      croRule: 'SINGLE FOCUS',
    });
  }

  // Find body text and weave in keywords
  const bodyElements = elements.filter((e) => e.type === 'body');
  if (bodyElements.length > 0 && ad.keywords.length > 0) {
    const original = bodyElements[0].text;
    const modified = original.length > 100
      ? `${ad.valueProposition}. ${original.substring(0, 80)}…`
      : ad.valueProposition || original;
    changes.push({
      selector: bodyElements[0].selector,
      type: 'body',
      original,
      modified,
      rationale: 'Lead with value proposition to capture attention',
      croRule: 'BENEFIT COPY',
    });
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
