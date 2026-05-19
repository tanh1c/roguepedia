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


def test_get_entity_returns_entity_payload():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["action"] == "wbgetentities"
        assert request.url.params["ids"] == "Q9036"
        return httpx.Response(
            200,
            json={
                "entities": {
                    "Q9036": {
                        "id": "Q9036",
                        "labels": {"en": {"value": "Nikola Tesla"}},
                        "descriptions": {"en": {"value": "inventor and engineer"}},
                        "claims": {},
                        "sitelinks": {},
                    }
                }
            },
        )

    client = WikidataClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    entity = client.get_entity("Q9036")

    assert entity["id"] == "Q9036"
