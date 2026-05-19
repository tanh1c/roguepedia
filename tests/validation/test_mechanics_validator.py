import pytest

from roguepedia.schemas.card import CardAmount, CardMechanic
from roguepedia.validation.mechanics_validator import validate_mechanic, validate_mechanics


@pytest.mark.parametrize(
    ("kind", "target"),
    [
        ("damage", "selected_enemy"),
        ("shield", "self"),
        ("heal", "selected_ally"),
        ("apply_status", "selected_enemy"),
        ("remove_status", "selected_ally"),
        ("draw_cards", "self"),
        ("gain_energy", "self"),
        ("buff_stat", "self"),
        ("debuff_stat", "selected_enemy"),
        ("mark", "selected_enemy"),
        ("move_position", "selected_ally"),
        ("revive_once", "self"),
        ("conditional", "self"),
    ],
)
def test_accepts_supported_mechanic_kinds(kind: str, target: str):
    mechanic = CardMechanic(
        kind=kind,
        target=target,
        amount=CardAmount(base=1),
        status="focus" if kind in {"apply_status", "remove_status", "buff_stat", "debuff_stat"} else None,
        duration=2 if kind == "apply_status" else None,
        condition="if marked" if kind == "conditional" else None,
    )

    assert validate_mechanic(mechanic) == []


def test_requires_amount_for_numeric_mechanics():
    mechanic = CardMechanic(kind="damage", target="selected_enemy")

    assert validate_mechanic(mechanic) == ["damage requires amount"]


def test_requires_status_for_status_mechanics():
    mechanic = CardMechanic(kind="apply_status", target="selected_enemy", amount=CardAmount(base=1))

    assert validate_mechanic(mechanic) == ["apply_status requires status", "apply_status requires duration"]


def test_rejects_enemy_target_for_heal():
    mechanic = CardMechanic(kind="heal", target="selected_enemy", amount=CardAmount(base=4))

    assert validate_mechanic(mechanic) == ["heal cannot target enemies"]


def test_validate_mechanics_combines_errors():
    mechanics = [
        CardMechanic(kind="damage", target="selected_enemy"),
        CardMechanic(kind="heal", target="selected_enemy", amount=CardAmount(base=4)),
    ]

    assert validate_mechanics(mechanics) == ["damage requires amount", "heal cannot target enemies"]
