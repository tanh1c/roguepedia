from roguepedia.engines.class_engine import infer_character_class
from roguepedia.engines.domain_engine import infer_domain
from roguepedia.engines.era_engine import infer_era
from roguepedia.engines.rarity_engine import infer_rarity
from roguepedia.engines.role_engine import infer_role
from roguepedia.engines.stat_engine import infer_stats
from roguepedia.engines.tag_engine import infer_tags
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
        description="phylum of animals",
        wikipedia_summary="Tardigrades are water bears and moss piglets.",
    )

    result = infer_character_class(profile)

    assert result.value == "survivor"
    assert any(e.field == "entity_type" for e in result.evidence)


def test_infers_control_role_for_strategy_profile():
    profile = make_profile(description="military strategist", wikipedia_summary="Known for strategy and tactics.")

    result = infer_role(profile)

    assert result.value == "control"
    assert result.evidence


def test_infers_tank_role_for_organism_profile():
    profile = make_profile(entity_type="organism", description="phylum of animals")

    result = infer_role(profile)

    assert result.value == "tank"
    assert any(e.field == "entity_type" for e in result.evidence)


def test_rarity_scales_with_wikipedia_article_coverage():
    short_profile = make_profile(wiki_word_count=500, wiki_reference_count=3)
    medium_profile = make_profile(wiki_word_count=4800, wiki_reference_count=40)
    long_profile = make_profile(wiki_word_count=9000, wiki_reference_count=120)
    exceptional_profile = make_profile(wiki_word_count=17000, wiki_reference_count=180)

    assert infer_rarity(short_profile).value == "common"
    assert infer_rarity(medium_profile).value == "common"
    assert infer_rarity(long_profile).value == "uncommon"

    exceptional_result = infer_rarity(exceptional_profile)

    assert exceptional_result.value == "legendary"
    assert exceptional_result.score >= 92
    assert any(e.field == "wiki_word_count" for e in exceptional_result.evidence)


def test_stats_boost_intelligence_for_scholar_class():
    profile = make_profile(description="physicist scientist inventor")

    stats = infer_stats(profile, character_class="scholar", role="support", domain="science")

    assert stats.intelligence > stats.attack
    assert stats.intelligence >= 70


def test_stats_boost_survival_and_defense_for_survivor_tank():
    profile = make_profile(entity_type="organism", description="resilient animal survives extremes")

    stats = infer_stats(profile, character_class="survivor", role="tank", domain="nature")

    assert stats.survival >= 75
    assert stats.defense >= 70


def test_stats_scale_with_wikipedia_words_and_references():
    low_profile = make_profile(wiki_word_count=200, wiki_reference_count=1)
    high_profile = make_profile(wiki_word_count=10000, wiki_reference_count=160)

    low_stats = infer_stats(low_profile, character_class="scholar", role="support", domain="science")
    high_stats = infer_stats(high_profile, character_class="scholar", role="support", domain="science")

    assert sum(high_stats.model_dump().values()) > sum(low_stats.model_dump().values())
    assert high_stats.intelligence > low_stats.intelligence
    assert high_stats.influence > low_stats.influence


def test_tags_include_domain_class_and_source_keywords():
    profile = make_profile(
        name="Sun Tzu",
        description="Chinese military strategist",
        wikipedia_summary="The Art of War is about strategy and tactics.",
    )

    tags = infer_tags(profile, domain="strategy", character_class="tactician", role="control")

    assert tags[:3] == ["strategy", "tactician", "control"]
    assert "war" in tags
