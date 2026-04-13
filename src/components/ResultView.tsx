'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Download,
  BarChart3,
  MessageSquare,
  Target,
  Lightbulb,
  CheckCircle2,
  ArrowLeft,
  Eye,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Layers,
  Shield,
  Activity,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { PersonalizationResult } from '@/types';
import AgentArchitecture from './AgentArchitecture';
import MetricsDashboard from './MetricsDashboard';
import VerificationReport from './VerificationReport';

interface ResultViewProps {
  result: PersonalizationResult;
  onReset: () => void;
}

type Tab = 'preview' | 'changes' | 'analysis' | 'agents' | 'verification' | 'metrics';

export default function ResultView({ result, onReset }: ResultViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [showOriginal, setShowOriginal] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const appliedCount = result.changes.filter(c => !c.modified.startsWith('[SUGGESTED]')).length;
  const suggestedCount = result.changes.filter(c => c.modified.startsWith('[SUGGESTED]')).length;

  const tabs = [
    { id: 'preview' as Tab, label: 'Preview', icon: Eye },
    { id: 'changes' as Tab, label: 'Changes', icon: Layers },
    { id: 'agents' as Tab, label: 'Agent Pipeline', icon: Zap },
    { id: 'verification' as Tab, label: 'Verification', icon: Shield },
    { id: 'metrics' as Tab, label: 'Metrics', icon: Activity },
    { id: 'analysis' as Tab, label: 'Analysis', icon: BarChart3 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            New Personalization
          </button>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-brand-400" />
            Personalization Complete
          </h2>
        </div>

        {/* Metrics */}
        <div className="flex gap-2 flex-wrap">
          <div className="px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="text-[10px] text-green-400/70 mb-0.5">Confidence</div>
            <div className="text-lg font-bold text-green-400">{result.confidenceScore}%</div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <div className="text-[10px] text-brand-400/70 mb-0.5">Est. Lift</div>
            <div className="text-lg font-bold text-brand-400">{result.estimatedLift}</div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="text-[10px] text-purple-400/70 mb-0.5">Changes</div>
            <div className="text-lg font-bold text-purple-400">
              {appliedCount}
              {suggestedCount > 0 && <span className="text-xs font-normal text-white/30">+{suggestedCount}</span>}
            </div>
          </div>
          {result.verification && (
            <div className={`px-3 py-2.5 rounded-xl border ${
              result.verification.passed
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
            }`}>
              <div className={`text-[10px] ${result.verification.passed ? 'text-green-400/70' : 'text-orange-400/70'} mb-0.5`}>Verifier</div>
              <div className={`text-lg font-bold ${result.verification.passed ? 'text-green-400' : 'text-orange-400'}`}>
                {result.verification.overallScore}%
              </div>
            </div>
          )}
          {/* Feedback loop */}
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-center">
            <div className="text-[10px] text-white/30 mb-1">Feedback</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setFeedback('positive')}
                className={`p-1 rounded-md transition-all ${
                  feedback === 'positive' ? 'bg-green-500/20 text-green-400' : 'text-white/20 hover:text-white/40'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFeedback('negative')}
                className={`p-1 rounded-md transition-all ${
                  feedback === 'negative' ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-white/40'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border border-white/15 shadow-glow-sm'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {/* Controls */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => {
                  setSplitView(!splitView);
                  if (!splitView) setShowOriginal(false);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                  splitView
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Split View
              </button>
              {!splitView && (
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                    showOriginal
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showOriginal ? 'Show Personalized' : 'Show Original'}
                </button>
              )}
            </div>

            {/* Preview */}
            {splitView ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                    <span className="text-xs font-medium text-white/50">Original</span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-white h-[600px]">
                    <iframe
                      src={result.landingPageUrl}
                      className="w-full h-full"
                      sandbox="allow-same-origin allow-scripts"
                      title="Original page"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs font-medium text-white/50">Personalized</span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-brand-500/20 bg-white h-[600px] shadow-glow-sm">
                    <iframe
                      srcDoc={result.personalizedHtml}
                      className="w-full h-full"
                      sandbox="allow-same-origin allow-scripts"
                      title="Personalized page"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-white h-[700px] relative">
                <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-xs font-medium text-white/80 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${showOriginal ? 'bg-orange-400' : 'bg-green-400'}`} />
                  {showOriginal ? 'Original Page' : 'Personalized Page'}
                </div>
                {showOriginal ? (
                  <iframe
                    src={result.landingPageUrl}
                    className="w-full h-full"
                    sandbox="allow-same-origin allow-scripts"
                    title="Original page"
                  />
                ) : (
                  <iframe
                    srcDoc={result.personalizedHtml}
                    className="w-full h-full"
                    sandbox="allow-same-origin allow-scripts"
                    title="Personalized page"
                  />
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'changes' && (
          <motion.div
            key="changes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {result.changes.length === 0 ? (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.03] p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-yellow-400/60 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white/80 mb-2">No Changes Generated</h3>
                <p className="text-sm text-white/40 max-w-lg mx-auto leading-relaxed">
                  The CRO analysis could not generate changes for this page. 
                  This can happen with JavaScript-rendered SPAs or when the Gemini API cannot parse the page content. 
                  Try a different landing page URL.
                </p>
              </div>
            ) : (
            <>
            {appliedCount > 0 && (
              <div className="text-sm text-green-400/70 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {appliedCount} changes applied to page
                {suggestedCount > 0 && <span className="text-white/30">• {suggestedCount} suggested (not found in HTML)</span>}
              </div>
            )}
            {result.changes.map((change, index) => {
              const isSuggested = change.modified.startsWith('[SUGGESTED]');
              const displayModified = isSuggested ? change.modified.replace('[SUGGESTED] ', '') : change.modified;
              return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`rounded-2xl border overflow-hidden ${isSuggested ? 'border-yellow-500/10 bg-yellow-500/[0.01]' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-brand-500/15 text-brand-300 text-xs font-semibold uppercase tracking-wider">
                        {change.type}
                      </span>
                      {isSuggested && (
                        <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400/70 text-xs">Suggested</span>
                      )}
                      <span className="text-xs text-white/20 font-mono">{change.selector}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-xs font-medium text-red-400/70">Original</span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{change.original}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/[0.05] border border-green-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-xs font-medium text-green-400/70">Personalized</span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{displayModified}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex items-start gap-2 flex-1">
                      <Lightbulb className="w-4 h-4 text-yellow-400/50 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-white/35 leading-relaxed">{change.rationale}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300/70 text-xs font-medium whitespace-nowrap">
                      {change.croRule}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
            })}
            </>
            )}
          </motion.div>
        )}

        {activeTab === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Ad Analysis */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-400" />
                Ad Creative Analysis
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Headline', value: result.adAnalysis.headline },
                  { label: 'Value Proposition', value: result.adAnalysis.valueProposition },
                  { label: 'Target Audience', value: result.adAnalysis.targetAudience },
                  { label: 'Tone', value: result.adAnalysis.tone },
                  { label: 'CTA', value: result.adAnalysis.callToAction },
                  { label: 'Brand Voice', value: result.adAnalysis.brandVoice },
                  { label: 'Urgency', value: result.adAnalysis.urgencyLevel },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="text-xs text-white/30 mb-1">{item.label}</div>
                    <div className="text-sm text-white/70">{item.value}</div>
                  </div>
                ))}

                <div>
                  <div className="text-xs text-white/30 mb-2">Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.adAnalysis.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-300/70 text-xs"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/30 mb-2">Emotional Triggers</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.adAnalysis.emotionalTriggers.map((trigger) => (
                      <span
                        key={trigger}
                        className="px-2 py-0.5 rounded-md bg-accent-500/10 text-accent-300/70 text-xs"
                      >
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>

                {result.adAnalysis.colorScheme?.length > 0 && (
                  <div>
                    <div className="text-xs text-white/30 mb-2">Color Scheme</div>
                    <div className="flex gap-2">
                      {result.adAnalysis.colorScheme.map((color) => (
                        <div key={color} className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-md border border-white/10"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-white/30 font-mono">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CRO Analysis */}
            <div className="space-y-6">
              {/* Message Match Score */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  CRO Analysis
                </h3>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/50">Message Match Score</span>
                    <span className="text-2xl font-bold text-white">{result.croAnalysis.messageMatchScore}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.croAnalysis.messageMatchScore}%` }}
                      transition={{ delay: 0.5, duration: 1 }}
                      className={`h-full rounded-full ${
                        result.croAnalysis.messageMatchScore >= 70
                          ? 'bg-green-500'
                          : result.croAnalysis.messageMatchScore >= 40
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Issues */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h4 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Issues Found
                </h4>
                <ul className="space-y-2">
                  {result.croAnalysis.currentIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400/50 mt-1.5 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h4 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Recommendations Applied
                </h4>
                <ul className="space-y-2">
                  {result.croAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400/50 mt-1.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'agents' && result.agentTraces && (
          <motion.div
            key="agents"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <AgentArchitecture traces={result.agentTraces} />
          </motion.div>
        )}

        {activeTab === 'verification' && result.verification && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <VerificationReport verification={result.verification} />
          </motion.div>
        )}

        {activeTab === 'metrics' && result.metrics && (
          <motion.div
            key="metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <MetricsDashboard metrics={result.metrics} />

            {/* Memory / Learning Loop */}
            {result.memoryEntry && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  Learning Loop — Memory Agent
                </h3>
                <p className="text-xs text-white/30 mb-5">
                  Patterns captured from this run for continuous improvement
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="text-xs text-white/30 mb-2">Domain</div>
                    <div className="text-sm text-white/70 font-mono">{result.memoryEntry.domain}</div>
                    <div className="text-xs text-white/30 mt-2 mb-1">Ad Type</div>
                    <div className="text-sm text-white/70">{result.memoryEntry.adType}</div>
                  </div>

                  <div className="rounded-xl border border-green-500/10 bg-green-500/[0.03] p-4">
                    <div className="text-xs text-green-400/50 mb-2">Successful Patterns ({result.memoryEntry.successfulPatterns.length})</div>
                    <div className="space-y-1.5">
                      {result.memoryEntry.successfulPatterns.slice(0, 4).map((p, i) => (
                        <div key={i} className="text-[11px] text-white/40 flex items-start gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-green-400/50 mt-1.5 flex-shrink-0" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4">
                    <div className="text-xs text-red-400/50 mb-2">Failed Patterns ({result.memoryEntry.failedPatterns.length})</div>
                    <div className="space-y-1.5">
                      {result.memoryEntry.failedPatterns.length === 0 ? (
                        <div className="text-[11px] text-white/25">No failures detected</div>
                      ) : (
                        result.memoryEntry.failedPatterns.slice(0, 4).map((p, i) => (
                          <div key={i} className="text-[11px] text-white/40 flex items-start gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-red-400/50 mt-1.5 flex-shrink-0" />
                            {p}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
