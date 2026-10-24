import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@dataclass(frozen=True)
class Settings:
    """Enterprise application configuration for HireRoom AI."""
    app_name: str = "HireRoom AI — Autonomous Technical Hiring Committee"
    app_version: str = "2.0.0"
    environment: str = os.getenv("ENVIRONMENT", "production")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    sandbox_timeout_sec: int = int(os.getenv("SANDBOX_TIMEOUT_SEC", "3"))
    db_path: str = os.getenv("RECRUITAI_DB_PATH", os.path.join(BASE_DIR, "hireroom_ledger.db"))
    jsonl_path: str = os.path.join(BASE_DIR, "fine_tuning_dataset.jsonl")
    frontend_dist_dir: str = os.path.join(BASE_DIR, "frontend", "dist")
    cors_origins: list[str] = field(default_factory=lambda: ["*"])

    @property
    def sqlite_db_path(self) -> str:
        return self.db_path

    @property
    def is_llm_configured(self) -> bool:
        return bool(
            self.gemini_api_key
            and "your_free" not in self.gemini_api_key
            and self.gemini_api_key.startswith("AIza")
        )


settings = Settings()

