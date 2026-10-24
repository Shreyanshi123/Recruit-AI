import React, { useState } from 'react';
import { TelemetrySummary, FineTuningSample } from '../../types/interview';

interface FlywheelExplorerViewProps {
  telemetry: TelemetrySummary | null;
}

export const FlywheelExplorerView: React.FC<FlywheelExplorerViewProps> = ({ telemetry }) => {
  const samples = telemetry?.finetuning_samples || [];
  const [selectedSample, setSelectedSample] = useState<FineTuningSample | null>(
    samples[0] || null
  );

  const activeSample = selectedSample || samples[0] || null;

  return (
    <div className="space-y-5">
      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="text-xs text-slate-400">Total Committee Turns</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {telemetry?.total_turns ?? 0}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-mono">
            Persisted in SQLite Ledger
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="text-xs text-slate-400">Curated SFT / LoRA Triplets</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {telemetry?.finetuning_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            fine_tuning_dataset.jsonl
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="text-xs text-slate-400">Mean Technical Score</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {telemetry?.avg_technical_score ?? 0}/10
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Sandbox Pass Rate: {telemetry?.pass_rate_pct ?? 0}%
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="text-xs text-slate-400">Mean Rubric Faithfulness</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {telemetry?.avg_faithfulness ?? 98}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Avg Subprocess SLA: {telemetry?.avg_runtime_ms ?? 0} ms
          </div>
        </div>
      </div>

      {/* Main Split View: Dataset List & ChatML JSONL Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                SQLite &amp; JSONL Flywheel
              </span>
              <h3 className="text-sm font-bold text-white">
                Recorded Evaluation Triplets ({samples.length})
              </h3>
            </div>
            <a
              href="/api/export-jsonl"
              download="fine_tuning_dataset.jsonl"
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            >
              ⬇ Download .JSONL
            </a>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {samples.length === 0 ? (
              <div className="text-xs text-slate-400 p-4 text-center">
                No fine-tuning records yet. Submit a solution in the Interview Studio to populate the SFT flywheel.
              </div>
            ) : (
              samples.map((s) => {
                const isSelected = activeSample?.turn_id === s.turn_id;
                return (
                  <button
                    key={s.turn_id}
                    type="button"
                    onClick={() => setSelectedSample(s)}
                    className={`w-full text-left rounded-xl p-3 border transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/60'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">
                        Turn #{s.turn_id} • {s.topic}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {s.difficulty} • Faithfulness {s.rubric_faithfulness}% •{' '}
                        {s.ast_complexity || 'O(1)'}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        s.candidate_score >= 8
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : s.candidate_score >= 6
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {s.candidate_score}/10
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: ChatML / LoRA Fine-Tuning JSON Payload Inspector */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-3">
          <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
                HuggingFace / OpenAI ChatML SFT Schema
              </span>
              <h3 className="text-sm font-bold text-white">
                Triplet Inspector: (Prompt, Candidate Attempt, 10/10 Gold Standard)
              </h3>
            </div>
          </div>

          {activeSample ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <div className="text-[10px] font-mono text-indigo-400 font-bold mb-1">
                  1. PROMPT SPECIFICATION (USER ROLE)
                </div>
                <p className="text-xs text-slate-200 whitespace-pre-line">{activeSample.prompt}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                  <div className="text-[10px] font-mono text-amber-400 font-bold mb-1">
                    2. CANDIDATE ATTEMPT (SCORE: {activeSample.candidate_score}/10)
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {activeSample.candidate_attempt}
                  </pre>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                  <div className="text-[10px] font-mono text-emerald-400 font-bold mb-1">
                    3. SYNTHESIZED 10/10 GOLD TARGET (ASSISTANT ROLE)
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {activeSample.golden_answer}
                  </pre>
                </div>
              </div>

              <div className="rounded-xl bg-black/80 border border-slate-800 p-3">
                <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1">
                  RAW .JSONL RECORD (READY FOR LORA / DPO FINE-TUNING)
                </div>
                <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap max-h-44 overflow-y-auto">
                  {JSON.stringify(activeSample, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 p-6 text-center">
              Select a recorded turn to inspect its ChatML fine-tuning payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

