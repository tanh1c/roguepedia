from roguepedia.normalizers.wikidata_helpers import (
    claim_entity_ids,
    claim_time_years,
    english_aliases,
    english_description,
    english_label,
    sitelink_title,
)


def test_extracts_english_label_description_aliases_and_sitelink():
    entity = {
        "labels": {"en": {"value": "Nikola Tesla"}},
        "descriptions": {"en": {"value": "inventor and engineer"}},
        "aliases": {"en": [{"value": "Tesla"}, {"value": "Никола Тесла"}]},
        "sitelinks": {"enwiki": {"title": "Nikola Tesla"}},
    }

    assert english_label(entity) == "Nikola Tesla"
    assert english_description(entity) == "inventor and engineer"
    assert english_aliases(entity) == ["Tesla", "Никола Тесла"]
    assert sitelink_title(entity) == "Nikola Tesla"


def test_extracts_entity_ids_from_claims():
    entity = {
        "claims": {
            "P31": [
                {"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}},
                {"mainsnak": {"datavalue": {"value": {"id": "Q215627"}}}},
            ]
        }
    }

    assert claim_entity_ids(entity, "P31") == ["Q5", "Q215627"]


def test_extracts_years_from_time_claims():
    entity = {
        "claims": {
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1856-07-10T00:00:00Z"}}}}],
            "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1943-01-07T00:00:00Z"}}}}],
        }
    }

    assert claim_time_years(entity, "P569") == [1856]
    assert claim_time_years(entity, "P570") == [1943]
