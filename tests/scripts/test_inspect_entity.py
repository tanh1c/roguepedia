from scripts.inspect_entity import format_inspection


def test_format_inspection_includes_core_fields():
    text = format_inspection(
        qid="Q9036",
        label="Nikola Tesla",
        description="inventor and engineer",
        wikidata_url="https://www.wikidata.org/wiki/Q9036",
        wikipedia_url="https://en.wikipedia.org/wiki/Nikola_Tesla",
        summary="Nikola Tesla was an inventor and electrical engineer.",
        image_url="https://example.test/tesla.jpg",
    )

    assert "Q9036" in text
    assert "Nikola Tesla" in text
    assert "electrical engineer" in text
    assert "https://www.wikidata.org/wiki/Q9036" in text
