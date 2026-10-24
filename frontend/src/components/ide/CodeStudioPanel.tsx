import React, { useState } from 'react';
import {
  InterviewQuestion,
  RubricTelemetry,
  SandboxExecutionResult,
  ASTAnalysisReport,
} from '../../types/interview';
import { TOPIC_OPTIONS } from '../../data/presets';

interface CodeStudioPanelProps {
  question: InterviewQuestion | null;
  activeRubric: string;
  rubricTelemetry: RubricTelemetry | null;
  userCode: string;
  testCode: string;
  explanation: string;
  selectedTopic: string;
  selectedDifficulty: string;
  onChangeTopic: (topic: string) => void;
  onChangeDifficulty: (diff: string) => void;
  onGenerateNewQuestion: () => void;
  onChangeCode: (code: string) => void;
  onChangeTestCode: (code: string) => void;
  onChangeExplanation: (exp: string) => void;
  onLoadWeakPreset: () => void;
  onLoadStrongPreset: () => void;
  onRunSandbox: () => void;
  onSubmitCommittee: () => void;
  isRunningSandbox: boolean;
  isSubmittingTurn: boolean;
  sandboxResult: SandboxExecutionResult | null;
  liveAstReport: ASTAnalysisReport | null;
}

type IdeTab = 'solution' | 'tests' | 'ast_audit' | 'rubric';

export const CodeStudioPanel: React.FC<CodeStudioPanelProps> = ({
  question,
  activeRubric,
  rubricTelemetry,
  userCode,
  testCode,
  explanation,
  selectedTopic,
  selectedDifficulty,
  onChangeTopic,
  onChangeDifficulty,
  onGenerateNewQuestion,
  onChangeCode,
  onChangeTestCode,
  onChangeExplanation,
  onLoadWeakPreset,
  onLoadStrongPreset,
  onRunSandbox,
  onSubmitCommittee,
  isRunningSandbox,
  isSubmittingTurn,
  sandboxResult,
  liveAstReport,
}) => {
  const [ideTab, setIdeTab] = useState<IdeTab>('solution');

  const ast = sandboxResult?.ast_analysis || liveAstReport;
  const lineCount = Math.max(12, userCode.split('\n').length);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = userCode.substring(0, start) + '    ' + userCode.substring(end);
      onChangeCode(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 shadow-xl flex flex-col gap-3.5 h-full">
      {/* Studio Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Agent 2 • Adaptive Challenge Architect &amp; 3s Sandbox
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                question?.difficulty === 'Hard'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : question?.difficulty === 'Easy'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {question?.difficulty || selectedDifficulty}
            </span>
          </div>
          <h2 className="text-sm font-bold text-white mt-0.5">
            {question?.topic || 'APIs & Distributed Rate Limiting'}
          </h2>
        </div>

        {/* Topic & Difficulty Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTopic}
            onChange={(e) => onChangeTopic(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {TOPIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => onChangeDifficulty(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <button
            type="button"
            onClick={onGenerateNewQuestion}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            ↻ Synthesize Prompt
          </button>
        </div>
      </div>

      {/* Problem Specification Card */}
      <div className="rounded-xl bg-slate-950/90 border border-slate-800/90 p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
            Challenge Specification &amp; SLA Constraints
          </span>
          {ast && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                AST Time: {ast.estimated_time_complexity}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Cyclomatic: {ast.cyclomatic_complexity}
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
          {question?.question_text || 'Loading challenge specification...'}
        </p>
      </div>

      {/* Multi-Tab IDE Header & Preset Simulation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'solution', label: '🐍 solution.py' },
            { id: 'tests', label: '🧪 test_suite.py (3 Asserts)' },
            { id: 'ast_audit', label: `🔬 AST Audit (${ast?.estimated_time_complexity || 'O(1)'})` },
            { id: 'rubric', label: '📚 ChromaDB Rubric' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setIdeTab(t.id as IdeTab)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                ideTab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onLoadWeakPreset}
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"
            title="Simulate struggling candidate (<6/10) to trigger LangGraph Hint & Retry Loop"
          >
            Simulate Weak Attempt (&lt;6)
          </button>
          <button
            type="button"
            onClick={onLoadStrongPreset}
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition"
            title="Simulate 10/10 Principal solution (>=8/10) to trigger LangGraph System Design Escalation"
          >
            Load 10/10 Solution (≥8)
          </button>
        </div>
      </div>

      {/* Multi-Tab IDE Content Area */}
      <div className="flex-1 min-h-[230px] flex flex-col">
        {ideTab === 'solution' && (
          <div className="flex-1 flex rounded-xl bg-slate-950 border border-slate-800 focus-within:border-cyan-500/70 overflow-hidden">
            {/* Line Numbers Gutter */}
            <div className="select-none bg-slate-900/60 border-r border-slate-800/80 px-2.5 py-3 text-right font-mono text-[11px] text-slate-600 leading-relaxed">
              {Array.from({ length: lineCount }).map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            <textarea
              value={userCode}
              onChange={(e) => onChangeCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              rows={11}
              className="w-full flex-1 bg-transparent p-3 font-mono text-xs text-emerald-300 focus:outline-none leading-relaxed resize-y"
              placeholder="# Write your Python implementation here..."
            />
          </div>
        )}

        {ideTab === 'tests' && (
          <div className="flex-1 flex flex-col gap-2 rounded-xl bg-slate-950 border border-slate-800 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Isolated Subprocess Assertion Suite (3-Second Timeout Guardrail)</span>
              <span className="text-amber-300">Deterministic Verification</span>
            </div>
            <textarea
              value={testCode}
              onChange={(e) => onChangeTestCode(e.target.value)}
              spellCheck={false}
              rows={8}
              className="w-full flex-1 bg-slate-900/50 rounded-lg border border-slate-800 p-3 font-mono text-xs text-amber-300 focus:outline-none leading-relaxed"
            />
          </div>
        )}

        {ideTab === 'ast_audit' && (
          <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Python `ast` Static Complexity &amp; Security Audit
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                  ast?.security_passed !== false
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {ast?.security_passed !== false ? 'SANDBOX POLICY: SAFE' : 'POLICY VIOLATION'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Time Complexity</div>
                <div className="text-sm font-bold text-indigo-300 mt-0.5">
                  {ast?.estimated_time_complexity || 'O(1)'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Space Complexity</div>
                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                  {ast?.estimated_space_complexity || 'O(N)'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Loop Nesting Depth</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {ast?.max_loop_nesting ?? 0} levels
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">O(1) Hash Lookup</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5">
                  {ast?.uses_hash_lookup ? 'Verified ✓' : 'Not Detected'}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400">Detected AST Signals:</div>
              {(ast?.quality_signals || []).map((sig, i) => (
                <div key={i} className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                  <span className="text-indigo-400">•</span>
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ideTab === 'rubric' && (
          <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300">
                {rubricTelemetry?.category || 'ChromaDB Active Grading Rubric'}
              </span>
              <span className="text-[11px] font-mono text-cyan-400">
                ID: {rubricTelemetry?.rubric_id || 'rubric_1'} • Similarity:{' '}
                {Math.round((rubricTelemetry?.similarity_score ?? 0.92) * 100)}%
              </span>
            </div>
            <p className="text-xs font-mono text-slate-200 leading-relaxed bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              {activeRubric}
            </p>
            {rubricTelemetry?.senior_bar && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-2.5">
                <strong>Principal Bar Requirement:</strong> {rubricTelemetry.senior_bar}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidate Architectural Explanation */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
          Candidate Architectural Rationale &amp; Complexity Tradeoffs
        </label>
        <input
          type="text"
          value={explanation}
          onChange={(e) => onChangeExplanation(e.target.value)}
          className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none px-3 py-2 text-xs text-slate-200"
          placeholder="Explain time/space complexity, hash-table lookups, and boundary guardrails..."
        />
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={isRunningSandbox || isSubmittingTurn}
          onClick={onRunSandbox}
          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs border border-cyan-500/30 transition disabled:opacity-50"
        >
          {isRunningSandbox
            ? '⏳ Executing in 3s Isolated Subprocess...'
            : '▶ Run Sandbox Suite & AST Audit (3s SLA)'}
        </button>

        <button
          type="button"
          disabled={isSubmittingTurn || isRunningSandbox}
          onClick={onSubmitCommittee}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
        >
          {isSubmittingTurn
            ? '⏳ 5-Agent LangGraph Committee Deliberating...'
            : '⚖️ Submit to Autonomous Hiring Committee'}
        </button>
      </div>

      {/* Per-Assertion Test Breakdown & Sandbox Terminal */}
      <div className="rounded-xl bg-black/85 border border-slate-800 p-3 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-[11px] text-slate-400 font-semibold">
            SUBPROCESS EXECUTION HARNESS &amp; PER-ASSERTION MATRIX
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {sandboxResult ? `${sandboxResult.runtime_ms} ms` : '0 ms'}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                !sandboxResult
                  ? 'bg-slate-800 text-slate-300'
                  : sandboxResult.passed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {!sandboxResult ? 'READY' : sandboxResult.passed ? 'ALL TESTS PASSED ✓' : 'ASSERTIONS FAILED ✗'}
            </span>
          </div>
        </div>

        {/* Individual Test Case Pills */}
        {sandboxResult?.test_cases && sandboxResult.test_cases.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {sandboxResult.test_cases.map((tc) => (
              <div
                key={tc.id}
                className={`p-2 rounded-lg border text-[11px] ${
                  tc.passed
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Test Case #{tc.id}</span>
                  <span>{tc.passed ? 'PASS ✓' : 'FAIL ✗'}</span>
                </div>
                <div className="truncate text-[10px] opacity-80 mt-0.5" title={tc.assertion}>
                  {tc.assertion}
                </div>
                {!tc.passed && tc.error && (
                  <div className="text-[10px] text-rose-300 mt-0.5 truncate">{tc.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
          {sandboxResult
            ? sandboxResult.output || 'ALL_TESTS_PASSED'
            : 'Ready to execute candidate solution inside 3-second isolated Python subprocess...'}
        </pre>
      </div>
    </div>
  );
};

