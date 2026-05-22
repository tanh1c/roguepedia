from typing import Any

from pydantic import BaseModel, Field

from roguepedia.schemas.source import SourceInfo


class EntityProfile(BaseModel):
    id: str
    name: str
    description: str | None = None
    entity_type: str
    source: SourceInfo

    aliases: list[str] = Field(default_factory=list)
    birth_year: int | None = None
    death_year: int | None = None
    active_years: list[int] = Field(default_factory=list)

    occupations: list[str] = Field(default_factory=list)
    fields: list[str] = Field(default_factory=list)
    notable_works: list[str] = Field(default_factory=list)
    awards: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)

    taxon_rank: str | None = None
    parent_taxa: list[str] = Field(default_factory=list)
    traits: list[str] = Field(default_factory=list)
    habitats: list[str] = Field(default_factory=list)

    wikipedia_summary: str | None = None
    wikipedia_extract: str | None = None
    wiki_word_count: int = 0
    wiki_reference_count: int = 0
    wiki_article_length: int = 0

    sitelinks_count: int = 0
    claims_count: int = 0
    instance_of_labels: list[str] = Field(default_factory=list)
    claim_labels: list[str] = Field(default_factory=list)
    is_living_person_candidate: bool = False

    raw_wikidata: dict[str, Any] = Field(default_factory=dict)
    raw_wikipedia: dict[str, Any] = Field(default_factory=dict)

    def source_text(self) -> str:
        parts = [
            self.name,
            self.description or "",
            " ".join(self.aliases),
            " ".join(self.occupations),
            " ".join(self.fields),
            " ".join(self.notable_works),
            " ".join(self.awards),
            " ".join(self.traits),
            " ".join(self.habitats),
            self.wikipedia_summary or "",
            self.wikipedia_extract or "",
        ]
        return "\n".join(part for part in parts if part)
