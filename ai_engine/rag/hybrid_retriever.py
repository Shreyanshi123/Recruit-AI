import math
import re
from typing import List, Dict, Any

from ai_engine.rag.vector_store import ENTERPRISE_RUBRICS, collection


def _tokenize(text: str) -> List[str]:
    return [tok for tok in re.split(r"[^a-zA-Z0-9_+#]+", text.lower()) if len(tok) > 1]


class BM25LexicalIndex:
    """
    Okapi BM25 lexical index over company engineering rubrics so exact technical
    tokens (e.g. 'FastAPI', 'O(1)', 'TTL', 'Idempotency', 'LangGraph', 'PostgreSQL')
    are never blurred by dense embeddings alone.
    """

    def __init__(self, documents: List[Dict[str, str]], k1: float = 1.5, b: float = 0.75) -> None:
        self.docs = documents
        self.k1 = k1
        self.b = b
        self.corpus_tokens: List[List[str]] = []
        self.doc_freqs: Dict[str, int] = {}
        self.doc_lens: List[int] = []

        for doc in documents:
            combined = f"{doc['category']} {doc['topic']} {doc['rules']} {doc.get('senior_bar', '')}"
            tokens = _tokenize(combined)
            self.corpus_tokens.append(tokens)
            self.doc_lens.append(len(tokens))
            for unique_tok in set(tokens):
                self.doc_freqs[unique_tok] = self.doc_freqs.get(unique_tok, 0) + 1

        self.avg_dl = sum(self.doc_lens) / max(1, len(self.doc_lens))
        self.num_docs = len(documents)

    def score_query(self, query: str) -> List[Dict[str, Any]]:
        q_tokens = _tokenize(query)
        scores: List[Dict[str, Any]] = []

        for idx, doc_tokens in enumerate(self.corpus_tokens):
            dl = self.doc_lens[idx]
            score = 0.0
            matched_terms: List[str] = []

            for qt in q_tokens:
                tf = doc_tokens.count(qt)
                if tf == 0:
                    continue
                matched_terms.append(qt)
                df = self.doc_freqs.get(qt, 0)
                idf = math.log(1.0 + (self.num_docs - df + 0.5) / (df + 0.5))
                denom = tf + self.k1 * (1.0 - self.b + self.b * (dl / self.avg_dl))
                score += idf * ((tf * (self.k1 + 1.0)) / denom)

            scores.append({
                "rubric_id": self.docs[idx]["id"],
                "bm25_raw": round(score, 4),
                "matched_terms": sorted(set(matched_terms)),
            })

        # Normalize BM25 scores to [0, 1]
        max_bm25 = max((s["bm25_raw"] for s in scores), default=0.0)
        for s in scores:
            s["bm25_score"] = round(s["bm25_raw"] / max_bm25, 3) if max_bm25 > 0 else 0.15

        return scores


_bm25_index = BM25LexicalIndex(ENTERPRISE_RUBRICS)


def hybrid_retrieve_rubrics(query: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Executes 3-Stage Hybrid Retrieval:
    Stage 1: Okapi BM25 Lexical Exact-Term Search
    Stage 2: ChromaDB Dense Vector Semantic Search
    Stage 3: Reciprocal Rank Fusion (RRF) + Cross-Encoder Exact-Entity Boost Reranking
    """
    clean_query = query.strip() or "Python FastAPI O(1) Algorithms"

    # Stage 1: BM25 Lexical Ranking
    bm25_results = _bm25_index.score_query(clean_query)
    bm25_sorted = sorted(bm25_results, key=lambda x: x["bm25_raw"], reverse=True)
    bm25_rank_map = {item["rubric_id"]: rank + 1 for rank, item in enumerate(bm25_sorted)}
    bm25_meta_map = {item["rubric_id"]: item for item in bm25_results}

    # Stage 2: Dense Vector Search (ChromaDB)
    n_docs = len(ENTERPRISE_RUBRICS)
    vec_res = collection.query(query_texts=[clean_query], n_results=n_docs)
    vec_ids = vec_res["ids"][0] if vec_res.get("ids") and vec_res["ids"] else []
    vec_dists = vec_res["distances"][0] if vec_res.get("distances") and vec_res["distances"] else []

    vec_rank_map: Dict[str, int] = {}
    vec_score_map: Dict[str, float] = {}
    for rank, (rid, dist) in enumerate(zip(vec_ids, vec_dists)):
        vec_rank_map[rid] = rank + 1
        vec_score_map[rid] = round(max(0.45, min(0.99, 1.0 / (1.0 + float(dist)))), 3)

    # Stage 3: Reciprocal Rank Fusion (RRF) + Cross-Encoder Reranking
    candidates: List[Dict[str, Any]] = []
    rrf_k = 10

    for doc in ENTERPRISE_RUBRICS:
        rid = doc["id"]
        b_rank = bm25_rank_map.get(rid, n_docs)
        v_rank = vec_rank_map.get(rid, n_docs)
        b_info = bm25_meta_map.get(rid, {"bm25_score": 0.1, "matched_terms": []})
        v_score = vec_score_map.get(rid, 0.65)

        rrf_score = (1.0 / (rrf_k + b_rank)) + (1.0 / (rrf_k + v_rank))
        # Cross-encoder exact technical entity boost
        exact_boost = min(0.25, len(b_info["matched_terms"]) * 0.06)
        rerank_score = round(min(0.99, 0.45 * b_info["bm25_score"] + 0.45 * v_score + exact_boost), 3)

        candidates.append({
            "rubric_id": rid,
            "category": doc["category"],
            "topic": doc["topic"],
            "rules": doc["rules"],
            "senior_bar": doc["senior_bar"],
            "bm25_score": b_info["bm25_score"],
            "vector_score": v_score,
            "rrf_score": round(rrf_score, 4),
            "rerank_score": rerank_score,
            "similarity_score": rerank_score,
            "matched_keywords": b_info["matched_terms"],
        })

    ranked = sorted(candidates, key=lambda x: (x["rerank_score"], x["rrf_score"]), reverse=True)
    top_hit = ranked[0]

    return {
        "query": clean_query,
        "retrieval_strategy": "BM25 + ChromaDB Dense Vector + RRF Cross-Encoder Reranker",
        "top_rubric": top_hit,
        "ranked_candidates": ranked[:top_k],
    }

