import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis } from '@/types';
import crypto from 'crypto';

// In-memory cache: same image → same analysis (eliminates LLM variance)
const analysisCache = new Map<string, AdAnalysis>();

const SYSTEM_PROMPT = `You are an expert ad creative analyst and CRO specialist. Analyze the provided ad creative image/content and extract key marketing elements. Be precise and actionable.

Return a JSON object with exactly these fields:
{
  "headline": "The primary headline/message of the ad",
  "subheadline": "Secondary message or supporting text",
  "valueProposition": "Core value proposition being communicated",
  "targetAudience": "Who this ad is targeting",
  "tone": "The overall tone (e.g., professional, casual, urgent, aspirational)",
  "keywords": ["key", "brand", "words"],
  "callToAction": "The CTA used in the ad",
  "emotionalTriggers": ["trigger1", "trigger2"],
  "colorScheme": ["#hex1", "#hex2", "#hex3"],
  "urgencyLevel": "low|medium|high",
  "brandVoice": "Description of the brand voice/personality"
}

Only respond with valid JSON, no markdown or explanation.`;

export async function analyzeAdCreative(input: {
  imageBase64?: string;
  imageUrl?: string;
}): Promise<AdAnalysis> {
  // Cache key: hash of the image content for deterministic lookup
  const cacheInput = input.imageBase64 || input.imageUrl || '';
  const cacheKey = crypto.createHash('md5').update(cacheInput).digest('hex');
  
  if (analysisCache.has(cacheKey)) {
    console.log('[Ad Analyzer] Cache hit — returning identical analysis');
    return analysisCache.get(cacheKey)!;
  }

  const parts: any[] = [
    { text: SYSTEM_PROMPT + '\n\nAnalyze this ad creative and extract all marketing elements:' },
  ];

  if (input.imageBase64) {
    // Extract mime type and data from base64 data URI
    const match = input.imageBase64.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: { mimeType: match[1], data: match[2] },
      });
    }
  } else if (input.imageUrl) {
    // Fetch the image and convert to inline data for Gemini
    try {
      const res = await fetch(input.imageUrl);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = res.headers.get('content-type') || 'image/jpeg';
      parts.push({
        inlineData: { mimeType, data: base64 },
      });
    } catch {
      parts.push({ text: `[Image URL: ${input.imageUrl}]` });
    }
  }

  const result = await generateWithFallback({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 1,
      maxOutputTokens: 1500,
    },
  });

  const content = result.response.text() || '{}';
  console.log('[Ad Analyzer] Gemini response length:', content.length, 'chars');
  const fallback: AdAnalysis = {
    headline: 'Ad Creative',
    subheadline: '',
    valueProposition: 'See ad for details',
    targetAudience: 'General audience',
    tone: 'professional',
    keywords: ['ad'],
    callToAction: 'Learn More',
    emotionalTriggers: [],
    colorScheme: [],
    urgencyLevel: 'medium',
    brandVoice: 'Professional',
  };
  const parsed = safeParseJSON<AdAnalysis>(content, fallback);
  if (parsed.headline === 'Ad Creative' && parsed.valueProposition === 'See ad for details') {
    console.warn('[Ad Analyzer] Using fallback values — Gemini output could not be parsed:', content.substring(0, 200));
  }
  
  // Cache for deterministic repeat calls
  analysisCache.set(cacheKey, parsed);
  console.log('[Ad Analyzer] Cached analysis for future identical requests');
  
  return parsed;
}
