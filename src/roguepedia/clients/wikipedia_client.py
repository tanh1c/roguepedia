from dataclasses import dataclass
from urllib.parse import quote

import httpx

from roguepedia.clients.wikidata_client import USER_AGENT
from roguepedia.config import settings


@dataclass(frozen=True)
class WikipediaSummary:
    title: str
    extract: str
    url: str | None
    image_url: str | None
    raw: dict


class WikipediaClient:
    def __init__(self, http_client: httpx.Client | None = None, api_base: str | None = None) -> None:
        self.http_client = http_client or httpx.Client(timeout=20.0)
        self.api_base = (api_base or settings.wikipedia_api_base).rstrip("/")
        self.headers = {"User-Agent": USER_AGENT}

    def get_summary(self, title: str) -> WikipediaSummary:
        response = self.http_client.get(
            f"{self.api_base}/page/summary/{quote(title)}",
            headers=self.headers,
        )
        response.raise_for_status()
        payload = response.json()
        return WikipediaSummary(
            title=payload.get("title", title),
            extract=payload.get("extract", ""),
            url=payload.get("content_urls", {}).get("desktop", {}).get("page"),
            image_url=payload.get("thumbnail", {}).get("source"),
            raw=payload,
        )
