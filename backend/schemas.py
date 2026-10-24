from pydantic import BaseModel, Field
from typing import List, Optional


# 1. Blueprint for Resume vs. JD Skill Gap Chart
class GapAnalysisResult(BaseModel):
    match_percentage: int = Field(description="Overall match score from 0 to 100")
    matched_skills: List[str] = Field(description="Skills found in both Resume and JD")
    missing_skills: List[str] = Field(description="Skills in JD missing from Resume")
    radar_scores: dict = Field(description="5 categories scored 0-100: Python, APIs, Databases, System_Design, AI_Agents")


# 2. Blueprint for the Adaptive Interview Question
class InterviewQuestion(BaseModel):
    topic: str
    difficulty: str = Field(description="Easy, Medium, or Hard")
    question_text: str
    starter_code: str = Field(description="Clean Python function signature & docstring stub for the candidate to implement (NO solution code)")
    test_code: str = Field(description="Python assert statements to test the user's function")
    reference_solution: Optional[str] = Field(
        default="",
        description="Verified reference implementation used only by the Coach / Synthesizer after submission",
    )
    domain_category: Optional[str] = Field(
        default="Backend & Engineering",
        description="Domain category: Cloud & Kubernetes, AI & Retrieval, Backend & APIs, Data & Caching, or Algorithms",
    )
    interviewer_prompt: Optional[str] = Field(
        default="Walk through your implementation approach and how you handle edge cases.",
        description="Domain-specific conceptual follow-up question asked by the Interviewer",
    )
    evaluation_focus: Optional[str] = Field(
        default="Functional correctness, edge-case safety, and clean production code",
        description="What the Judge evaluates for this domain",
    )


# 3. Blueprint for the Silent Judge (Evaluation Harness)
class EvaluationResult(BaseModel):
    technical_score: int = Field(description="Score from 0 to 10")
    rubric_faithfulness: int = Field(description="Confidence 0-100% that grading followed the rubric without hallucinating")
    feedback: str = Field(description="Short punchy feedback on what worked or failed")
    hint: str = Field(description="Helpful hint if score < 6, otherwise empty")
    golden_answer: str = Field(description="The 10/10 senior-engineer code + explanation for Fine-Tuning dataset")
