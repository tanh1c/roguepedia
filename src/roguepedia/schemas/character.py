from pydantic import BaseModel, Field

from roguepedia.schemas.card import Card, PassiveTrait


class CharacterStats(BaseModel):
    hp: int = Field(ge=20, le=100)
    attack: int = Field(ge=20, le=100)
    defense: int = Field(ge=20, le=100)
    speed: int = Field(ge=20, le=100)
    intelligence: int = Field(ge=20, le=100)
    influence: int = Field(ge=20, le=100)
    survival: int = Field(ge=20, le=100)


class ValidationReport(BaseModel):
    schema_valid: bool = False
    grounded: bool = False
    mechanics_valid: bool = False
    balance_valid: bool = False
    safety_valid: bool = False
    warnings: list[str] = Field(default_factory=list)
    rejected_reasons: list[str] = Field(default_factory=list)


class GameCharacter(BaseModel):
    id: str
    name: str
    entity_type: str
    source: dict
    image_url: str | None = None

    era: str
    character_class: str
    role: str
    domain: str
    rarity: str
    rarity_score: float

    stats: CharacterStats
    tags: list[str]
    cards: list[Card]
    passive_trait: PassiveTrait | None = None

    lore: str
    short_lore: str
    validation: ValidationReport
    generation_metadata: dict = Field(default_factory=dict)
