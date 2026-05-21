import re
from dataclasses import dataclass
from html import unescape
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


@dataclass(frozen=True)
class WikipediaPageMetrics:
    title: str
    display_title: str | None
    html: str
    plain_text: str
    word_count: int
    article_length: int
    reference_count: int
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

    def get_page_metrics(self, title: str) -> WikipediaPageMetrics:
        response = self.http_client.get(
            f"{self._site_root()}/w/api.php",
            params={
                "action": "parse",
                "page": title,
                "prop": "text|sections|externallinks|revid|displaytitle",
                "format": "json",
                "formatversion": "2",
            },
            headers=self.headers,
        )
        response.raise_for_status()
        payload = response.json()
        parse = payload.get("parse", {})
        html = parse.get("text", "")
        plain_text = _html_to_text(html)
        return WikipediaPageMetrics(
            title=parse.get("title", title),
            display_title=parse.get("displaytitle"),
            html=html,
            plain_text=plain_text,
            word_count=_count_words(plain_text),
            article_length=len(plain_text),
            reference_count=_count_references(html, parse.get("externallinks", [])),
            raw=payload,
        )

    def _site_root(self) -> str:
        if self.api_base.endswith("/api/rest_v1"):
            return self.api_base[: -len("/api/rest_v1")]
        return self.api_base


def _html_to_text(html: str) -> str:
    text = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<ol[^>]*class=[\"'][^\"']*references[^\"']*[\"'][\s\S]*?</ol>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _count_words(text: str) -> int:
    return len(re.findall(r"[^\W\d_]+(?:[-'][^\W\d_]+)?", text, flags=re.UNICODE))


def _count_references(html: str, external_links: list[str]) -> int:
    cite_notes = re.findall(r"<li[^>]+id=[\"']cite_note-[^\"']+[\"']", html, flags=re.IGNORECASE)
    if cite_notes:
        return len(cite_notes)

    reference_texts = re.findall(r"class=[\"'][^\"']*reference-text[^\"']*[\"']", html, flags=re.IGNORECASE)
    if reference_texts:
        return len(reference_texts)

    mw_refs = re.findall(r"\bmw-ref\b", html, flags=re.IGNORECASE)
    if mw_refs:
        return len(mw_refs)

    return len(external_links)
