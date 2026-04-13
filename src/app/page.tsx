'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import AnimatedBackground from '@/components/AnimatedBackground';
import InputForm from '@/components/InputForm';
import ProcessingSteps from '@/components/ProcessingSteps';
import ResultView from '@/components/ResultView';
import { ProcessingStep, PersonalizationResult, AppState } from '@/types';

const INITIAL_STEPS: ProcessingStep[] = [
  {
    id: 'analyze',
    label: 'Analyzing Ad Creative',
    description: 'Gemini Vision extracts messaging, tone, audience, and CTA from your ad',
    status: 'pending',
    agentRole: 'planner',
  },
  {
    id: 'scrape',
    label: 'Scraping Landing Page',
    description: 'Fetching and parsing the landing page HTML structure',
    status: 'pending',
    agentRole: 'planner',
  },
  {
    id: 'cro',
    label: 'CRO Analysis',
    description: 'Evaluating message match and identifying optimization opportunities',
    status: 'pending',
    agentRole: 'executor',
  },
  {
    id: 'personalize',
    label: 'Applying Personalization',
    description: 'Modifying page copy and CTAs aligned with your ad creative',
    status: 'pending',
    agentRole: 'executor',
  },
  {
    id: 'verify',
    label: 'Quality Verification',
    description: 'Checking for hallucinations, broken UI, inconsistencies, and brand safety',
    status: 'pending',
    agentRole: 'verifier',
  },
  {
    id: 'memory',
    label: 'Learning Loop',
    description: 'Storing successful patterns and failures for continuous improvement',
    status: 'pending',
    agentRole: 'memory',
  },
];

export default function Home() {
  const [appState, setAppState] = useState<AppState>('input');
  const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS);
  const [result, setResult] = useState<PersonalizationResult | null>(null);

  const updateStep = (id: string, updates: Partial<ProcessingStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleSubmit = async (data: {
    adCreativeBase64?: string;
    adCreativeUrl?: string;
    landingPageUrl: string;
  }) => {
    setAppState('processing');
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as const, result: undefined, duration: undefined })));

    try {
      // Step 1: Analyze Ad Creative
      updateStep('analyze', { status: 'running' });
      const analyzeStart = Date.now();

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: data.adCreativeBase64,
          imageUrl: data.adCreativeUrl,
        }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || 'Failed to analyze ad');
      }

      const analyzeData = await analyzeRes.json();
      updateStep('analyze', {
        status: 'completed',
        duration: Date.now() - analyzeStart,
        result: `Detected: "${analyzeData.analysis.headline}" | Audience: ${analyzeData.analysis.targetAudience} | Tone: ${analyzeData.analysis.tone}`,
      });

      // Step 2: Scrape Landing Page
      updateStep('scrape', { status: 'running' });
      const scrapeStart = Date.now();

      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.landingPageUrl }),
      });

      if (!scrapeRes.ok) {
        const err = await scrapeRes.json();
        throw new Error(err.error || 'Failed to scrape page');
      }

      const scrapeData = await scrapeRes.json();
      updateStep('scrape', {
        status: 'completed',
        duration: Date.now() - scrapeStart,
        result: `Page: "${scrapeData.data.title}" | ${scrapeData.data.elements.length} elements found | ${(scrapeData.data.textLength / 1000).toFixed(1)}k chars`,
      });

      // Steps 3-6: CRO → Personalize → Verify → Memory (orchestrated on server)
      updateStep('cro', { status: 'running' });
      const pipelineStart = Date.now();

      const personalizeRes = await fetch('/api/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: data.adCreativeBase64,
          imageUrl: data.adCreativeUrl,
          landingPageUrl: data.landingPageUrl,
        }),
      });

      if (!personalizeRes.ok) {
        const err = await personalizeRes.json();
        throw new Error(err.error || 'Failed to personalize page');
      }

      const personalizeData = await personalizeRes.json();
      const pipelineEnd = Date.now();
      const pipelineTime = pipelineEnd - pipelineStart;

      // Animate through the remaining steps
      updateStep('cro', {
        status: 'completed',
        duration: Math.round(pipelineTime * 0.25),
        result: `Message Match: ${personalizeData.result.croAnalysis.messageMatchScore}% | ${personalizeData.result.croAnalysis.currentIssues.length} issues found`,
      });

      updateStep('personalize', { status: 'running' });
      await new Promise((r) => setTimeout(r, 600));
      updateStep('personalize', {
        status: 'completed',
        duration: Math.round(pipelineTime * 0.30),
        result: `${personalizeData.result.changes.length} changes applied to page`,
      });

      updateStep('verify', { status: 'running' });
      await new Promise((r) => setTimeout(r, 500));
      updateStep('verify', {
        status: 'completed',
        duration: Math.round(pipelineTime * 0.25),
        result: `Score: ${personalizeData.result.verification.overallScore}% | ${personalizeData.result.verification.checks.filter((c: any) => c.passed).length}/${personalizeData.result.verification.checks.length} checks passed | ${personalizeData.result.verification.flaggedIssues.length} issues flagged`,
      });

      updateStep('memory', { status: 'running' });
      await new Promise((r) => setTimeout(r, 400));
      updateStep('memory', {
        status: 'completed',
        duration: Math.round(pipelineTime * 0.05),
        result: `Learned ${personalizeData.result.memoryEntry.successfulPatterns.length} patterns | Domain: ${personalizeData.result.memoryEntry.domain}`,
      });

      await new Promise((r) => setTimeout(r, 500));

      setResult(personalizeData.result);
      setAppState('results');
      toast.success('Personalization complete — verified & stored!');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Something went wrong');

      // Mark current running step as error
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'error' as const } : s
        )
      );

      // Go back to input after a delay
      setTimeout(() => {
        setAppState('input');
        setSteps(INITIAL_STEPS);
      }, 3000);
    }
  };

  const handleReset = () => {
    setAppState('input');
    setSteps(INITIAL_STEPS);
    setResult(null);
  };

  return (
    <main className="relative min-h-screen">
      <AnimatedBackground />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 25, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            backdropFilter: 'blur(20px)',
          },
        }}
      />

      <div className="relative z-10 px-4 py-12 md:py-20">
        <AnimatePresence mode="wait">
          {appState === 'input' && (
            <InputForm
              key="input"
              onSubmit={handleSubmit}
              isLoading={false}
            />
          )}

          {appState === 'processing' && (
            <ProcessingSteps
              key="processing"
              steps={steps}
              currentStep={steps.findIndex((s) => s.status === 'running')}
            />
          )}

          {appState === 'results' && result && (
            <ResultView
              key="results"
              result={result}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-xs text-white/15">
        Built with Gemini 2.5 Flash • Next.js • CRO Principles
      </footer>
    </main>
  );
}
