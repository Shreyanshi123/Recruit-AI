export interface RadarScores {
  Python: number;
  APIs: number;
  Databases: number;
  System_Design: number;
  AI_Agents: number;
  [key: string]: number;
}

export interface GapAnalysisResult {
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
  radar_scores: RadarScores;
}

export interface EvidenceHeatmapRow {
  skill: string;
  status: 'MATCHED' | 'PARTIAL' | 'MISSING_GAP' | string;
  readiness_score: number;
  matched_keywords: string[];
  resume_citation: string;
  jd_citation: string;
  priority: 'CRITICAL' | 'MEDIUM' | 'VERIFIED' | string;
}

export interface CriterionBreakdownItem {
  criterion: string;
  score: number;
  max_score: number;
  status: 'PASS' | 'PARTIAL' | 'WARN' | 'FAIL' | string;
  reasoning: string;
}

export interface InterviewQuestion {
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  question_text: string;
  starter_code: string;
  test_code: string;
}

export interface RubricTelemetry {
  rubric_id: string;
  category: string;
  topic: string;
  rules: string;
  senior_bar: string;
  similarity_score: number;
  bm25_score?: number;
  vector_score?: number;
  rrf_score?: number;
  rerank_score?: number;
  matched_keywords?: string[];
}

export interface ASTAnalysisReport {
  syntax_valid: boolean;
  estimated_time_complexity: string;
  estimated_space_complexity: string;
  max_loop_nesting: number;
  cyclomatic_complexity: number;
  has_type_annotations: boolean;
  has_edge_case_guards: boolean;
  uses_hash_lookup: boolean;
  security_passed: boolean;
  security_warnings: string[];
  quality_signals: string[];
  syntax_error_detail?: string;
}

export interface TestCaseResult {
  id: number;
  assertion: string;
  passed: boolean;
  error: string;
  duration_ms: number;
}

export interface SandboxExecutionResult {
  passed: boolean;
  output: string;
  runtime_ms: number;
  test_cases: TestCaseResult[];
  ast_analysis: ASTAnalysisReport;
}

export interface EvaluationResult {
  technical_score: number;
  rubric_faithfulness: number;
  feedback: string;
  hint: string;
  golden_answer: string;
}

export interface AgentTraceStep {
  step: number;
  node_id: string;
  agent_name: string;
  role: string;
  status: string;
  latency_ms: number;
  summary: string;
}

export interface CommitteeTurnState {
  thread_id: string;
  checkpoint_id: string;
  topic: string;
  difficulty: string;
  question: InterviewQuestion;
  user_code: string;
  user_explanation: string;
  guardrail_report: {
    injection_passed: boolean;
    risk_score: number;
    detected_threats: Array<{ type: string; snippet: string }>;
    pii_redacted_count: number;
    pii_entities: string[];
  };
  rubric_used: string;
  rubric_telemetry: RubricTelemetry;
  sandbox_result: SandboxExecutionResult;
  evaluation: EvaluationResult;
  criterion_breakdown: CriterionBreakdownItem[];
  next_action: 'HINT_AND_RETRY' | 'ADVANCE_ROUND' | 'ESCALATE_SYSTEM_DESIGN' | string;
  next_difficulty: string;
  next_topic: string;
  committee_summary: string;
  followup_question: InterviewQuestion | null;
  trace_steps: AgentTraceStep[];
}

export interface TurnLedgerRow {
  id: number;
  session_id: number;
  created_at: string;
  topic: string;
  difficulty: string;
  question_text: string;
  user_code: string;
  user_explanation: string;
  sandbox_passed: number;
  sandbox_runtime_ms: number;
  sandbox_output: string;
  technical_score: number;
  rubric_faithfulness: number;
  feedback: string;
  hint: string;
  golden_answer: string;
  next_action: string;
}

export interface FineTuningSample {
  turn_id: number;
  timestamp: string;
  thread_id?: string;
  checkpoint_id?: string;
  pii_scrubbed?: boolean;
  topic: string;
  difficulty: string;
  candidate_score: number;
  rubric_faithfulness: number;
  ast_complexity?: string;
  next_action?: string;
  prompt: string;
  candidate_attempt: string;
  golden_answer: string;
  messages: Array<{ role: string; content: string }>;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  org_id: string;
  actor_role: string;
  action: string;
  detail: string;
}

export interface TelemetrySummary {
  total_turns: number;
  avg_technical_score: number;
  avg_faithfulness: number;
  pass_rate_pct: number;
  avg_runtime_ms: number;
  recent_turns: TurnLedgerRow[];
  finetuning_count: number;
  finetuning_samples: FineTuningSample[];
  audit_logs?: AuditLogEntry[];
}

export interface EnterpriseRubricItem {
  id: string;
  category: string;
  topic: string;
  rules: string;
  senior_bar: string;
}
