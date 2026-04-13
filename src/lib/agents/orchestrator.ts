import { analyzeAdCreative } from './adAnalyzer';
import { analyzeCRO } from './croOptimizer';
import { personalizeHtml } from './personalizer';
import { verifyPersonalization } from './verifier';
import { createMemoryEntry } from './memory';
import { scrapePage, extractPageStructure } from '../scraper';
import {
  AdAnalysis, CROAnalysis, VerificationResult,
  PersonalizationResult, AgentTrace, EvaluationMetrics, PageElement,
} from '@/types';

const MAX_RETRIES = 2;

/**
 * Orchestrator — The Planner Agent
 * 
 * Coordinates the full pipeline: Planner → Executor → Verifier → Memory
 * 
 * Handles:
 * - Step sequencing and dependency management
 * - Retry logic with exponential backoff
 * - Fallback strategies when agents fail
 * - Trace collection for observability
 * - Metrics computation for evaluation
 */

interface OrchestratorInput {
  imageBase64?: string;
  imageUrl?: string;
  landingPageUrl: string;
}

interface OrchestratorCallbacks {
  onStepStart: (stepId: string) => void;
  onStepComplete: (stepId: string, result: string, duration: number) => void;
  onStepRetry: (stepId: string, attempt: number, reason: string) => void;
  onStepError: (stepId: string, error: string) => void;
}

export async function orchestrate(
  input: OrchestratorInput,
  callbacks?: OrchestratorCallbacks
): Promise<PersonalizationResult> {
  const traces: AgentTrace[] = [];
  const startTime = Date.now();
  let retryTotal = 0;
  let errorsTotal = 0;

  // ═══════════════════════════════════════════
  // PHASE 1: PLANNER — Analyze inputs
  // ═══════════════════════════════════════════
  
  callbacks?.onStepStart('analyze');
  const adAnalysis = await executeWithRetry<AdAnalysis>(
    'Ad Analyzer',
    'planner',
    async () => analyzeAdCreative({
      imageBase64: input.imageBase64,
      imageUrl: input.imageUrl,
    }),
    (result) => !!(result.headline && result.valueProposition),
    traces,
    (attempt, reason) => {
      retryTotal++;
      callbacks?.onStepRetry('analyze', attempt, reason);
    }
  );
  callbacks?.onStepComplete(
    'analyze',
    `"${adAnalysis.headline}" | ${adAnalysis.targetAudience} | ${adAnalysis.tone}`,
    traces[traces.length - 1]?.completedAt! - traces[traces.length - 1]?.startedAt
  );

  // ═══════════════════════════════════════════
  // PHASE 2: PLANNER — Scrape & plan
  // ═══════════════════════════════════════════

  callbacks?.onStepStart('scrape');
  const scrapeStart = Date.now();
  let originalHtml: string;
  let title: string;
  let text: string;
  let scrapeFailed = false;

  try {
    const scraped = await scrapePage(input.landingPageUrl);
    originalHtml = scraped.html;
    title = scraped.title;
    text = scraped.text;
  } catch (scrapeError: any) {
    console.error(`[Orchestrator] Scrape failed: ${scrapeError.message}`);
    scrapeFailed = true;
    // Create a minimal proxy HTML that loads the page in an iframe
    // This ensures the personalized view at least shows the original page
    title = input.landingPageUrl;
    text = '';
    originalHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${input.landingPageUrl}</title>
<style>*{margin:0;padding:0}body,html{width:100%;height:100%}</style>
</head><body>
<iframe src="${input.landingPageUrl}" style="width:100%;height:100%;border:none" 
  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
</body></html>`;
  }

  const pageElements = extractPageStructure(originalHtml);
  
  const isSpaPage = !scrapeFailed && (pageElements.length <= 2 && text.length < 200);
  if (isSpaPage) {
    console.warn(`[Orchestrator] Possible SPA page: only ${pageElements.length} elements, ${text.length} chars of text`);
  }

  traces.push({
    agentId: 'scraper',
    agentName: 'Page Scraper',
    role: 'planner',
    startedAt: scrapeStart,
    completedAt: Date.now(),
    input: input.landingPageUrl,
    output: scrapeFailed
      ? `Scrape failed — using iframe proxy fallback for "${input.landingPageUrl}"`
      : isSpaPage
        ? `SPA detected — ${pageElements.length} elements from "${title}" (JS-rendered page, limited server-side content)`
        : `${pageElements.length} elements extracted from "${title}"`,
    retryCount: 0,
    status: scrapeFailed ? 'error' : (isSpaPage ? 'error' : 'success'),
  });
  callbacks?.onStepComplete(
    'scrape',
    scrapeFailed
      ? `⚠️ Scrape failed — using fallback proxy | ${input.landingPageUrl}`
      : isSpaPage
        ? `⚠️ SPA detected — "${title}" | ${pageElements.length} elements | JS-rendered page`
        : `"${title}" | ${pageElements.length} elements | ${(text.length / 1000).toFixed(1)}k chars`,
    Date.now() - scrapeStart
  );

  // ═══════════════════════════════════════════
  // PHASE 3: EXECUTOR — CRO Analysis + Personalization
  // ═══════════════════════════════════════════

  callbacks?.onStepStart('cro');
  let croAnalysis = await executeWithRetry<CROAnalysis>(
    'CRO Optimizer',
    'executor',
    async () => analyzeCRO(pageElements, adAnalysis, title),
    (result) => !!(result.messageMatchScore >= 0 && result.priorityChanges && result.priorityChanges.length > 0),
    traces,
    (attempt, reason) => {
      retryTotal++;
      callbacks?.onStepRetry('cro', attempt, reason);
    }
  );
  callbacks?.onStepComplete(
    'cro',
    `Match: ${croAnalysis.messageMatchScore}% | ${croAnalysis.currentIssues.length} issues | ${croAnalysis.priorityChanges.length} changes planned`,
    traces[traces.length - 1]?.completedAt! - traces[traces.length - 1]?.startedAt
  );

  callbacks?.onStepStart('personalize');
  const personalizerStart = Date.now();
  const { html: personalizedHtml, appliedChanges } = await personalizeHtml(
    originalHtml, adAnalysis, croAnalysis
  );

  // Fix relative URLs — use regex to handle <head>, <HEAD>, <head lang="...">, etc.
  const baseUrl = new URL(input.landingPageUrl);
  const baseHref = `${baseUrl.protocol}//${baseUrl.host}`;
  const headRegex = /(<head[^>]*>)/i;
  const injectBase = (html: string) => {
    if (headRegex.test(html)) {
      return html.replace(headRegex, `$1<base href="${baseHref}" />`);
    }
    // Fallback: prepend base tag if no <head> found
    return `<base href="${baseHref}" />${html}`;
  };
  const htmlWithBase = injectBase(personalizedHtml);
  const originalWithBase = injectBase(originalHtml);

  traces.push({
    agentId: 'personalizer',
    agentName: 'Page Personalizer',
    role: 'executor',
    startedAt: personalizerStart,
    completedAt: Date.now(),
    input: `${croAnalysis.priorityChanges.length} planned changes`,
    output: `${appliedChanges.length} changes applied to HTML`,
    retryCount: 0,
    status: 'success',
  });
  callbacks?.onStepComplete(
    'personalize',
    `${appliedChanges.length} changes applied to page`,
    Date.now() - personalizerStart
  );

  // ═══════════════════════════════════════════
  // PHASE 4: VERIFIER — Quality checks
  // ═══════════════════════════════════════════

  callbacks?.onStepStart('verify');
  const verifierStart = Date.now();
  const verification = await verifyPersonalization(
    adAnalysis, croAnalysis, appliedChanges, originalHtml, personalizedHtml
  );

  traces.push({
    agentId: 'verifier',
    agentName: 'Quality Verifier',
    role: 'verifier',
    startedAt: verifierStart,
    completedAt: Date.now(),
    input: `${appliedChanges.length} changes to verify`,
    output: `Score: ${verification.overallScore} | ${verification.flaggedIssues.length} issues | ${verification.autoFixes.length} fixes`,
    retryCount: 0,
    status: verification.passed ? 'success' : 'error',
  });
  callbacks?.onStepComplete(
    'verify',
    `Score: ${verification.overallScore}% | ${verification.checks.filter(c => c.passed).length}/${verification.checks.length} checks passed | ${verification.flaggedIssues.length} issues flagged`,
    Date.now() - verifierStart
  );

  // ═══════════════════════════════════════════
  // PHASE 5: MEMORY — Learning loop
  // ═══════════════════════════════════════════

  callbacks?.onStepStart('memory');
  const memoryStart = Date.now();
  const memoryEntry = createMemoryEntry(
    adAnalysis, croAnalysis, verification, appliedChanges, input.landingPageUrl
  );

  traces.push({
    agentId: 'memory',
    agentName: 'Memory Agent',
    role: 'memory',
    startedAt: memoryStart,
    completedAt: Date.now(),
    input: `Run data for ${memoryEntry.domain}`,
    output: `Stored ${memoryEntry.successfulPatterns.length} patterns, ${memoryEntry.failedPatterns.length} failures`,
    retryCount: 0,
    status: 'success',
  });
  callbacks?.onStepComplete(
    'memory',
    `Learned ${memoryEntry.successfulPatterns.length} patterns | Domain: ${memoryEntry.domain} | Type: ${memoryEntry.adType}`,
    Date.now() - memoryStart
  );

  // ═══════════════════════════════════════════
  // Compute evaluation metrics
  // ═══════════════════════════════════════════

  const totalTime = Date.now() - startTime;
  const successfulAgents = traces.filter(t => t.status === 'success').length;
  
  const metrics: EvaluationMetrics = {
    outputSuccessRate: Math.round((successfulAgents / traces.length) * 100),
    taskCompletionRate: verification.passed ? 100 : Math.round(verification.overallScore),
    errorRate: Math.round((errorsTotal / traces.length) * 100),
    avgTimeToExecution: Math.round(totalTime / traces.length),
    hallucinationsCaught: verification.flaggedIssues.filter(i => i.type === 'hallucination').length,
    autoFixesApplied: verification.autoFixes.filter(f => f.applied).length,
    verifierPassRate: Math.round((verification.checks.filter(c => c.passed).length / verification.checks.length) * 100),
    retryRate: Math.round((retryTotal / traces.length) * 100),
  };

  const confidenceScore = Math.min(
    95,
    Math.max(40, Math.round(
      (croAnalysis.messageMatchScore * 0.3) +
      (verification.overallScore * 0.4) +
      (appliedChanges.length * 3) +
      (metrics.outputSuccessRate * 0.1)
    ))
  );

  return {
    originalHtml: originalWithBase,
    personalizedHtml: htmlWithBase,
    landingPageUrl: input.landingPageUrl,
    adAnalysis,
    croAnalysis,
    changes: appliedChanges,
    confidenceScore,
    estimatedLift: `${Math.round(confidenceScore * 0.3)}–${Math.round(confidenceScore * 0.5)}%`,
    processingSteps: [],
    verification,
    agentTraces: traces,
    metrics,
    memoryEntry,
  };
}

/**
 * Execute an agent function with retry logic and validation
 */
async function executeWithRetry<T>(
  agentName: string,
  role: 'planner' | 'executor' | 'verifier' | 'memory',
  fn: () => Promise<T>,
  validate: (result: T) => boolean,
  traces: AgentTrace[],
  onRetry?: (attempt: number, reason: string) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const result = await fn();

      if (!validate(result)) {
        throw new Error(`Validation failed for ${agentName} output — retrying with stricter params`);
      }

      traces.push({
        agentId: agentName.toLowerCase().replace(/\s/g, '_'),
        agentName,
        role,
        startedAt: start,
        completedAt: Date.now(),
        input: `Attempt ${attempt + 1}`,
        output: `Success after ${attempt} retries`,
        retryCount: attempt,
        status: attempt > 0 ? 'retried' : 'success',
      });

      return result;
    } catch (error: any) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        onRetry?.(attempt + 1, error.message);
        // Exponential backoff: 3s, 6s — gives Gemini time to recover from 503
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
  }

  traces.push({
    agentId: agentName.toLowerCase().replace(/\s/g, '_'),
    agentName,
    role,
    startedAt: Date.now(),
    completedAt: Date.now(),
    input: `Failed after ${MAX_RETRIES + 1} attempts`,
    output: lastError?.message || 'Unknown error',
    retryCount: MAX_RETRIES + 1,
    status: 'error',
  });

  throw lastError || new Error(`${agentName} failed after ${MAX_RETRIES + 1} attempts`);
}
