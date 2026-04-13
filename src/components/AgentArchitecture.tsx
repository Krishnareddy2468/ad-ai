'use client';

import { motion } from 'framer-motion';
import { Brain, Cpu, Shield, Database, ArrowRight, Zap } from 'lucide-react';
import { AgentTrace } from '@/types';

interface AgentArchitectureProps {
  traces: AgentTrace[];
  isLive?: boolean;
}

const agents = [
  {
    id: 'planner',
    label: 'Planner',
    icon: Brain,
    color: 'from-blue-500 to-cyan-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-400',
    description: 'Analyzes ad creative & plans personalization strategy',
  },
  {
    id: 'executor',
    label: 'Executor',
    icon: Cpu,
    color: 'from-purple-500 to-violet-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    textColor: 'text-purple-400',
    description: 'Applies CRO rules & modifies page elements',
  },
  {
    id: 'verifier',
    label: 'Verifier',
    icon: Shield,
    color: 'from-green-500 to-emerald-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-400',
    description: 'Catches hallucinations & validates output quality',
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    color: 'from-amber-500 to-yellow-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400',
    description: 'Stores patterns for continuous improvement',
  },
];

export default function AgentArchitecture({ traces, isLive }: AgentArchitectureProps) {
  const getTraceForRole = (role: string) => traces.filter(t => t.role === role);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Zap className="w-5 h-5 text-brand-400" />
        Agent Architecture
      </h3>
      <p className="text-xs text-white/30 mb-6">
        Multi-agent pipeline: Planner → Executor → Verifier → Memory
      </p>

      <div className="flex flex-col md:flex-row items-stretch gap-3">
        {agents.map((agent, index) => {
          const agentTraces = getTraceForRole(agent.id);
          const hasActivity = agentTraces.length > 0;
          const hasRetries = agentTraces.some(t => t.retryCount > 0);
          const hasErrors = agentTraces.some(t => t.status === 'error');
          const totalDuration = agentTraces.reduce(
            (sum, t) => sum + ((t.completedAt || Date.now()) - t.startedAt),
            0
          );

          return (
            <div key={agent.id} className="flex items-center flex-1 gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.15, type: 'spring' }}
                className={`flex-1 rounded-xl border p-4 transition-all duration-500 ${
                  hasActivity
                    ? `${agent.bgColor} ${agent.borderColor}`
                    : 'bg-white/[0.02] border-white/5'
                } ${isLive && !hasActivity ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      hasActivity ? agent.bgColor : 'bg-white/5'
                    }`}
                  >
                    <agent.icon
                      className={`w-4 h-4 ${hasActivity ? agent.textColor : 'text-white/20'}`}
                    />
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${hasActivity ? agent.textColor : 'text-white/30'}`}>
                      {agent.label}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-white/25 mb-3 leading-relaxed">
                  {agent.description}
                </p>

                {hasActivity && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/20">Duration</span>
                      <span className="text-[10px] font-mono text-white/40">
                        {(totalDuration / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/20">Sub-agents</span>
                      <span className="text-[10px] font-mono text-white/40">
                        {agentTraces.length}
                      </span>
                    </div>
                    {hasRetries && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-yellow-400/50">Retries</span>
                        <span className="text-[10px] font-mono text-yellow-400/70">
                          {agentTraces.reduce((s, t) => s + t.retryCount, 0)}
                        </span>
                      </div>
                    )}
                    {hasErrors && (
                      <div className="mt-1 px-1.5 py-0.5 rounded bg-red-500/10 text-[9px] text-red-400/70 text-center">
                        Issues detected
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Arrow connector */}
              {index < agents.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.15 + 0.3 }}
                  className="hidden md:flex items-center"
                >
                  <ArrowRight className="w-4 h-4 text-white/10" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agent Trace Log */}
      {traces.length > 0 && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h4 className="text-xs font-semibold text-white/40 mb-3">Agent Trace Log</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
            {traces.map((trace, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2 px-3 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    trace.status === 'success'
                      ? 'bg-green-400'
                      : trace.status === 'retried'
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-white/60">{trace.agentName}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/25 uppercase tracking-wider">
                      {trace.role}
                    </span>
                    {trace.retryCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400/60">
                        {trace.retryCount} retry
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 mt-0.5 truncate">{trace.output}</p>
                </div>
                <span className="text-[10px] text-white/15 font-mono flex-shrink-0">
                  {trace.completedAt
                    ? `${((trace.completedAt - trace.startedAt) / 1000).toFixed(1)}s`
                    : '...'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
