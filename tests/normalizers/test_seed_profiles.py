import json
from pathlib import Path

from roguepedia.normalizers.profile_normalizer import normalize_entity_profile


def load_fixture(name: str) -> dict:
    return json.loads((Path(__file__).parents[1] / "fixtures" / name).read_text(encoding="utf-8"))


def test_tesla_seed_fixture_normalizes_expected_profile():
    wikidata = load_fixture("raw_tesla_wikidata.json")
    wikipedia = load_fixture("raw_tesla_wikipedia.json")

    profile = normalize_entity_profile(wikidata, wikipedia)

    assert profile.id == "Q9036"
    assert profile.name == "Nikola Tesla"
    assert profile.entity_type == "human"
    assert profile.birth_year == 1856
    assert profile.death_year == 1943
    assert profile.source.wikipedia_title == "Nikola Tesla"
    assert profile.is_living_person_candidate is False
