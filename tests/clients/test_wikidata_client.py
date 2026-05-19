import httpx

from roguepedia.clients.wikidata_client import WikidataClient


def test_search_entities_returns_results():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["action"] == "wbsearchentities"
        return httpx.Response(
            200,
            json={
                "search": [
                    {
                        "id": "Q9036",
                        "label": "Nikola Tesla",
                        "description": "Serbian-American inventor and engineer",
                        "concepturi": "http://www.wikidata.org/entity/Q9036",
                    }
                ]
            },
        )

    client = WikidataClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    results = client.search_entities("Nikola Tesla")

    assert results[0].qid == "Q9036"
    assert results[0].label == "Nikola Tesla"
