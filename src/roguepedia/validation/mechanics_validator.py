from roguepedia.schemas.card import CardMechanic

NUMERIC_KINDS = {
    "damage",
    "shield",
    "heal",
    "draw_cards",
    "gain_energy",
    "buff_stat",
    "debuff_stat",
}
STATUS_KINDS = {"apply_status", "remove_status", "buff_stat", "debuff_stat"}
ENEMY_TARGETS = {"selected_enemy", "front_enemy", "back_enemy", "all_enemies", "marked_enemy"}
ALLY_TARGETS = {"self", "selected_ally", "adjacent_allies", "all_allies", "lowest_hp_ally"}


def validate_mechanic(mechanic: CardMechanic) -> list[str]:
    errors: list[str] = []

    if mechanic.kind in NUMERIC_KINDS and mechanic.amount is None:
        errors.append(f"{mechanic.kind} requires amount")
    if mechanic.kind in STATUS_KINDS and mechanic.status is None:
        errors.append(f"{mechanic.kind} requires status")
    if mechanic.kind == "apply_status" and mechanic.duration is None:
        errors.append("apply_status requires duration")
    if mechanic.kind == "conditional" and mechanic.condition is None:
        errors.append("conditional requires condition")
    if mechanic.kind in {"heal", "shield", "remove_status", "revive_once"} and mechanic.target in ENEMY_TARGETS:
        errors.append(f"{mechanic.kind} cannot target enemies")
    if mechanic.kind in {"damage", "debuff_stat", "mark"} and mechanic.target in ALLY_TARGETS:
        errors.append(f"{mechanic.kind} cannot target allies")

    return errors


def validate_mechanics(mechanics: list[CardMechanic]) -> list[str]:
    return [error for mechanic in mechanics for error in validate_mechanic(mechanic)]
