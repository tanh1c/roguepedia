import json

import pytest

from roguepedia.generation.llm_interface import LLMClient, LLMRequest, LLMResponse
from roguepedia.generation.llm_parser import parse_card_package_json
from roguepedia.generation.llm_prompt import build_card_generation_prompt
from roguepedia.generation.llm_retry import generate_with_repair
from roguepedia.schemas.character import CharacterStats, GameCharacter, ValidationReport


class FakeLLMClient(LLMClient):
    def __init__(self, responses: list[str]) -> None:
        self.responses = responses
        self.requests: list[LLMRequest] = []

    def complete(self, request: LLMRequest) -> LLMResponse:
        self.requests.append(request)
        return LLMResponse(text=self.responses.pop(0), model="fake")


def make_character() -> GameCharacter:
    return GameCharacter(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source={"wikidata_id": "Q9036", "wikidata_url": "https://www.wikidata.org/wiki/Q9036"},
        era="modern",
        character_class="scholar",
        role="support",
        domain="science",
        rarity="legendary",
        rarity_score=90.0,
        stats=CharacterStats(hp=55, attack=50, defense=50, speed=50, intelligence=80, influence=60, survival=50),
        tags=["science", "scholar", "support", "invention"],
        cards=[],
        passive_trait=None,
        lore="Nikola Tesla was an inventor and electrical engineer.",
        short_lore="inventor and electrical engineer",
        validation=ValidationReport(schema_valid=True, grounded=True, safety_valid=True),
    )


def valid_package_json() -> str:
    return json.dumps(
        {
            "cards": [
                {
                    "id": "Q9036-spark",
                    "owner_character_id": "Q9036",
                    "name": "Spark Gap",
                    "card_type": "attack",
                    "card_rarity": "basic",
                    "energy_cost": 1,
                    "description": "Channel invention into a focused strike.",
                    "mechanics_text": "Deal 8 damage.",
                    "mechanics": [
                        {"kind": "damage", "target": "selected_enemy", "amount": {"base": 8, "scaling_stat": "intelligence", "scaling_ratio": 0.1}}
                    ],
                    "targeting": "selected_enemy",
                    "grounding": {"inspired_by": "Nikola Tesla", "grounding_keywords": ["invention"]},
                }
            ],
            "passive_trait": {
                "id": "Q9036-passive",
                "owner_character_id": "Q9036",
                "name": "Alternating Current",
                "description": "Begin with extra focus.",
                "mechanics": [{"kind": "draw_cards", "target": "self", "amount": {"base": 1}}],
                "grounding": {"inspired_by": "Nikola Tesla", "grounding_keywords": ["invention"]},
            },
            "lore": "Tesla turns invention into battlefield control.",
            "short_lore": "Inventive electrical tactician.",
        }
    )


def test_prompt_lists_allowed_mechanics_and_character_context():
    prompt = build_card_generation_prompt(make_character())

    assert "Nikola Tesla" in prompt
    assert "Allowed mechanic kinds" in prompt
    assert "damage" in prompt
    assert "Return JSON only" in prompt


def test_parse_card_package_json_returns_cards_and_passive():
    package = parse_card_package_json(valid_package_json())

    assert len(package.cards) == 1
    assert package.cards[0].name == "Spark Gap"
    assert package.passive_trait.name == "Alternating Current"
    assert package.lore.startswith("Tesla")


def test_parse_card_package_json_rejects_invalid_json():
    with pytest.raises(ValueError, match="Invalid JSON"):
        parse_card_package_json("not json")


def test_generate_with_repair_retries_after_invalid_response():
    client = FakeLLMClient(["not json", valid_package_json()])

    package = generate_with_repair(client, make_character(), max_attempts=2)

    assert package.cards[0].name == "Spark Gap"
    assert len(client.requests) == 2
    assert "Previous response failed" in client.requests[1].prompt
