"""
Code-similarity detection for assessment integrity.

Candidates who copy each other's work usually rename variables, reorder whitespace,
or tweak comments. Comparing raw text misses that. Instead we:

1. Parse the code into a Python AST.
2. Canonicalise it: every user-defined identifier (variables, args, function names)
   is replaced by a positional placeholder (v0, v1, ...), literals are kept, comments
   and docstrings vanish (they are not in the AST).
3. Compare the canonical token streams with difflib's SequenceMatcher.

Identical logic with renamed variables scores ~1.0; unrelated solutions to the same
problem typically score 0.3–0.7 because they share the function signature.
"""

from __future__ import annotations

import ast
import builtins
import difflib
from typing import Dict, List, Optional

_BUILTIN_NAMES = set(dir(builtins))


class _Canonicaliser(ast.NodeTransformer):
    def __init__(self) -> None:
        self.mapping: Dict[str, str] = {}

    def _alias(self, name: str) -> str:
        if name in _BUILTIN_NAMES:
            return name
        if name not in self.mapping:
            self.mapping[name] = f"v{len(self.mapping)}"
        return self.mapping[name]

    def visit_Name(self, node: ast.Name) -> ast.AST:
        node.id = self._alias(node.id)
        return node

    def visit_arg(self, node: ast.arg) -> ast.AST:
        node.arg = self._alias(node.arg)
        node.annotation = None
        return node

    def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.AST:
        # Keep the required function name (it's dictated by the question) but drop docstrings
        if node.body and isinstance(node.body[0], ast.Expr) and isinstance(
            getattr(node.body[0], "value", None), ast.Constant
        ) and isinstance(node.body[0].value.value, str):
            node.body = node.body[1:] or [ast.Pass()]
        node.returns = None
        self.generic_visit(node)
        return node


def canonical_tokens(code: str) -> Optional[List[str]]:
    """Return a canonical token stream for `code`, or None if it does not parse."""
    try:
        tree = ast.parse(code or "")
    except SyntaxError:
        return None
    tree = _Canonicaliser().visit(tree)
    ast.fix_missing_locations(tree)
    dumped = ast.dump(tree, annotate_fields=False, include_attributes=False)
    # Split into coarse tokens so SequenceMatcher works on structure, not characters
    for ch in "(),[]":
        dumped = dumped.replace(ch, f" {ch} ")
    return dumped.split()


def is_trivial(code: str) -> bool:
    """Starter stubs (just `pass`) should never be flagged as copies of each other."""
    toks = canonical_tokens(code)
    if toks is None:
        return True
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return True
    body_nodes = sum(1 for _ in ast.walk(tree))
    return body_nodes < 12


def code_similarity(code_a: str, code_b: str) -> float:
    """Structural similarity in [0, 1] between two Python solutions."""
    ta, tb = canonical_tokens(code_a), canonical_tokens(code_b)
    if ta is None or tb is None:
        # Fall back to plain text comparison for code that doesn't parse
        return difflib.SequenceMatcher(None, (code_a or "").split(), (code_b or "").split()).ratio()
    return difflib.SequenceMatcher(None, ta, tb, autojunk=False).ratio()

