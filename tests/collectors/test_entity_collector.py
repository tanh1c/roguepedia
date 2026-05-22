from pathlib import Path

from roguepedia.collectors.entity_collector import RawEntityCollector
from roguepedia.storage.json_store import read_json


class FakeWikidataClient:
    def search_entities(self, query: str, language: str = "en", limit: int = 5):
        return [type("Result", (), {"qid": "Q9036", "label": "Nikola Tesla"})()]

    def get_entity(self, qid: str, language: str = "en"):
        return {"id": qid, "labels": {"en": {"value": "Nikola Tesla"}}, "sitelinks": {}}


class FakeWikipediaClient:
    def get_summary(self, title: str):
        return type(
            "Summary",
            (),
            {
                "title": title,
                "extract": "Nikola Tesla was an inventor.",
                "url": "https://en.wikipedia.org/wiki/Nikola_Tesla",
                "image_url": None,
                "raw": {"title": title},
            },
        )()

    def get_page_metrics(self, title: str):
        return type(
            "PageMetrics",
            (),
            {
                "word_count": 1234,
                "reference_count": 12,
                "article_length": 6789,
                "raw": {"parse": {"title": title}},
            },
        )()


def test_collect_by_name_saves_raw_payloads(tmp_path: Path):
    collector = RawEntityCollector(
        wikidata_client=FakeWikidataClient(),
        wikipedia_client=FakeWikipediaClient(),
        data_dir=tmp_path,
    )

    result = collector.collect_by_name("Nikola Tesla")

    assert result.qid == "Q9036"
    assert result.wikipedia.raw["metrics"]["word_count"] == 1234
    assert (tmp_path / "raw" / "wikidata" / "Q9036.json").exists()
    assert (tmp_path / "raw" / "wikipedia" / "Q9036.json").exists()
    wikipedia_raw = read_json(tmp_path / "raw" / "wikipedia" / "Q9036.json")

    assert read_json(tmp_path / "raw" / "wikidata" / "Q9036.json")["id"] == "Q9036"
    assert wikipedia_raw["summary"]["title"] == "Nikola Tesla"
    assert wikipedia_raw["page"]["parse"]["title"] == "Nikola Tesla"
    assert wikipedia_raw["metrics"] == {"word_count": 1234, "reference_count": 12, "article_length": 6789}
