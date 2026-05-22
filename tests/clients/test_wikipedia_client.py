import httpx

from roguepedia.clients.wikipedia_client import WikipediaClient


def test_get_summary_returns_summary_payload():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).endswith("/page/summary/Nikola%20Tesla")
        assert "Roguepedia" in request.headers["user-agent"]
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


def test_get_page_metrics_counts_vietnamese_words_and_references():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith("https://vi.wikipedia.org/w/api.php")
        assert request.url.params["action"] == "parse"
        assert request.url.params["page"] == "Adolf Hitler"
        return httpx.Response(
            200,
            json={
                "parse": {
                    "title": "Adolf Hitler",
                    "displaytitle": "Adolf Hitler",
                    "revid": 123,
                    "text": """
                        <div><p>Adolf Hitler là một chính trị gia người Đức và lãnh tụ Đức Quốc xã.</p>
                        <p>Ông giữ vai trò trung tâm trong Chiến tranh thế giới thứ hai.</p>
                        <ol class="references">
                          <li id="cite_note-1"><span class="reference-text">Nguồn A</span></li>
                          <li id="cite_note-2"><span class="reference-text">Nguồn B</span></li>
                        </ol></div>
                    """,
                    "externallinks": ["https://example.test/a", "https://example.test/b"],
                }
            },
        )

    client = WikipediaClient(
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        api_base="https://vi.wikipedia.org/api/rest_v1",
    )

    page = client.get_page_metrics("Adolf Hitler")

    assert page.title == "Adolf Hitler"
    assert "chính trị gia" in page.plain_text
    assert page.word_count == 28
    assert page.reference_count == 2
    assert page.article_length == len(page.plain_text)
