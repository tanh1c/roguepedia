from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    data_dir: Path = Field(default=Path("data"))
    wikidata_api_url: str = "https://www.wikidata.org/w/api.php"
    wikidata_sparql_url: str = "https://query.wikidata.org/sparql"
    wikipedia_api_base: str = "https://en.wikipedia.org/api/rest_v1"
    allow_living_people: bool = False
    llm_provider: str = "none"
    llm_model: str = ""
    llm_api_key: str = ""
    max_batch_size: int = 100
    cache_ttl_days: int = 30


settings = Settings()
