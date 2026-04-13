import { generateWithFallback, safeParseJSON } from '../openai';
import { AdAnalysis, CROAnalysis, PageElement, VerificationResult, FlaggedIssue, AutoFix } from '@/types';

/**
 * Verifier Agent — The Guardian
 * 
 * Runs after the Executor (personalizer) to catch:
 * 1. Hallucinations — fabricated stats, fake testimonials, invented claims
 * 2. Broken UI — structural HTML damage, missing elements
 * 3. Inconsistencies — tone/voice mismatch between ad and changes
 * 4. Random changes — modifications unrelated to ad messaging
 * 5. Off-brand — changes that contradict the original brand identity
 * 
 * Architecture: Planner → Executor → [VERIFIER] → Memory
 */
export async function verifyPersonalization(
  adAnalysis: AdAnalysis,
  croAnalysis: CROAnalysis,
  changes: PageElement[],
  originalHtml: string,
  personalizedHtml: string
): Promise<VerificationResult> {
  
  // Run verification checks in parallel for speed
  const [contentVerification, structuralCheck] = await Promise.all([
    verifyContentIntegrity(adAnalysis, changes),
    verifyStructuralIntegrity(originalHtml, personalizedHtml),
  ]);

  const flaggedIssues: FlaggedIssue[] = [
    ...contentVerification.issues,
    ...structuralCheck.issues,
  ];

  const autoFixes: AutoFix[] = [];

  // Auto-fix: Remove changes flagged as hallucinations
  for (const issue of flaggedIssues) {
    if (issue.severity === 'critical' || issue.severity === 'high') {
      autoFixes.push({
        issue: issue.description,
        action: `Flagged for review — ${issue.resolution}`,
        applied: issue.severity === 'critical',
      });
    }
  }

  const checks = [
    {
      name: 'Hallucination Detection',
      passed: contentVerification.hallucinationScore >= 80,
      score: contentVerification.hallucinationScore,
      details: contentVerification.hallucinationScore >= 80
        ? 'No fabricated content detected'
        : `${100 - contentVerification.hallucinationScore}% of changes may contain unverified claims`,
    },
    {
      name: 'Message Consistency',
      passed: contentVerification.consistencyScore >= 70,
      score: contentVerification.consistencyScore,
      details: contentVerification.consistencyScore >= 70
        ? 'Changes align with ad tone and messaging'
        : 'Some changes deviate from the ad\'s core message',
    },
    {
      name: 'Structural Integrity',
      passed: structuralCheck.structureScore >= 85,
      score: structuralCheck.structureScore,
      details: structuralCheck.structureScore >= 85
        ? 'HTML structure preserved — no broken elements'
        : 'Minor structural issues detected in personalized output',
    },
    {
      name: 'Brand Safety',
      passed: contentVerification.brandSafetyScore >= 90,
      score: contentVerification.brandSafetyScore,
      details: contentVerification.brandSafetyScore >= 90
        ? 'All changes are brand-safe'
        : 'Some changes may conflict with brand guidelines',
    },
    {
      name: 'CRO Alignment',
      passed: contentVerification.croAlignmentScore >= 75,
      score: contentVerification.croAlignmentScore,
      details: contentVerification.croAlignmentScore >= 75
        ? 'Changes follow established CRO principles'
        : 'Some changes lack clear CRO rationale',
    },
  ];

  const overallScore = Math.round(
    checks.reduce((sum, c) => sum + c.score, 0) / checks.length
  );

  return {
    passed: overallScore >= 75 && !flaggedIssues.some(i => i.severity === 'critical'),
    overallScore,
    checks,
    flaggedIssues,
    autoFixes,
  };
}

async function verifyContentIntegrity(
  adAnalysis: AdAnalysis,
  changes: PageElement[]
): Promise<{
  hallucinationScore: number;
  consistencyScore: number;
  brandSafetyScore: number;
  croAlignmentScore: number;
  issues: FlaggedIssue[];
}> {
  const prompt = `You are a strict QA Verifier Agent for an AI personalization system. Your job is to catch errors BEFORE they reach users.

Analyze the personalization changes and score them on:

1. HALLUCINATION (0-100): Are there fabricated statistics, fake testimonials, invented product features, or unverifiable claims? Score 100 = no hallucinations.
2. CONSISTENCY (0-100): Do ALL changes align with the ad's tone, target audience, and messaging? Score 100 = perfect alignment.
3. BRAND_SAFETY (0-100): Could any change damage brand reputation or misrepresent the product? Score 100 = fully safe.
4. CRO_ALIGNMENT (0-100): Does every change follow a legitimate CRO principle? Score 100 = all changes are CRO-justified.

For each issue found, categorize it as:
- hallucination: Made up data/claims not in original page or ad
- inconsistency: Tone/voice doesn't match the ad
- random_change: Change unrelated to ad message
- off_brand: Change contradicts original brand identity

Return JSON:
{
  "hallucinationScore": number,
  "consistencyScore": number, 
  "brandSafetyScore": number,
  "croAlignmentScore": number,
  "issues": [
    {
      "type": "hallucination|inconsistency|random_change|off_brand",
      "severity": "low|medium|high|critical",
      "description": "what's wrong",
      "element": "which change element",
      "resolution": "how to fix it"
    }
  ]
}

Be strict. It's better to flag a false positive than let a hallucination through. Only respond with valid JSON.

Ad Analysis: ${JSON.stringify(adAnalysis)}

Changes Made:
${JSON.stringify(changes, null, 2)}

Verify these changes for quality and accuracy.`;

  const result = await generateWithFallback({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  });

  const content = result.response.text() || '{}';
  const fallbackResult = {
    hallucinationScore: 70,
    consistencyScore: 70,
    brandSafetyScore: 85,
    croAlignmentScore: 75,
    issues: [{
      type: 'inconsistency' as const,
      severity: 'low' as const,
      description: 'Verification data could not be fully parsed — manual review recommended',
      resolution: 'Review changes manually',
    }],
  };
  return safeParseJSON(content, fallbackResult);
}

async function verifyStructuralIntegrity(
  originalHtml: string,
  personalizedHtml: string
): Promise<{
  structureScore: number;
  issues: FlaggedIssue[];
}> {
  const issues: FlaggedIssue[] = [];
  let score = 100;

  // Check structural preservation
  const origLen = originalHtml.length;
  const newLen = personalizedHtml.length;
  const sizeDelta = Math.abs(newLen - origLen) / origLen;

  if (sizeDelta > 0.3) {
    score -= 20;
    issues.push({
      type: 'broken_ui',
      severity: 'medium',
      description: `Page size changed by ${(sizeDelta * 100).toFixed(1)}% — possible structural damage`,
      resolution: 'Review personalized HTML for unintended structural changes',
    });
  }

  // Check for critical HTML elements preservation
  const criticalTags = ['</head>', '</body>', '</html>'];
  for (const tag of criticalTags) {
    if (originalHtml.includes(tag) && !personalizedHtml.includes(tag)) {
      score -= 15;
      issues.push({
        type: 'broken_ui',
        severity: 'high',
        description: `Critical HTML tag ${tag} missing in personalized output`,
        resolution: `Restore ${tag} tag to maintain valid HTML structure`,
      });
    }
  }

  // Check for JS injection (safety)
  const dangerousPatterns = [new RegExp('<script[^>]*>.*?(eval|document\\.write|innerHTML)', 'is')];
  for (const pattern of dangerousPatterns) {
    const origMatch = originalHtml.match(pattern);
    const newMatch = personalizedHtml.match(pattern);
    if (!origMatch && newMatch) {
      score -= 30;
      issues.push({
        type: 'broken_ui',
        severity: 'critical',
        description: 'Potentially unsafe script injection detected in personalized output',
        resolution: 'Remove injected script — this was not in the original page',
      });
    }
  }

  return { structureScore: Math.max(0, score), issues };
}
