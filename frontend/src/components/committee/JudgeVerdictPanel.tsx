import React, { useState } from 'react';
import { EvaluationResult, InterviewQuestion } from '../../types/interview';

interface JudgeVerdictPanelProps {
  evaluation: EvaluationResult | null;
  committeeSummary: string;
  followupQuestion: InterviewQuestion | null;
  onLoadFollowup: () => void;
  candidateCode: string;
}

export const JudgeVerdictPanel: React.FC<JudgeVerdictPanelProps> = ({
  evaluation,
  committeeSummary,
  followupQuestion,
  onLoadFollowup,
  candidateCode,
}) => {
  const [compareMode, setCompareMode] = useState<'gold' | 'diff'>('gold');
  const score = evaluation?.technical_score ?? null;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 shadow-xl flex flex-col gap-3.5 flex-1">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
            Agents 3 &amp; 4 • Silent Judge &amp; Staff Synthesizer
          </span>
          <h2 className="text-sm font-bold text-white">
            Deterministic Rubric Scorecard &amp; 10/10 Reference
          </h2>
        </div>
      </div>

      {/* Score & Rubric Faithfulness Gauges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Technical Score
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">ChromaDB + AST Verified</div>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              score === null
                ? 'text-slate-300'
                : score >= 8
                ? 'text-emerald-400'
                : score >= 6
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {score !== null ? score : '--'}
            <span className="text-xs text-slate-500">/10</span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Rubric Faithfulness
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Anti-Hallucination Audit</div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {evaluation ? `${evaluation.rubric_faithfulness}%` : '--%'}
          </div>
        </div>
      </div>

      {/* Judge Feedback & Coaching Hint */}
      <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
          Silent Judge Audit Report
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">
          {evaluation?.feedback ||
            'Submit your code to trigger the 5-member hiring committee evaluation pipeline.'}
        </p>

        {evaluation?.hint && (evaluation.technical_score ?? 10) < 6 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-200">
            <span className="font-bold text-amber-400">💡 Remediation Coaching Hint: </span>
            <span>{evaluation.hint}</span>
          </div>
        )}

        {committeeSummary && (
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-2.5 text-xs text-indigo-200 flex flex-wrap items-center justify-between gap-2">
            <span>{committeeSummary}</span>
            {followupQuestion && (
              <button
                type="button"
                onClick={onLoadFollowup}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition shrink-0"
              >
                Load Escalated Challenge ({followupQuestion.difficulty}) →
              </button>
            )}
          </div>
        )}
      </div>

      {/* 10/10 Gold Standard vs Candidate Code Comparison */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 font-mono">
            Synthesized 10/10 Principal Reference (LoRA / SFT Target)
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setCompareMode('gold')}
              className={`px-2 py-0.5 rounded ${
                compareMode === 'gold' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              10/10 Gold Answer
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('diff')}
              className={`px-2 py-0.5 rounded ${
                compareMode === 'diff' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Side-by-Side Diff
            </button>
          </div>
        </div>

        {compareMode === 'gold' ? (
          <pre className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {evaluation?.golden_answer ||
              '# Principal Engineer 10/10 reference solution will be synthesized here and appended to fine_tuning_dataset.jsonl upon submission.'}
          </pre>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono text-amber-400 mb-1 font-bold">
                CANDIDATE SUBMISSION
              </div>
              <pre className="font-mono text-[10px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {candidateCode}
              </pre>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
              <div className="text-[10px] font-mono text-emerald-400 mb-1 font-bold">
                10/10 PRINCIPAL GOLD TARGET
              </div>
              <pre className="font-mono text-[10px] text-emerald-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {evaluation?.golden_answer || '# Submit turn to synthesize gold target...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

