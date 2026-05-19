from pydantic import BaseModel


class SourceInfo(BaseModel):
    wikidata_id: str
    wikidata_url: str
    wikipedia_title: str | None = None
    wikipedia_url: str | None = None
    image_url: str | None = None
    language: str = "en"
