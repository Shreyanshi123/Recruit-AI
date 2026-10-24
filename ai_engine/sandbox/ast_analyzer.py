import ast
from dataclasses import dataclass, asdict
from typing import List


BANNED_MODULES = {"os", "subprocess", "sys", "shutil", "socket", "urllib", "requests", "http", "pathlib"}
BANNED_BUILTINS = {"eval", "exec", "compile", "__import__", "open"}


@dataclass
class ASTAnalysisReport:
    """Static AST code quality, complexity, and security audit report."""
    syntax_valid: bool
    estimated_time_complexity: str
    estimated_space_complexity: str
    max_loop_nesting: int
    cyclomatic_complexity: int
    has_type_annotations: bool
    has_edge_case_guards: bool
    uses_hash_lookup: bool
    security_passed: bool
    security_warnings: List[str]
    quality_signals: List[str]
    syntax_error_detail: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class _ComplexityVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.current_loop_depth = 0
        self.max_loop_depth = 0
        self.cyclomatic = 1
        self.has_type_hints = False
        self.has_edge_guards = False
        self.uses_hash_lookup = False
        self.security_warnings: List[str] = []
        self.function_names: List[str] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.function_names.append(node.name)
        if node.returns is not None or any(arg.annotation is not None for arg in node.args.args):
            self.has_type_hints = True
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.function_names.append(node.name)
        if node.returns is not None or any(arg.annotation is not None for arg in node.args.args):
            self.has_type_hints = True
        self.generic_visit(node)

    def _enter_loop(self, node: ast.AST) -> None:
        self.current_loop_depth += 1
        self.max_loop_depth = max(self.max_loop_depth, self.current_loop_depth)
        self.cyclomatic += 1
        self.generic_visit(node)
        self.current_loop_depth -= 1

    def visit_For(self, node: ast.For) -> None:
        self._enter_loop(node)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self._enter_loop(node)

    def visit_While(self, node: ast.While) -> None:
        self._enter_loop(node)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        depth = len(node.generators)
        self.max_loop_depth = max(self.max_loop_depth, self.current_loop_depth + depth)
        self.cyclomatic += depth
        self.generic_visit(node)

    def visit_SetComp(self, node: ast.SetComp) -> None:
        depth = len(node.generators)
        self.max_loop_depth = max(self.max_loop_depth, self.current_loop_depth + depth)
        self.cyclomatic += depth
        self.generic_visit(node)

    def visit_DictComp(self, node: ast.DictComp) -> None:
        depth = len(node.generators)
        self.max_loop_depth = max(self.max_loop_depth, self.current_loop_depth + depth)
        self.cyclomatic += depth
        self.uses_hash_lookup = True
        self.generic_visit(node)

    def visit_If(self, node: ast.If) -> None:
        self.cyclomatic += 1
        if isinstance(node.test, ast.UnaryOp) and isinstance(node.test.op, ast.Not):
            self.has_edge_guards = True
        elif isinstance(node.test, ast.BoolOp):
            self.cyclomatic += len(node.test.values) - 1
            self.has_edge_guards = True
        elif isinstance(node.test, ast.Compare):
            for op in node.test.ops:
                if isinstance(op, (ast.LtE, ast.Lt, ast.Is, ast.IsNot, ast.Eq)):
                    self.has_edge_guards = True
                if isinstance(op, (ast.In, ast.NotIn)):
                    self.uses_hash_lookup = True
        self.generic_visit(node)

    def visit_Compare(self, node: ast.Compare) -> None:
        for op in node.ops:
            if isinstance(op, (ast.In, ast.NotIn)):
                self.uses_hash_lookup = True
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            root_mod = alias.name.split(".")[0]
            if root_mod in BANNED_MODULES:
                self.security_warnings.append(f"Restricted module import blocked by sandbox policy: '{root_mod}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            root_mod = node.module.split(".")[0]
            if root_mod in BANNED_MODULES:
                self.security_warnings.append(f"Restricted module import blocked by sandbox policy: '{root_mod}'")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name):
            if node.func.id in BANNED_BUILTINS:
                self.security_warnings.append(f"Unsafe builtin call detected: '{node.func.id}()'")
            if node.func.id in {"set", "dict"}:
                self.uses_hash_lookup = True
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in {"get", "setdefault", "pop", "add"}:
                self.uses_hash_lookup = True
        self.generic_visit(node)


def analyze_code_ast(user_code: str) -> ASTAnalysisReport:
    """Performs deterministic AST static analysis on candidate Python code."""
    if not user_code or not user_code.strip():
        return ASTAnalysisReport(
            syntax_valid=False,
            estimated_time_complexity="N/A",
            estimated_space_complexity="N/A",
            max_loop_nesting=0,
            cyclomatic_complexity=0,
            has_type_annotations=False,
            has_edge_case_guards=False,
            uses_hash_lookup=False,
            security_passed=True,
            security_warnings=[],
            quality_signals=["Empty submission"],
            syntax_error_detail="No code provided.",
        )

    try:
        tree = ast.parse(user_code)
    except SyntaxError as exc:
        return ASTAnalysisReport(
            syntax_valid=False,
            estimated_time_complexity="SyntaxError",
            estimated_space_complexity="N/A",
            max_loop_nesting=0,
            cyclomatic_complexity=0,
            has_type_annotations=False,
            has_edge_case_guards=False,
            uses_hash_lookup=False,
            security_passed=True,
            security_warnings=[],
            quality_signals=[f"SyntaxError on line {exc.lineno}: {exc.msg}"],
            syntax_error_detail=f"Line {exc.lineno}: {exc.msg}",
        )

    visitor = _ComplexityVisitor()
    visitor.visit(tree)

    if visitor.max_loop_depth == 0:
        time_comp = "O(1)"
    elif visitor.max_loop_depth == 1:
        time_comp = "O(N)"
    elif visitor.max_loop_depth == 2:
        time_comp = "O(N²)"
    else:
        time_comp = f"O(N^{visitor.max_loop_depth})"

    space_comp = "O(N)" if visitor.uses_hash_lookup or visitor.max_loop_depth >= 1 else "O(1)"

    signals: List[str] = []
    if visitor.uses_hash_lookup:
        signals.append("O(1) Hash Map / Set membership lookup detected")
    if visitor.has_edge_guards:
        signals.append("Upfront boundary & empty-input guardrails verified")
    if visitor.has_type_hints:
        signals.append("PEP 484 Type Annotations present")
    if visitor.max_loop_depth >= 2:
        signals.append("Warning: Nested O(N²) iteration detected")
    if not visitor.has_edge_guards:
        signals.append("Missing explicit boundary / empty-input guardrails")

    return ASTAnalysisReport(
        syntax_valid=True,
        estimated_time_complexity=time_comp,
        estimated_space_complexity=space_comp,
        max_loop_nesting=visitor.max_loop_depth,
        cyclomatic_complexity=visitor.cyclomatic,
        has_type_annotations=visitor.has_type_annotations if hasattr(visitor, "has_type_annotations") else visitor.has_type_hints,
        has_edge_case_guards=visitor.has_edge_guards,
        uses_hash_lookup=visitor.uses_hash_lookup,
        security_passed=len(visitor.security_warnings) == 0,
        security_warnings=visitor.security_warnings,
        quality_signals=signals,
    )

