from typing import Literal

from pydantic import BaseModel, Field

ScalingStat = Literal["hp", "attack", "defense", "speed", "intelligence", "influence", "survival", "none"]
MechanicKind = Literal[
    "damage",
    "shield",
    "heal",
    "apply_status",
    "remove_status",
    "draw_cards",
    "gain_energy",
    "buff_stat",
    "debuff_stat",
    "mark",
    "move_position",
    "revive_once",
    "conditional",
]
CardType = Literal["attack", "skill", "power", "ultimate", "utility"]
CardRarity = Literal["basic", "common", "signature", "rare", "ultimate"]
Target = Literal[
    "self",
    "selected_enemy",
    "selected_ally",
    "front_enemy",
    "back_enemy",
    "adjacent_allies",
    "all_enemies",
    "all_allies",
    "lowest_hp_ally",
    "marked_enemy",
]


class CardAmount(BaseModel):
    base: int = 0
    scaling_stat: ScalingStat = "none"
    scaling_ratio: float = 0.0


class CardMechanic(BaseModel):
    kind: MechanicKind
    target: Target
    amount: CardAmount | None = None
    status: str | None = None
    duration: int | None = None
    condition: str | None = None


class GroundingInfo(BaseModel):
    inspired_by: str
    grounding_keywords: list[str] = Field(default_factory=list)


class Card(BaseModel):
    id: str
    owner_character_id: str
    name: str
    card_type: CardType
    card_rarity: CardRarity
    energy_cost: int = Field(ge=0, le=3)
    description: str
    mechanics_text: str
    mechanics: list[CardMechanic]
    targeting: Target | None = None
    exhaust: bool = False
    upgraded: bool = False
    grounding: GroundingInfo


class PassiveTrait(BaseModel):
    id: str
    owner_character_id: str
    name: str
    description: str
    mechanics: list[CardMechanic] = Field(default_factory=list)
    grounding: GroundingInfo
