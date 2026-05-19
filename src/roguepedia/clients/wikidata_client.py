from dataclasses import dataclass
from typing import Any

import httpx

from roguepedia.config import settings


@dataclass(frozen=True)
class WikidataSearchResult:
    qid: str
    label: str
    description: str | None
    url: str


class WikidataClient:
    def __init__(self, http_client: httpx.Client | None = None, api_url: str | None = None) -> None:
        self.http_client = http_client or httpx.Client(timeout=20.0)
        self.api_url = api_url or settings.wikidata_api_url

    def search_entities(self, query: str, language: str = "en", limit: int = 5) -> list[WikidataSearchResult]:
        response = self.http_client.get(
            self.api_url,
            params={
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "format": "json",
                "limit": limit,
            },
        )
        response.raise_for_status()
        payload = response.json()
        return [self._parse_search_result(item) for item in payload.get("search", [])]

    def _parse_search_result(self, item: dict[str, Any]) -> WikidataSearchResult:
        qid = item["id"]
        return WikidataSearchResult(
            qid=qid,
            label=item.get("label", qid),
            description=item.get("description"),
            url=f"https://www.wikidata.org/wiki/{qid}",
        )
