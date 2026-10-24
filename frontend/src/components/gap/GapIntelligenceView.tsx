import React from 'react';
import {
  GapAnalysisResult,
  EnterpriseRubricItem,
  RubricTelemetry,
} from '../../types/interview';
import { RadarChartSvg } from './RadarChartSvg';

interface GapIntelligenceViewProps {
  resumeText: string;
  jdText: string;
  onChangeResume: (val: string) => void;
  onChangeJd: (val: string) => void;
  onAnalyzeGap: () => void;
  isAnalyzing: boolean;
  gapResult: GapAnalysisResult | null;
  rubrics: EnterpriseRubricItem[];
  activeRubricTelemetry: RubricTelemetry | null;
  onSelectMissingSkill: (skill: string) => void;
  compact?: boolean;
}

export const GapIntelligenceView: React.FC<GapIntelligenceViewProps> = ({
  resumeText,
  jdText,
  onChangeResume,
  onChangeJd,
  onAnalyzeGap,
  isAnalyzing,
  gapResult,
  rubrics,
  activeRubricTelemetry,
  onSelectMissingSkill,
  compact = false,
}) => {
  const defaultRadar = {
    Python: 82,
    APIs: 74,
    Databases: 68,
    System_Design: 48,
    AI_Agents: 64,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Resume vs JD Input Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 shadow-xl flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
              Agent 1 • Skill Gap Detective
            </span>
            <h2 className="text-sm font-bold text-white">Cross-Document Resume vs. JD Mapper</h2>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {gapResult ? `${gapResult.match_percentage}% Match` : '--% Match'}
          </span>
        </div>

        <div className={compact ? 'space-y-2.5' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Candidate Engineering Resume
            </label>
            <textarea
              rows={compact ? 4 : 8}
              value={resumeText}
              onChange={(e) => onChangeResume(e.target.value)}
              className="w-full rounded-xl bg-slate-950/90 border border-slate-800 focus:border-indigo-500 focus:outline-none p-2.5 text-xs text-slate-200 font-mono leading-relaxed resize-y"
              placeholder="Paste candidate resume..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Target Job Description (Staff / Senior Bar)
            </label>
            <textarea
              rows={compact ? 4 : 8}
              value={jdText}
              onChange={(e) => onChangeJd(e.target.value)}
              className="w-full rounded-xl bg-slate-950/90 border border-slate-800 focus:border-indigo-500 focus:outline-none p-2.5 text-xs text-slate-200 font-mono leading-relaxed resize-y"
              placeholder="Paste target job description..."
            />
          </div>
        </div>

        <button
          type="button"
          disabled={isAnalyzing}
          onClick={onAnalyzeGap}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
        >
          {isAnalyzing
            ? '⏳ Running Cross-Document Vector Embeddings & Gap Analysis...'
            : '🔍 Run Cross-Document Gap Analysis & Generate Adaptive Challenge'}
        </button>
      </div>

      {/* 5-Axis Competency Radar & Interactive Skill Pills */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              5-Axis Competency Radar
            </h3>
            <p className="text-[11px] text-slate-400">
              Pydantic v2 Validated Readiness Profile
            </p>
          </div>
          {activeRubricTelemetry && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Cosine Sim: {Math.round(activeRubricTelemetry.similarity_score * 100)}%
            </span>
          )}
        </div>

        <div className="py-1 flex items-center justify-center">
          <RadarChartSvg scores={gapResult?.radar_scores || defaultRadar} size={compact ? 235 : 280} />
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 mb-1.5 flex items-center justify-between">
              <span>✓ Verified Resume Competencies</span>
              <span className="text-[10px] font-mono text-slate-400">
                {gapResult?.matched_skills?.length ?? 0} matched
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(gapResult?.matched_skills || []).map((skill) => (
                <span
                  key={skill}
                  className="text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-amber-400 mb-1.5 flex items-center justify-between">
              <span>⚡ Target JD Skill Gaps (Click to Launch Challenge)</span>
              <span className="text-[10px] font-mono text-slate-400">
                {gapResult?.missing_skills?.length ?? 0} gaps
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(gapResult?.missing_skills || []).map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => onSelectMissingSkill(skill)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium transition flex items-center gap-1"
                >
                  <span>🎯 {skill}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ChromaDB Enterprise Rubric Catalog (Shown in Full Tab View) */}
      {!compact && rubrics.length > 0 && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                ChromaDB Vector Collection • enterprise_interview_rubrics_v2
              </span>
              <h3 className="text-sm font-bold text-white">
                Indexed Private Engineering Grading Rubrics ({rubrics.length})
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rubrics.map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-300">{r.category}</span>
                    <span className="text-[10px] font-mono text-slate-500">{r.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono leading-relaxed">{r.rules}</p>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[10px] text-emerald-400">
                  <strong>Principal Bar:</strong> {r.senior_bar}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

