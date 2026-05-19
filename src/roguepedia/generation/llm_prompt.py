from roguepedia.schemas.card import MechanicKind
from roguepedia.schemas.character import GameCharacter

ALLOWED_STATUSES = ["focus", "resilience", "vulnerable", "marked", "inspired"]
ALLOWED_MECHANICS: list[MechanicKind] = [
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


def build_card_generation_prompt(character: GameCharacter, repair_note: str | None = None) -> str:
    lines = [
        "Generate a grounded Roguepedia card package.",
        "Return JSON only with keys: cards, passive_trait, lore, short_lore.",
        f"Character: {character.name}",
        f"Class: {character.character_class}",
        f"Domain: {character.domain}",
        f"Role: {character.role}",
        f"Tags: {', '.join(character.tags)}",
        f"Lore source: {character.lore}",
        f"Allowed mechanic kinds: {', '.join(ALLOWED_MECHANICS)}",
        f"Allowed statuses: {', '.join(ALLOWED_STATUSES)}",
        "Create 5 cards and 1 passive_trait. Mechanics must use the schema exactly.",
    ]
    if repair_note:
        lines.append(f"Previous response failed: {repair_note}")
    return "\n".join(lines)
