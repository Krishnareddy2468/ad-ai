import { AdAnalysis, CROAnalysis, VerificationResult, MemoryEntry, PageElement } from '@/types';

/**
 * Memory Agent — The Learning Loop
 * 
 * Architecture: Planner → Executor → Verifier → [MEMORY]
 * 
 * Captures patterns from each run to improve future outputs:
 * - What patterns worked (high message match, passed verification)
 * - What patterns failed (flagged by verifier, low confidence)
 * - Domain-specific insights (e.g., SaaS pages need different CRO than e-commerce)
 * 
 * In production, this would persist to a vector DB or structured store.
 * Here we demonstrate the pattern with in-memory + localStorage on client.
 */

// In-memory store (production: Redis/Postgres/Pinecone)
const memoryStore: MemoryEntry[] = [];

export function createMemoryEntry(
  adAnalysis: AdAnalysis,
  croAnalysis: CROAnalysis,
  verification: VerificationResult,
  changes: PageElement[],
  landingPageUrl: string
): MemoryEntry {
  const domain = extractDomain(landingPageUrl);
  const adType = classifyAdType(adAnalysis);
  
  const successfulPatterns = changes
    .filter(c => !c.modified.startsWith('[SUGGESTED]'))
    .map(c => `${c.type}: ${c.croRule}`);

  const failedPatterns = verification.flaggedIssues.map(
    issue => `${issue.type}: ${issue.description}`
  );

  const entry: MemoryEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    domain,
    adType,
    successfulPatterns,
    failedPatterns,
    messageMatchDelta: croAnalysis.messageMatchScore,
  };

  memoryStore.push(entry);
  return entry;
}

export function getRelevantMemories(domain: string, adType: string): MemoryEntry[] {
  return memoryStore
    .filter(m => m.domain === domain || m.adType === adType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
}

export function recordFeedback(entryId: string, feedback: 'positive' | 'negative'): void {
  const entry = memoryStore.find(m => m.id === entryId);
  if (entry) {
    entry.feedback = feedback;
  }
}

export function getMemoryStats(): {
  totalRuns: number;
  avgMessageMatch: number;
  topPatterns: string[];
  commonFailures: string[];
} {
  if (memoryStore.length === 0) {
    return { totalRuns: 0, avgMessageMatch: 0, topPatterns: [], commonFailures: [] };
  }

  const avgMessageMatch = Math.round(
    memoryStore.reduce((sum, m) => sum + m.messageMatchDelta, 0) / memoryStore.length
  );

  // Count pattern frequency
  const patternCounts: Record<string, number> = {};
  const failureCounts: Record<string, number> = {};

  for (const entry of memoryStore) {
    for (const p of entry.successfulPatterns) {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    }
    for (const f of entry.failedPatterns) {
      failureCounts[f] = (failureCounts[f] || 0) + 1;
    }
  }

  const topPatterns = Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([p]) => p);

  const commonFailures = Object.entries(failureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([f]) => f);

  return { totalRuns: memoryStore.length, avgMessageMatch, topPatterns, commonFailures };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function classifyAdType(adAnalysis: AdAnalysis): string {
  const tone = adAnalysis.tone.toLowerCase();
  const urgency = adAnalysis.urgencyLevel;

  if (urgency === 'high') return 'urgency-driven';
  if (tone.includes('professional') || tone.includes('enterprise')) return 'b2b-professional';
  if (tone.includes('casual') || tone.includes('fun')) return 'b2c-casual';
  if (tone.includes('aspirational') || tone.includes('premium')) return 'premium-aspirational';
  return 'general';
}
