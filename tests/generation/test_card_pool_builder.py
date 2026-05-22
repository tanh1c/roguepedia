from roguepedia.generation.card_pool_builder import CharacterCardProfile, build_deck_presets, build_pool_cards, select_pool_templates


def test_select_pool_templates_is_deterministic():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="A",
    )

    first = select_pool_templates(profile)
    second = select_pool_templates(profile)

    assert [card.id for card in first] == [card.id for card in second]
    assert len(first) >= 4


def test_select_pool_templates_matches_domain_or_tags():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="A",
    )

    selected = select_pool_templates(profile)

    assert any("electricity" in card.domains or "electricity" in card.tags for card in selected)


def test_low_rarity_does_not_select_s_only_cards():
    profile = CharacterCardProfile(
        character_id="common-creature",
        domain="Nature",
        role="Damage",
        character_class="Beast",
        tags=["nature"],
        rarity="D",
    )

    selected = select_pool_templates(profile)

    assert all(card.min_character_rarity in {"D"} for card in selected)


def test_build_pool_cards_sets_owner_and_grounding():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="A",
    )

    cards = build_pool_cards(profile, character_name="Nikola Tesla", grounding_keywords=["electricity"])

    assert cards
    assert all(card.owner_character_id == "Q9036" for card in cards)
    assert all(card.grounding.grounding_keywords == ["electricity"] for card in cards)


def test_build_pool_cards_scales_power_by_rarity():
    low = CharacterCardProfile(character_id="same", domain="Nature", role="Damage", character_class="Beast", tags=["nature"], rarity="D")
    high = CharacterCardProfile(character_id="same", domain="Nature", role="Damage", character_class="Beast", tags=["nature"], rarity="S")

    low_cards = build_pool_cards(low, character_name="Common Beast", grounding_keywords=["nature"], count=1)
    high_cards = build_pool_cards(high, character_name="Mythic Beast", grounding_keywords=["nature"], count=1)

    assert high_cards[0].mechanics[0].amount.base >= low_cards[0].mechanics[0].amount.base


def test_selected_cards_prioritize_mechanic_variety():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="S",
    )

    selected = select_pool_templates(profile)
    mechanic_kinds = {mechanic.kind for card in selected for mechanic in card.mechanics}
    card_types = {card.card_type for card in selected}

    assert len(selected) >= 7
    assert len(mechanic_kinds) >= 4
    assert len(card_types) >= 3


def test_generated_cards_have_mixed_names_for_same_domain():
    profile = CharacterCardProfile(
        character_id="electric-variety",
        domain="Electricity",
        role="Damage",
        character_class="Engineer",
        tags=["electricity", "technology", "inventor"],
        rarity="S",
    )

    cards = build_pool_cards(profile, character_name="Inventor", grounding_keywords=["electricity"])
    generic_suffix_names = [card.name for card in cards if card.name.endswith(("Strike", "Guard", "Pressure", "Insight", "Surge", "Formation", "Breakthrough"))]

    assert len(generic_suffix_names) < len(cards) // 2


def test_build_deck_presets_is_deterministic_and_distinct():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="S",
    )

    first = build_deck_presets(profile, character_name="Nikola Tesla", grounding_keywords=["electricity"])
    second = build_deck_presets(profile, character_name="Nikola Tesla", grounding_keywords=["electricity"])

    assert [preset.id for preset in first] == [preset.id for preset in second]
    assert len(first) >= 3
    assert {preset.archetype for preset in first}.issuperset({"balanced", "aggressive"})
    assert len({tuple(card.id for card in preset.cards) for preset in first}) == len(first)
    assert all(len({card.id for card in preset.cards}) == len(preset.cards) for preset in first)


def test_deck_presets_bias_mechanic_mix():
    profile = CharacterCardProfile(
        character_id="Q9036",
        domain="Electricity",
        role="Control",
        character_class="Engineer",
        tags=["electricity", "technology", "engineer"],
        rarity="S",
    )

    presets = {preset.archetype: preset for preset in build_deck_presets(profile, character_name="Nikola Tesla", grounding_keywords=["electricity"])}
    aggressive_kinds = [mechanic.kind for card in presets["aggressive"].cards for mechanic in card.mechanics]
    control_kinds = [mechanic.kind for card in presets["control"].cards for mechanic in card.mechanics]

    assert aggressive_kinds.count("damage") >= control_kinds.count("damage")
    assert any(kind in {"apply_status", "debuff_stat", "draw_cards"} for kind in control_kinds)
