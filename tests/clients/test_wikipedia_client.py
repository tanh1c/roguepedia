import httpx

from roguepedia.clients.wikipedia_client import WikipediaClient


def test_get_summary_returns_summary_payload():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).endswith("/page/summary/Nikola%20Tesla")
        return httpx.Response(
            200,
            json={
                "title": "Nikola Tesla",
                "extract": "Nikola Tesla was an inventor and electrical engineer.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Nikola_Tesla"}},
                "thumbnail": {"source": "https://example.test/tesla.jpg"},
            },
        )

    client = WikipediaClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = client.get_summary("Nikola Tesla")

    assert summary.title == "Nikola Tesla"
    assert "electrical engineer" in summary.extract
    assert summary.image_url == "https://example.test/tesla.jpg"
