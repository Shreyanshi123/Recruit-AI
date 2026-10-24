from fastapi import APIRouter
from pydantic import BaseModel

from ai_engine.sandbox.runner import execute_sandbox_suite
from ai_engine.sandbox.ast_analyzer import analyze_code_ast

router = APIRouter(prefix="/api", tags=["Execution Sandbox & AST Audit"])


class SandboxRunRequest(BaseModel):
    user_code: str
    test_code: str


class ASTAuditRequest(BaseModel):
    user_code: str


@router.post("/run-sandbox")
def run_sandbox_endpoint(req: SandboxRunRequest):
    return execute_sandbox_suite(req.user_code, req.test_code, timeout_sec=3)


@router.post("/analyze-ast")
def analyze_ast_endpoint(req: ASTAuditRequest):
    return analyze_code_ast(req.user_code).to_dict()

