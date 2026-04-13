'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  Eye,
} from 'lucide-react';
import { VerificationResult } from '@/types';

interface VerificationReportProps {
  verification: VerificationResult;
}

const severityColors: Record<string, string> = {
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const typeLabels: Record<string, string> = {
  hallucination: 'Hallucination',
  broken_ui: 'Broken UI',
  inconsistency: 'Inconsistency',
  random_change: 'Random Change',
  off_brand: 'Off Brand',
};

export default function VerificationReport({ verification }: VerificationReportProps) {
  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div
        className={`rounded-2xl border p-6 ${
          verification.passed
            ? 'bg-green-500/[0.05] border-green-500/20'
            : 'bg-orange-500/[0.05] border-orange-500/20'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                verification.passed ? 'bg-green-500/15' : 'bg-orange-500/15'
              }`}
            >
              {verification.passed ? (
                <Shield className="w-6 h-6 text-green-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {verification.passed ? 'Verification Passed' : 'Review Recommended'}
              </h3>
              <p className="text-xs text-white/40">
                {verification.passed
                  ? 'All quality checks passed — output is safe to deploy'
                  : 'Some issues flagged — review before deploying'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-bold ${
                verification.overallScore >= 80
                  ? 'text-green-400'
                  : verification.overallScore >= 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {verification.overallScore}
            </div>
            <div className="text-[10px] text-white/25 uppercase tracking-wider">Quality Score</div>
          </div>
        </div>

        {/* Check results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {verification.checks.map((check, index) => (
            <motion.div
              key={check.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-xl border p-3 ${
                check.passed
                  ? 'bg-green-500/[0.05] border-green-500/15'
                  : 'bg-red-500/[0.05] border-red-500/15'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                {check.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className="text-[10px] font-semibold text-white/60">{check.name}</span>
              </div>
              <div
                className={`text-lg font-bold mb-1 ${
                  check.passed ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {check.score}%
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed">{check.details}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Flagged Issues */}
      {verification.flaggedIssues.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h4 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-orange-400" />
            Flagged Issues ({verification.flaggedIssues.length})
          </h4>
          <div className="space-y-2">
            {verification.flaggedIssues.map((issue, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-xl border p-4 ${severityColors[issue.severity]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                        {typeLabels[issue.type] || issue.type}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider font-bold ${severityColors[issue.severity]}`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 mb-1.5">{issue.description}</p>
                    {issue.element && (
                      <p className="text-[10px] text-white/25 font-mono">Element: {issue.element}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-white/30 mb-0.5">Resolution</div>
                    <p className="text-[10px] text-white/40 max-w-[200px]">{issue.resolution}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Auto Fixes */}
      {verification.autoFixes.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h4 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            Auto-Fixes ({verification.autoFixes.length})
          </h4>
          <div className="space-y-2">
            {verification.autoFixes.map((fix, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    fix.applied ? 'bg-green-500/15' : 'bg-white/5'
                  }`}
                >
                  {fix.applied ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-white/20" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-white/50">{fix.issue}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">
                    Action: {fix.action} {fix.applied ? '(applied)' : '(flagged for review)'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
