from roguepedia.normalizers.profile_normalizer import normalize_entity_profile


def test_normalizes_human_profile_from_raw_payloads():
    wikidata = {
        "id": "Q9036",
        "labels": {"en": {"value": "Nikola Tesla"}},
        "descriptions": {"en": {"value": "inventor and engineer"}},
        "aliases": {"en": [{"value": "Tesla"}]},
        "claims": {
            "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1856-07-10T00:00:00Z"}}}}],
            "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1943-01-07T00:00:00Z"}}}}],
        },
        "sitelinks": {"enwiki": {"title": "Nikola Tesla"}},
    }
    wikipedia = {
        "title": "Nikola Tesla",
        "extract": "Nikola Tesla was an inventor and electrical engineer.",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Nikola_Tesla"}},
        "thumbnail": {"source": "https://example.test/tesla.jpg"},
    }

    profile = normalize_entity_profile(wikidata, wikipedia)

    assert profile.id == "Q9036"
    assert profile.name == "Nikola Tesla"
    assert profile.entity_type == "human"
    assert profile.birth_year == 1856
    assert profile.death_year == 1943
    assert profile.source.wikipedia_title == "Nikola Tesla"
    assert profile.is_living_person_candidate is False


def test_flags_living_human_candidate():
    wikidata = {
        "id": "Q42",
        "labels": {"en": {"value": "Example Person"}},
        "claims": {
            "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1980-01-01T00:00:00Z"}}}}],
        },
        "sitelinks": {},
    }

    profile = normalize_entity_profile(wikidata, None)

    assert profile.is_living_person_candidate is True


def test_uses_wikipedia_sitelink_title_when_english_label_is_missing():
    wikidata = {
        "id": "Q7186",
        "labels": {},
        "descriptions": {"en": {"value": "Polish-French physicist and chemist"}},
        "claims": {
            "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1867-11-07T00:00:00Z"}}}}],
            "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1934-07-04T00:00:00Z"}}}}],
        },
        "sitelinks": {"enwiki": {"title": "Marie Curie"}},
    }

    profile = normalize_entity_profile(wikidata, None)

    assert profile.name == "Marie Curie"


def test_normalizes_wikipedia_article_metrics():
    wikidata = {
        "id": "Q1",
        "labels": {"en": {"value": "Example"}},
        "claims": {},
        "sitelinks": {"enwiki": {"title": "Example"}},
    }
    wikipedia = {
        "summary": {"title": "Example", "extract": "Short summary."},
        "metrics": {"word_count": 7200, "reference_count": 180, "article_length": 42000},
    }

    profile = normalize_entity_profile(wikidata, wikipedia)

    assert profile.wikipedia_summary == "Short summary."
    assert profile.wiki_word_count == 7200
    assert profile.wiki_reference_count == 180
    assert profile.wiki_article_length == 42000


def test_summary_only_wikipedia_payload_defaults_metrics_to_zero():
    wikidata = {
        "id": "Q1",
        "labels": {"en": {"value": "Example"}},
        "claims": {},
        "sitelinks": {"enwiki": {"title": "Example"}},
    }
    wikipedia = {"title": "Example", "extract": "Old summary shape."}

    profile = normalize_entity_profile(wikidata, wikipedia)

    assert profile.wikipedia_summary == "Old summary shape."
    assert profile.wiki_word_count == 0
    assert profile.wiki_reference_count == 0
    assert profile.wiki_article_length == 0
