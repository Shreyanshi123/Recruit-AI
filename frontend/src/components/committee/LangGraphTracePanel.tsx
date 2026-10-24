import React from 'react';
import { AgentTraceStep } from '../../types/interview';

interface LangGraphTracePanelProps {
  nextAction: string;
  traceSteps: AgentTraceStep[];
  fullPage?: boolean;
}

export const LangGraphTracePanel: React.FC<LangGraphTracePanelProps> = ({
  nextAction,
  traceSteps,
  fullPage = false,
}) => {
  const isRetry = nextAction === 'HINT_AND_RETRY';
  const isEscalate = nextAction === 'ESCALATE_SYSTEM_DESIGN';
  const isAdvance = nextAction === 'ADVANCE_ROUND';

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 shadow-xl flex flex-col gap-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Agent 5 • LangGraph State Machine Orchestrator
          </span>
          <h2 className="text-sm font-bold text-white">
            Adaptive Traffic Controller &amp; APM Execution Trace
          </h2>
        </div>
        <span
          className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
            isEscalate
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : isRetry
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : isAdvance
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {nextAction || 'STANDBY'}
        </span>
      </div>

      {/* State Machine Conditional Branches */}
      <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
        <div
          className={`p-2.5 rounded-xl border transition-all ${
            isRetry
              ? 'bg-rose-500/20 border-rose-500 text-rose-200 shadow-lg shadow-rose-500/15'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <div className="font-bold text-rose-400">Score &lt; 6/10</div>
          <div className="text-[10px] mt-0.5">Hint &amp; Retry Loop</div>
        </div>

        <div
          className={`p-2.5 rounded-xl border transition-all ${
            isAdvance
              ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/15'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <div className="font-bold text-amber-400">Score 6–7/10</div>
          <div className="text-[10px] mt-0.5">Standard Advance</div>
        </div>

        <div
          className={`p-2.5 rounded-xl border transition-all ${
            isEscalate
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/15'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <div className="font-bold text-emerald-400">Score ≥ 8/10</div>
          <div className="text-[10px] mt-0.5">System Design Mode</div>
        </div>
      </div>

      {/* Distributed Agent Execution Spans */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>MULTI-AGENT DAG EXECUTION SPANS</span>
          <span>{traceSteps.length} Nodes Executed</span>
        </div>

        {traceSteps.length === 0 ? (
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-xs text-slate-400 font-mono">
            Submit a turn to inspect live LangGraph node transitions (rubric_rag → sandbox_harness → silent_judge → conditional_router).
          </div>
        ) : (
          <div className={`space-y-2 ${fullPage ? '' : 'max-h-48 overflow-y-auto pr-1'}`}>
            {traceSteps.map((step) => (
              <div
                key={step.step}
                className="rounded-xl bg-slate-950/90 border border-slate-800/90 p-2.5 flex flex-col gap-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold flex items-center justify-center">
                      {step.step}
                    </span>
                    <span className="font-bold text-slate-200">{step.agent_name}</span>
                    <span className="text-[10px] font-mono text-slate-500">({step.node_id})</span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400">{step.latency_ms} ms</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono pl-7">{step.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

