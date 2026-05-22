from roguepedia.generation.card_templates import build_template_cards, build_template_deck_presets
from roguepedia.schemas.character import CharacterStats


def test_build_template_cards_uses_domain_pool_and_signature():
    cards = build_template_cards(
        character_id="Q9036",
        character_name="Nikola Tesla",
        domain="Electricity",
        character_class="Engineer",
        role="Control",
        stats=CharacterStats(hp=50, attack=50, defense=50, speed=50, intelligence=90, influence=70, survival=45),
        grounding_keywords=["electricity", "alternating current"],
        rarity="A",
        tags=["electricity", "technology", "engineer"],
    )

    assert len(cards) >= 6
    assert any(card.card_rarity == "signature" for card in cards)
    assert any("electric" in card.name.lower() or "shock" in card.mechanics_text.lower() for card in cards)


def test_build_template_cards_maps_game_rarity_to_pool_rarity():
    cards = build_template_cards(
        character_id="Q9036",
        character_name="Nikola Tesla",
        domain="Electricity",
        character_class="Engineer",
        role="Control",
        stats=CharacterStats(hp=50, attack=50, defense=50, speed=50, intelligence=90, influence=70, survival=45),
        grounding_keywords=["electricity", "alternating current"],
        rarity="rare",
        tags=["electricity", "technology", "engineer"],
    )

    assert len(cards) >= 6
    assert any(card.id.startswith("q9036-electricity_") for card in cards)
    assert any(card.id.startswith("q9036-signature-") for card in cards)


def test_science_scholar_cards_can_pull_technology_identity():
    cards = build_template_cards(
        character_id="Q9036",
        character_name="Nikola Tesla",
        domain="science",
        character_class="scholar",
        role="balanced",
        stats=CharacterStats(hp=50, attack=50, defense=50, speed=50, intelligence=90, influence=70, survival=45),
        grounding_keywords=["science", "scholar", "balanced"],
        rarity="rare",
        tags=["science", "scholar", "balanced"],
    )

    assert len(cards) >= 6
    assert any("technology" in card.id or "knowledge" in card.id or "current" in card.name.lower() for card in cards)
    assert any(card.id.startswith("q9036-signature-") for card in cards)


def test_build_template_deck_presets_wraps_core_deck():
    cards = build_template_cards(
        character_id="Q9036",
        character_name="Nikola Tesla",
        domain="Electricity",
        character_class="Engineer",
        role="Control",
        stats=CharacterStats(hp=50, attack=50, defense=50, speed=50, intelligence=90, influence=70, survival=45),
        grounding_keywords=["electricity", "alternating current"],
        rarity="legendary",
        tags=["electricity", "technology", "engineer"],
    )
    presets = build_template_deck_presets(
        character_id="Q9036",
        character_name="Nikola Tesla",
        domain="Electricity",
        character_class="Engineer",
        role="Control",
        stats=CharacterStats(hp=50, attack=50, defense=50, speed=50, intelligence=90, influence=70, survival=45),
        grounding_keywords=["electricity", "alternating current"],
        rarity="legendary",
        tags=["electricity", "technology", "engineer"],
    )

    assert len(presets) >= 3
    assert presets[0].id == "core"
    assert [card.id for card in presets[0].cards] == [card.id for card in cards]
    assert all(preset.description for preset in presets)
