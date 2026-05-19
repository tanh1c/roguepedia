from roguepedia.generation.card_templates import build_template_cards, build_template_passive
from roguepedia.schemas.character import CharacterStats
from roguepedia.validation.mechanics_validator import validate_mechanics


def test_strategy_tactician_templates_include_executable_control_cards():
    stats = CharacterStats(hp=55, attack=50, defense=50, speed=55, intelligence=75, influence=65, survival=50)

    cards = build_template_cards(
        character_id="Q37151",
        character_name="Sun Tzu",
        domain="strategy",
        character_class="tactician",
        role="control",
        stats=stats,
        grounding_keywords=["strategy", "war"],
    )

    assert len(cards) >= 5
    assert {card.card_type for card in cards} >= {"attack", "skill", "power"}
    assert all(card.owner_character_id == "Q37151" for card in cards)
    assert all(validate_mechanics(card.mechanics) == [] for card in cards)
    assert any(mechanic.kind == "mark" for card in cards for mechanic in card.mechanics)


def test_nature_survivor_templates_include_defensive_cards():
    stats = CharacterStats(hp=70, attack=50, defense=75, speed=50, intelligence=50, influence=50, survival=90)

    cards = build_template_cards(
        character_id="Q5194",
        character_name="Tardigrade",
        domain="nature",
        character_class="survivor",
        role="tank",
        stats=stats,
        grounding_keywords=["nature", "survival"],
    )

    assert len(cards) >= 5
    assert all(validate_mechanics(card.mechanics) == [] for card in cards)
    assert any(mechanic.kind == "shield" for card in cards for mechanic in card.mechanics)
    assert any(mechanic.kind == "heal" for card in cards for mechanic in card.mechanics)


def test_template_passive_is_executable_and_grounded():
    passive = build_template_passive(
        character_id="Q5194",
        character_name="Tardigrade",
        domain="nature",
        character_class="survivor",
        role="tank",
        grounding_keywords=["survival"],
    )

    assert passive.owner_character_id == "Q5194"
    assert passive.mechanics
    assert validate_mechanics(passive.mechanics) == []
    assert passive.grounding.grounding_keywords == ["survival"]
