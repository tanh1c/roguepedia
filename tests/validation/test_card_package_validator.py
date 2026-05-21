from roguepedia.generation.character_assembler import assemble_no_llm_character_with_cards
from roguepedia.generation.llm_parser import CardPackage
from roguepedia.schemas.card import Card, CardAmount, CardMechanic, GroundingInfo, PassiveTrait
from roguepedia.schemas.character import CharacterStats, GameCharacter, ValidationReport
from roguepedia.validation.card_package_validator import apply_card_package, validate_card_package


def make_character() -> GameCharacter:
    return GameCharacter(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source={"wikidata_id": "Q9036", "wikidata_url": "https://www.wikidata.org/wiki/Q9036"},
        era="modern",
        character_class="scholar",
        role="support",
        domain="science",
        rarity="legendary",
        rarity_score=90.0,
        stats=CharacterStats(hp=55, attack=50, defense=50, speed=50, intelligence=80, influence=60, survival=50),
        tags=["science", "scholar", "support", "invention"],
        cards=[],
        passive_trait=None,
        lore="Nikola Tesla was an inventor and electrical engineer.",
        short_lore="inventor and electrical engineer",
        validation=ValidationReport(schema_valid=True, grounded=True, safety_valid=True),
    )


def make_package(keyword: str = "invention") -> CardPackage:
    return CardPackage(
        cards=[
            Card(
                id="Q9036-spark",
                owner_character_id="Q9036",
                name="Spark Gap",
                card_type="attack",
                card_rarity="basic",
                energy_cost=1,
                description="Channel invention into a focused strike.",
                mechanics_text="Deal 8 damage.",
                mechanics=[CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=8))],
                targeting="selected_enemy",
                grounding=GroundingInfo(inspired_by="Nikola Tesla", grounding_keywords=[keyword]),
            )
        ],
        passive_trait=PassiveTrait(
            id="Q9036-passive",
            owner_character_id="Q9036",
            name="Alternating Current",
            description="Begin with extra focus.",
            mechanics=[CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))],
            grounding=GroundingInfo(inspired_by="Nikola Tesla", grounding_keywords=[keyword]),
        ),
        lore="Tesla turns invention into battlefield control.",
        short_lore="Inventive electrical tactician.",
    )


def test_validates_grounded_mechanically_valid_package():
    report = validate_card_package(make_character(), make_package())

    assert report.schema_valid is True
    assert report.grounded is True
    assert report.mechanics_valid is True
    assert report.balance_valid is True
    assert report.safety_valid is True
    assert report.rejected_reasons == []


def test_accepts_grounding_keywords_backed_by_lore():
    report = validate_card_package(make_character(), make_package(keyword="electrical engineer"))

    assert report.grounded is True
    assert report.rejected_reasons == []


def test_accepts_grounding_keywords_with_lore_backed_terms():
    report = validate_card_package(make_character(), make_package(keyword="electrical spark"))

    assert report.grounded is True
    assert report.rejected_reasons == []


def test_accepts_keywords_backed_by_package_lore():
    package = make_package(keyword="battlefield")

    report = validate_card_package(make_character(), package)

    assert report.grounded is True
    assert report.rejected_reasons == []


def test_rejects_ungrounded_package_keywords():
    report = validate_card_package(make_character(), make_package(keyword="dragon"))

    assert report.grounded is False
    assert "ungrounded keyword: dragon" in report.rejected_reasons


def test_applies_valid_card_package_to_character():
    character = apply_card_package(make_character(), make_package())

    assert len(character.cards) == 1
    assert character.passive_trait is not None
    assert character.lore.startswith("Tesla")
    assert character.generation_metadata["llm_used"] is True


def test_uses_template_fallback_for_invalid_package():
    character = apply_card_package(make_character(), make_package(keyword="dragon"), fallback=True)

    assert len(character.cards) >= 5
    assert character.generation_metadata["llm_used"] is False
    assert character.generation_metadata["fallback_reason"] == "validation_failed"
