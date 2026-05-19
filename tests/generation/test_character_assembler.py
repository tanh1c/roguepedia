from roguepedia.generation.character_assembler import assemble_no_llm_character
from roguepedia.schemas.profile import EntityProfile, SourceInfo


def make_profile(**overrides) -> EntityProfile:
    data = {
        "id": "Q1",
        "name": "Example",
        "description": "",
        "entity_type": "human",
        "source": SourceInfo(wikidata_id="Q1", wikidata_url="https://www.wikidata.org/wiki/Q1"),
        "birth_year": None,
        "death_year": None,
        "wikipedia_summary": "",
        "wikipedia_extract": "",
        "claims_count": 10,
        "sitelinks_count": 5,
    }
    data.update(overrides)
    return EntityProfile(**data)


def test_assembles_sun_tzu_as_strategy_control_character():
    profile = make_profile(
        id="Q9312",
        name="Sun Tzu",
        description="Chinese military strategist",
        birth_year=-544,
        death_year=-496,
        wikipedia_summary="Author of The Art of War and a general known for strategy and tactics.",
        claims_count=120,
        sitelinks_count=90,
    )

    character = assemble_no_llm_character(profile)

    assert character.id == "Q9312"
    assert character.name == "Sun Tzu"
    assert character.era == "ancient"
    assert character.domain == "strategy"
    assert character.role == "control"
    assert character.character_class == "tactician"
    assert character.validation.schema_valid is True
    assert character.validation.safety_valid is True
    assert character.generation_metadata["llm_used"] is False
    assert character.generation_metadata["evidence"]["era"][0]["field"] == "birth_year"


def test_assembles_tardigrade_as_nature_survival_character():
    profile = make_profile(
        id="Q5194",
        name="Tardigrade",
        entity_type="organism",
        description="resilient microscopic animal",
        wikipedia_summary="Tardigrades survive extreme temperature, radiation, and dehydration.",
        claims_count=80,
        sitelinks_count=60,
    )

    character = assemble_no_llm_character(profile)

    assert character.domain == "nature"
    assert character.character_class == "survivor"
    assert character.role == "tank"
    assert character.stats.survival >= 75
    assert character.stats.defense >= 70
    assert "nature" in character.tags
    assert "survival" in character.tags
