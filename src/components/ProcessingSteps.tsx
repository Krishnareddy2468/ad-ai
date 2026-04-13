'use client';

import { motion } from 'framer-motion';
import { Brain, Globe, BarChart3, Wand2, Check, Loader2, AlertCircle, Shield, Database, RotateCcw } from 'lucide-react';
import { ProcessingStep } from '@/types';

interface ProcessingStepsProps {
  steps: ProcessingStep[];
  currentStep: number;
}

const iconMap: Record<string, any> = {
  analyze: Brain,
  scrape: Globe,
  cro: BarChart3,
  personalize: Wand2,
  verify: Shield,
  memory: Database,
};

export default function ProcessingSteps({ steps, currentStep }: ProcessingStepsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20 mb-5"
        >
          <Wand2 className="w-7 h-7 text-brand-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Agent Pipeline Running</h2>
        <p className="text-white/40 text-sm">
          Planner → Executor → Verifier → Memory
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = iconMap[step.id] || Brain;
          const isActive = step.status === 'running';
          const isComplete = step.status === 'completed';
          const isError = step.status === 'error';
          const isRetrying = step.status === 'retrying';
          const isPending = step.status === 'pending';

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15, duration: 0.4 }}
              className={`relative rounded-2xl border p-5 transition-all duration-500 ${
                isActive
                  ? 'bg-brand-500/[0.08] border-brand-500/30 shadow-glow-sm'
                  : isRetrying
                  ? 'bg-yellow-500/[0.08] border-yellow-500/30'
                  : isComplete
                  ? 'bg-green-500/[0.05] border-green-500/20'
                  : isError
                  ? 'bg-red-500/[0.05] border-red-500/20'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-400'
                      : isRetrying
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : isComplete
                      ? 'bg-green-500/20 text-green-400'
                      : isError
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/5 text-white/20'
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isRetrying ? (
                    <RotateCcw className="w-5 h-5 animate-spin" />
                  ) : isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : isError ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          isActive
                            ? 'text-brand-300'
                            : isRetrying
                            ? 'text-yellow-300'
                            : isComplete
                            ? 'text-green-300'
                            : isError
                            ? 'text-red-300'
                            : 'text-white/30'
                        }`}
                      >
                        {step.label}
                      </h3>
                      {step.agentRole && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/20 uppercase tracking-wider">
                          {step.agentRole}
                        </span>
                      )}
                      {isRetrying && step.retryCount && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400/70">
                          Retry #{step.retryCount}
                        </span>
                      )}
                    </div>
                    {step.duration && (
                      <span className="text-xs text-white/20">{(step.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <p className={`text-xs ${isActive ? 'text-white/50' : 'text-white/20'}`}>
                    {step.description}
                  </p>

                  {/* Result preview */}
                  {step.result && isComplete && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5"
                    >
                      <p className="text-xs text-white/40 font-mono leading-relaxed line-clamp-3">
                        {step.result}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Active indicator pulse */}
              {isActive && (
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl border border-brand-400/20"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-8">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{
              width: `${(steps.filter((s) => s.status === 'completed').length / steps.length) * 100}%`,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full"
          />
        </div>
        <p className="text-center text-xs text-white/20 mt-3">
          {steps.filter((s) => s.status === 'completed').length} of {steps.length} steps completed
        </p>
      </div>
    </motion.div>
  );
}
