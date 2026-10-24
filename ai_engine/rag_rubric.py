import chromadb

# Initialize an in-memory Vector Database (ChromaDB)
client = chromadb.Client()
collection = client.get_or_create_collection(name="company_interview_rubrics")

# Private Company Grading Rubrics (The secret rules the AI Judge must follow)
RUBRICS = [
    {
        "id": "rubric_1",
        "topic": "APIs FastAPI Rate Limiting Backend",
        "rules": "RUBRIC [APIs & FastAPI]: 10/10 requires handling edge cases (empty inputs, rate limits, status codes) and O(1) dictionary lookups. Deduct 4 points if error handling is missing."
    },
    {
        "id": "rubric_2",
        "topic": "Caching Redis System Design Scalability",
        "rules": "RUBRIC [System Design & Caching]: Candidate must check cache before hitting DB (Cache-Aside pattern) and handle cache misses cleanly. Deduct 5 points for O(N) loops when O(1) dict lookup works."
    },
    {
        "id": "rubric_3",
        "topic": "AI Agents LangGraph RAG LLM Prompting",
        "rules": "RUBRIC [AI Agents & RAG]: Must enforce structured state transitions, retry loops on low confidence, and fallback handling when context is empty."
    },
    {
        "id": "rubric_4",
        "topic": "Python Data Structures Algorithms Lists Dictionaries",
        "rules": "RUBRIC [Python Core]: Code must pass all assert tests, avoid nested O(N^2) loops where a hash map/set works, and handle empty inputs safely."
    }
]

# Load rubrics into the Vector Database on startup
if collection.count() == 0:
    collection.add(
        ids=[r["id"] for r in RUBRICS],
        documents=[r["rules"] for r in RUBRICS],
        metadatas=[{"topic": r["topic"]} for r in RUBRICS]
    )

def retrieve_rubric(skill_or_topic: str) -> str:
    """Searches ChromaDB for the closest matching company grading rubric."""
    results = collection.query(query_texts=[skill_or_topic], n_results=1)
    if results["documents"] and results["documents"][0]:
        return results["documents"][0][0]
    return RUBRICS[3]["rules"]