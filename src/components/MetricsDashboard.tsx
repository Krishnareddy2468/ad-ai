'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Wrench,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { EvaluationMetrics } from '@/types';

interface MetricsDashboardProps {
  metrics: EvaluationMetrics;
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const items = [
    {
      label: 'Output Success Rate',
      value: `${metrics.outputSuccessRate}%`,
      icon: CheckCircle,
      color: metrics.outputSuccessRate >= 80 ? 'text-green-400' : 'text-yellow-400',
      bg: metrics.outputSuccessRate >= 80 ? 'bg-green-500/10' : 'bg-yellow-500/10',
      description: 'Percentage of agents that completed successfully',
    },
    {
      label: 'Task Completion',
      value: `${metrics.taskCompletionRate}%`,
      icon: Activity,
      color: metrics.taskCompletionRate >= 80 ? 'text-blue-400' : 'text-orange-400',
      bg: metrics.taskCompletionRate >= 80 ? 'bg-blue-500/10' : 'bg-orange-500/10',
      description: 'Overall personalization pipeline completion',
    },
    {
      label: 'Verifier Pass Rate',
      value: `${metrics.verifierPassRate}%`,
      icon: Shield,
      color: metrics.verifierPassRate >= 70 ? 'text-green-400' : 'text-red-400',
      bg: metrics.verifierPassRate >= 70 ? 'bg-green-500/10' : 'bg-red-500/10',
      description: 'Quality checks passed by the Verifier agent',
    },
    {
      label: 'Avg Execution Time',
      value: `${(metrics.avgTimeToExecution / 1000).toFixed(1)}s`,
      icon: Clock,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      description: 'Average time per agent step',
    },
    {
      label: 'Hallucinations Caught',
      value: metrics.hallucinationsCaught.toString(),
      icon: Eye,
      color: metrics.hallucinationsCaught === 0 ? 'text-green-400' : 'text-orange-400',
      bg: metrics.hallucinationsCaught === 0 ? 'bg-green-500/10' : 'bg-orange-500/10',
      description: 'Fabricated content detected and flagged',
    },
    {
      label: 'Auto-Fixes Applied',
      value: metrics.autoFixesApplied.toString(),
      icon: Wrench,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      description: 'Issues automatically corrected by the system',
    },
    {
      label: 'Error Rate',
      value: `${metrics.errorRate}%`,
      icon: XCircle,
      color: metrics.errorRate <= 10 ? 'text-green-400' : 'text-red-400',
      bg: metrics.errorRate <= 10 ? 'bg-green-500/10' : 'bg-red-500/10',
      description: 'Percentage of agent steps that encountered errors',
    },
    {
      label: 'Retry Rate',
      value: `${metrics.retryRate}%`,
      icon: RotateCcw,
      color: metrics.retryRate <= 20 ? 'text-green-400' : 'text-yellow-400',
      bg: metrics.retryRate <= 20 ? 'bg-green-500/10' : 'bg-yellow-500/10',
      description: 'Steps that needed retries due to validation failure',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Activity className="w-5 h-5 text-brand-400" />
        Evaluation Metrics
      </h3>
      <p className="text-xs text-white/30 mb-6">
        Real-time pipeline performance — tracks success, errors, hallucinations, and retries
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center`}>
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              </div>
            </div>
            <div className={`text-xl font-bold ${item.color} mb-1`}>{item.value}</div>
            <div className="text-[11px] font-medium text-white/50 mb-1">{item.label}</div>
            <div className="text-[9px] text-white/20 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
              {item.description}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
