import {
  GapAnalysisResult,
  InterviewQuestion,
  RubricTelemetry,
  SandboxExecutionResult,
  ASTAnalysisReport,
  CommitteeTurnState,
  TelemetrySummary,
  EnterpriseRubricItem,
} from '../types/interview';

export interface AnalyzeGapResponse {
  session_id: number;
  gap_analysis: GapAnalysisResult;
  initial_question: InterviewQuestion;
  active_rubric: string;
  rubric_telemetry: RubricTelemetry;
}

export interface GenerateQuestionResponse {
  question: InterviewQuestion;
  active_rubric: string;
  rubric_telemetry: RubricTelemetry;
}

export interface SubmitTurnResponse {
  state: CommitteeTurnState;
  ledger: {
    turn_id: number;
    flywheel_logged: boolean;
    jsonl_path: string;
  };
  telemetry: TelemetrySummary;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const hireRoomApi = {
  analyzeGap(resume_text: string, jd_text: string): Promise<AnalyzeGapResponse> {
    return requestJson<AnalyzeGapResponse>('/api/analyze-gap', {
      method: 'POST',
      body: JSON.stringify({ resume_text, jd_text }),
    });
  },

  generateQuestion(topic: string, difficulty: string): Promise<GenerateQuestionResponse> {
    return requestJson<GenerateQuestionResponse>('/api/generate-question', {
      method: 'POST',
      body: JSON.stringify({ topic, difficulty }),
    });
  },

  runSandbox(user_code: string, test_code: string): Promise<SandboxExecutionResult> {
    return requestJson<SandboxExecutionResult>('/api/run-sandbox', {
      method: 'POST',
      body: JSON.stringify({ user_code, test_code }),
    });
  },

  analyzeAst(user_code: string): Promise<ASTAnalysisReport> {
    return requestJson<ASTAnalysisReport>('/api/analyze-ast', {
      method: 'POST',
      body: JSON.stringify({ user_code }),
    });
  },

  submitTurn(
    session_id: number,
    question: InterviewQuestion,
    user_code: string,
    user_explanation: string
  ): Promise<SubmitTurnResponse> {
    return requestJson<SubmitTurnResponse>('/api/submit-turn', {
      method: 'POST',
      body: JSON.stringify({ session_id, question, user_code, user_explanation }),
    });
  },

  getTelemetry(): Promise<TelemetrySummary> {
    return requestJson<TelemetrySummary>('/api/telemetry');
  },

  getRubrics(): Promise<{ rubrics: EnterpriseRubricItem[] }> {
    return requestJson<{ rubrics: EnterpriseRubricItem[] }>('/api/rubrics');
  },
};

