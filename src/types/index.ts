// ─── Ad Analysis ───
export interface AdAnalysis {
  headline: string;
  subheadline: string;
  valueProposition: string;
  targetAudience: string;
  tone: string;
  keywords: string[];
  callToAction: string;
  emotionalTriggers: string[];
  colorScheme: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  brandVoice: string;
}

// ─── Page Elements ───
export interface PageElement {
  selector: string;
  type: 'headline' | 'subheadline' | 'cta' | 'body' | 'hero' | 'testimonial' | 'image' | 'meta';
  original: string;
  modified: string;
  rationale: string;
  croRule: string;
}

// ─── CRO Analysis ───
export interface CROAnalysis {
  messageMatchScore: number;
  currentIssues: string[];
  recommendations: string[];
  priorityChanges: PageElement[];
}

// ─── Verifier Output ───
export interface VerificationResult {
  passed: boolean;
  overallScore: number;
  checks: VerificationCheck[];
  flaggedIssues: FlaggedIssue[];
  autoFixes: AutoFix[];
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface FlaggedIssue {
  type: 'hallucination' | 'broken_ui' | 'inconsistency' | 'random_change' | 'off_brand';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  element?: string;
  resolution: string;
}

export interface AutoFix {
  issue: string;
  action: string;
  applied: boolean;
}

// ─── Agent Trace (full pipeline observability) ───
export interface AgentTrace {
  agentId: string;
  agentName: string;
  role: 'planner' | 'executor' | 'verifier' | 'memory';
  startedAt: number;
  completedAt?: number;
  input: string;
  output: string;
  tokensUsed?: number;
  retryCount: number;
  status: 'success' | 'error' | 'retried';
}

// ─── Memory Entry (learning loop) ───
export interface MemoryEntry {
  id: string;
  timestamp: number;
  domain: string;
  adType: string;
  successfulPatterns: string[];
  failedPatterns: string[];
  messageMatchDelta: number;
  feedback?: 'positive' | 'negative';
}

// ─── Evaluation Metrics ───
export interface EvaluationMetrics {
  outputSuccessRate: number;
  taskCompletionRate: number;
  errorRate: number;
  avgTimeToExecution: number;
  hallucinationsCaught: number;
  autoFixesApplied: number;
  verifierPassRate: number;
  retryRate: number;
}

// ─── Full Result ───
export interface PersonalizationResult {
  originalHtml: string;
  personalizedHtml: string;
  landingPageUrl: string;
  adAnalysis: AdAnalysis;
  croAnalysis: CROAnalysis;
  changes: PageElement[];
  confidenceScore: number;
  estimatedLift: string;
  processingSteps: ProcessingStep[];

  // Agent architecture outputs
  verification: VerificationResult;
  agentTraces: AgentTrace[];
  metrics: EvaluationMetrics;
  memoryEntry: MemoryEntry;
}

// ─── Processing ───
export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'retrying';
  result?: string;
  duration?: number;
  retryCount?: number;
  agentRole?: 'planner' | 'executor' | 'verifier' | 'memory';
}

export interface FormData {
  adCreativeUrl?: string;
  adCreativeFile?: File;
  adCreativeBase64?: string;
  landingPageUrl: string;
}

export type AppState = 'input' | 'processing' | 'results';
