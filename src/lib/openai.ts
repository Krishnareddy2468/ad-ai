import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Fallback models — only models that exist on the current API
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

export function getModel(modelName?: string) {
  return genAI.getGenerativeModel({ model: modelName || MODEL });
}

/**
 * Generate content with automatic model fallback on 503/429 errors.
 * Tries the primary model first, then falls back to alternatives.
 */
export async function generateWithFallback(
  request: GenerateContentRequest,
  primaryModel?: string
) {
  const modelsToTry = [primaryModel || MODEL, ...FALLBACK_MODELS.filter(m => m !== (primaryModel || MODEL))];
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(request);
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        console.warn(`[Gemini] ${modelName} returned empty response, trying next model...`);
        if (i < modelsToTry.length - 1) continue;
      }
      if (i > 0) console.log(`[Gemini] Succeeded with fallback model: ${modelName}`);
      return result;
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.httpStatusCode || 0;
      const isRetryable = status === 503 || status === 429 || error?.message?.includes('503') || error?.message?.includes('429');

      console.error(`[Gemini] ${modelName} failed: ${status} ${error?.message?.substring(0, 150)}`);

      if (isRetryable && i < modelsToTry.length - 1) {
        console.log(`[Gemini] Trying fallback: ${modelsToTry[i + 1]}`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      // For non-retryable errors (404, 400, etc.), skip to next model
      if (i < modelsToTry.length - 1) {
        console.log(`[Gemini] Trying fallback: ${modelsToTry[i + 1]}`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      throw error;
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

/**
 * Safely parse JSON from LLM output, handling truncated or malformed responses.
 */
export function safeParseJSON<T>(raw: string, fallback: T): T {
  // Strip markdown code fences and trim
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Find the actual JSON content (look for first { or [)
  const jsonStart = Math.min(
    cleaned.indexOf('{') >= 0 ? cleaned.indexOf('{') : Infinity,
    cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : Infinity
  );
  if (jsonStart > 0 && jsonStart < Infinity) {
    cleaned = cleaned.substring(jsonStart);
  }

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt progressively more aggressive fixes
  }

  // Fix 1: Remove trailing commas before } or ]
  let fixed = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Fix 2: Close unclosed strings
  const quoteCount = (fixed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) fixed += '"';

  // Fix 3: Close unclosed arrays/objects
  const opens = (fixed.match(/[{[]/g) || []).length;
  const closes = (fixed.match(/[}\]]/g) || []).length;
  if (opens > closes) {
    // Build the closing brackets in reverse order
    const stack: string[] = [];
    for (const ch of fixed) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    fixed += stack.reverse().join('');
  }

  try {
    return JSON.parse(fixed) as T;
  } catch {
    // Fix 4: Try to extract up to last complete object in an array
    const lastCompleteObj = fixed.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      const truncated = fixed.substring(0, lastCompleteObj + 1);
      // Close remaining brackets
      const stack2: string[] = [];
      for (const ch of truncated) {
        if (ch === '{') stack2.push('}');
        else if (ch === '[') stack2.push(']');
        else if (ch === '}' || ch === ']') stack2.pop();
      }
      try {
        return JSON.parse(truncated + stack2.reverse().join('')) as T;
      } catch {
        // Give up
      }
    }
    
    console.warn('[safeParseJSON] All parse attempts failed. Raw:', cleaned.substring(0, 300));
    return fallback;
  }
}

export default genAI;
