from dataclasses import dataclass
from pathlib import Path
from typing import Any

from roguepedia.clients.wikidata_client import WikidataClient
from roguepedia.clients.wikipedia_client import WikipediaClient, WikipediaSummary
from roguepedia.config import settings
from roguepedia.storage.json_store import write_json


@dataclass(frozen=True)
class RawEntityResult:
    qid: str
    label: str
    wikidata: dict[str, Any]
    wikipedia: WikipediaSummary | None


class RawEntityCollector:
    def __init__(
        self,
        wikidata_client: WikidataClient | Any | None = None,
        wikipedia_client: WikipediaClient | Any | None = None,
        data_dir: Path | None = None,
    ) -> None:
        self.wikidata_client = wikidata_client or WikidataClient()
        self.wikipedia_client = wikipedia_client or WikipediaClient()
        self.data_dir = data_dir or settings.data_dir

    def collect_by_name(self, name: str, language: str = "en") -> RawEntityResult:
        results = self.wikidata_client.search_entities(name, language=language, limit=5)
        if not results:
            raise ValueError(f"No Wikidata entity found for {name!r}")

        selected = results[0]
        return self.collect_by_qid(selected.qid, label=selected.label, language=language)

    def collect_by_qid(self, qid: str, label: str | None = None, language: str = "en") -> RawEntityResult:
        wikidata = self.wikidata_client.get_entity(qid, language=language)
        title = label or self._label_from_entity(wikidata, language) or qid
        wikipedia = self.wikipedia_client.get_summary(title)
        page = self.wikipedia_client.get_page_metrics(wikipedia.title)
        wikipedia_raw = {
            "summary": wikipedia.raw,
            "page": page.raw,
            "metrics": {
                "word_count": page.word_count,
                "reference_count": page.reference_count,
                "article_length": page.article_length,
            },
        }

        write_json(self.data_dir / "raw" / "wikidata" / f"{qid}.json", wikidata)
        write_json(self.data_dir / "raw" / "wikipedia" / f"{qid}.json", wikipedia_raw)

        wikipedia_result = WikipediaSummary(
            title=wikipedia.title,
            extract=wikipedia.extract,
            url=wikipedia.url,
            image_url=wikipedia.image_url,
            raw=wikipedia_raw,
        )
        return RawEntityResult(qid=qid, label=title, wikidata=wikidata, wikipedia=wikipedia_result)

    def _label_from_entity(self, entity: dict[str, Any], language: str) -> str | None:
        return entity.get("labels", {}).get(language, {}).get("value")
