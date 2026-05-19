from roguepedia.schemas.card import CardRarity, CardType, MechanicKind, Target
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
ALLOWED_TARGETS: list[Target] = [
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
ALLOWED_CARD_TYPES: list[CardType] = ["attack", "skill", "power", "ultimate", "utility"]
ALLOWED_CARD_RARITIES: list[CardRarity] = ["basic", "common", "signature", "rare", "ultimate"]


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
        f"Allowed targets: {', '.join(ALLOWED_TARGETS)}",
        f"Allowed card types: {', '.join(ALLOWED_CARD_TYPES)}",
        f"Allowed card rarities: {', '.join(ALLOWED_CARD_RARITIES)}",
        f"Allowed statuses: {', '.join(ALLOWED_STATUSES)}",
        "Do not invent enum values. Use selected_enemy, not enemy_single. Use all_enemies, not enemy_all.",
        "Every card and passive_trait grounding must be an object, not a string.",
        f"Example grounding object: \"grounding\": {{\"inspired_by\": \"{character.name}\", \"grounding_keywords\": [\"{character.tags[0]}\"]}}",
        "Create exactly 5 cards and 1 passive_trait. energy_cost must be 0, 1, 2, or 3.",
        "Mechanics must use the schema exactly.",
    ]
    if repair_note:
        lines.append(f"Previous response failed: {repair_note}")
    return "\n".join(lines)
