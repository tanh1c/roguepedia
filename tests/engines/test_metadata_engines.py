from roguepedia.engines.class_engine import infer_character_class
from roguepedia.engines.domain_engine import infer_domain
from roguepedia.engines.era_engine import infer_era
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


def test_infers_ancient_era_from_birth_year():
    profile = make_profile(name="Sun Tzu", birth_year=-544, death_year=-496)

    result = infer_era(profile)

    assert result.value == "ancient"
    assert result.evidence[0].field == "birth_year"


def test_infers_modern_era_from_birth_year():
    profile = make_profile(name="Nikola Tesla", birth_year=1856, death_year=1943)

    result = infer_era(profile)

    assert result.value == "modern"
    assert result.evidence[0].field == "birth_year"


def test_infers_strategy_domain_from_source_text():
    profile = make_profile(
        name="Sun Tzu",
        description="Chinese military strategist",
        wikipedia_summary="Author of The Art of War and a general known for strategy.",
    )

    result = infer_domain(profile)

    assert result.value == "strategy"
    assert any(e.field == "source_text" for e in result.evidence)


def test_infers_nature_domain_for_organism():
    profile = make_profile(
        name="Tardigrade",
        entity_type="organism",
        description="microscopic animal",
        wikipedia_summary="Tardigrades are resilient animals found in moss and water.",
    )

    result = infer_domain(profile)

    assert result.value == "nature"
    assert any(e.field == "entity_type" for e in result.evidence)


def test_infers_scholar_class_for_science_profile():
    profile = make_profile(
        name="Marie Curie",
        description="physicist and chemist",
        wikipedia_summary="Scientist who studied radioactivity and won Nobel Prizes.",
    )

    result = infer_character_class(profile)

    assert result.value == "scholar"
    assert any(e.field == "source_text" for e in result.evidence)


def test_infers_survivor_class_for_resilient_organism():
    profile = make_profile(
        name="Tardigrade",
        entity_type="organism",
        description="resilient microscopic animal",
        wikipedia_summary="Tardigrades survive extreme temperature, radiation, and dehydration.",
    )

    result = infer_character_class(profile)

    assert result.value == "survivor"
    assert any(e.field == "source_text" for e in result.evidence)
