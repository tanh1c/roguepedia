from roguepedia.schemas.card import GroundingInfo, PassiveTrait
from roguepedia.schemas.character import CharacterStats, GameCharacter, ValidationReport


def test_game_character_minimal():
    character = GameCharacter(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source={"wikidata_id": "Q9036"},
        era="Modern",
        character_class="Engineer",
        role="Control",
        domain="Electricity",
        rarity="Legendary",
        rarity_score=82.0,
        stats=CharacterStats(
            hp=50,
            attack=50,
            defense=50,
            speed=50,
            intelligence=90,
            influence=70,
            survival=45,
        ),
        tags=["human", "engineer", "electricity"],
        cards=[],
        passive_trait=PassiveTrait(
            id="Q9036_passive",
            owner_character_id="Q9036",
            name="Inventive Spark",
            description="Technology cards gain focus.",
            grounding=GroundingInfo(inspired_by="Inventor and engineer.", grounding_keywords=["inventor"]),
        ),
        lore="A visionary engineer.",
        short_lore="Electricity-focused engineer.",
        validation=ValidationReport(schema_valid=True, grounded=True, balance_valid=True, safety_valid=True),
    )

    assert character.character_class == "Engineer"
