import React from 'react';
import { TelemetrySummary } from '../../types/interview';

export type WorkspaceTab = 'studio' | 'gap_rag' | 'observability' | 'flywheel';

interface TopNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  telemetry: TelemetrySummary | null;
  onResetDemo: () => void;
  isBusy: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  telemetry,
  onResetDemo,
  isBusy,
}) => {
  const tabs: Array<{ id: WorkspaceTab; label: string; badge?: string }> = [
    { id: 'studio', label: '1. Autonomous Interview Studio', badge: 'LIVE IDE' },
    { id: 'gap_rag', label: '2. Resume Gap & ChromaDB Rubrics' },
    { id: 'observability', label: '3. LangGraph DAG & AST Telemetry' },
    {
      id: 'flywheel',
      label: '4. SFT / LoRA Data Flywheel',
      badge: `${telemetry?.finetuning_count ?? 0} JSONL`,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 font-black text-white tracking-tighter text-base">
            HR
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">HireRoom AI</span>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Enterprise v2.0
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                5-Agent LangGraph Committee
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Cross-Document Vector RAG • Static AST Complexity Analyzer • 3s Sandbox • Courtroom Judge • SFT Flywheel
            </p>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <nav className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-cyan-300 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Telemetry Counters & Export */}
        <div className="flex items-center gap-2.5">
          <div className="hidden 2xl:flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs">
            <div>
              <span className="text-slate-500 mr-1">Avg Score:</span>
              <span className="font-mono font-bold text-emerald-400">
                {telemetry?.avg_technical_score ?? 0}/10
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="text-slate-500 mr-1">Faithfulness:</span>
              <span className="font-mono font-bold text-cyan-400">
                {telemetry?.avg_faithfulness ?? 98}%
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={onResetDemo}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition disabled:opacity-50"
          >
            Reset Demo Profile
          </button>

          <a
            href="/api/export-jsonl"
            download="fine_tuning_dataset.jsonl"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5"
          >
            <span>⬇ Export SFT .JSONL</span>
          </a>
        </div>
      </div>
    </header>
  );
};

