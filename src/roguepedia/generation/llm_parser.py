import json
import re
from numbers import Number

from pydantic import BaseModel, ValidationError

from roguepedia.schemas.card import Card, PassiveTrait


class CardPackage(BaseModel):
    cards: list[Card]
    passive_trait: PassiveTrait
    lore: str
    short_lore: str


TARGET_ALIASES = {
    "enemy_single": "selected_enemy",
    "enemy_all": "all_enemies",
}
DEFAULT_AMOUNTS = {
    "damage": 6,
    "shield": 6,
    "heal": 5,
    "draw_cards": 1,
    "gain_energy": 1,
    "buff_stat": 1,
    "debuff_stat": 1,
}


def normalize_card_package_payload(payload: dict) -> dict:
    for index, card in enumerate(payload.get("cards", [])):
        normalize_card(card, payload, index)
        normalize_grounding(card)
        normalize_mechanics(card.get("mechanics", []))

    passive_trait = payload.get("passive_trait")
    if isinstance(passive_trait, dict):
        normalize_passive_trait(passive_trait, payload)
        normalize_grounding(passive_trait)
        normalize_mechanics(passive_trait.get("mechanics", []))

    return payload


def normalize_card(card: dict, payload: dict, index: int) -> None:
    name = card.get("name", f"Card {index + 1}")
    owner_character_id = card.get("owner_character_id") or payload.get("owner_character_id") or payload.get("character_id") or "generated"
    card.setdefault("id", f"{owner_character_id}-{slugify(name)}")
    card.setdefault("owner_character_id", owner_character_id)
    if "card_type" not in card and "type" in card:
        card["card_type"] = card["type"]
    if "card_rarity" not in card and "rarity" in card:
        card["card_rarity"] = card["rarity"]
    card.setdefault("card_type", "skill")
    card.setdefault("card_rarity", "common")
    card.setdefault("energy_cost", 1)
    card.setdefault("description", card.get("mechanics_text") or name)
    card.setdefault("mechanics_text", card.get("description") or name)


def normalize_passive_trait(passive_trait: dict, payload: dict) -> None:
    name = passive_trait.get("name", "Passive Trait")
    owner_character_id = passive_trait.get("owner_character_id") or payload.get("owner_character_id") or payload.get("character_id") or "generated"
    passive_trait.setdefault("id", f"{owner_character_id}-{slugify(name)}")
    passive_trait.setdefault("owner_character_id", owner_character_id)
    passive_trait.setdefault("description", name)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "generated"


def normalize_grounding(owner: dict) -> None:
    grounding = owner.get("grounding")
    if isinstance(grounding, str):
        owner["grounding"] = {"inspired_by": grounding, "grounding_keywords": []}


def normalize_mechanics(mechanics: list) -> None:
    for mechanic in mechanics:
        if not isinstance(mechanic, dict):
            continue
        if mechanic.get("target") in TARGET_ALIASES:
            mechanic["target"] = TARGET_ALIASES[mechanic["target"]]
        if mechanic.get("kind") == "conditional" and "target" not in mechanic:
            mechanic["target"] = "self"
        if mechanic.get("kind") in {"buff_stat", "debuff_stat"} and "status" not in mechanic and "stat" in mechanic:
            mechanic["status"] = mechanic["stat"]
        if mechanic.get("kind") == "apply_status" and "duration" not in mechanic:
            mechanic["duration"] = 1
        normalize_amount(mechanic)


def normalize_amount(mechanic: dict) -> None:
    amount = mechanic.get("amount")
    if not isinstance(amount, dict) and (
        isinstance(mechanic.get("value"), Number) or isinstance(mechanic.get("base"), Number)
    ):
        amount = {}
        mechanic["amount"] = amount
    if not isinstance(amount, dict):
        if mechanic.get("kind") in DEFAULT_AMOUNTS:
            mechanic["amount"] = {"base": DEFAULT_AMOUNTS[mechanic["kind"]]}
        return
    if "base" not in amount and "value" in amount:
        amount["base"] = amount["value"]
    if "base" not in amount and isinstance(mechanic.get("value"), Number):
        amount["base"] = mechanic["value"]
    if "base" not in amount and isinstance(mechanic.get("base"), Number):
        amount["base"] = mechanic["base"]
    if "base" not in amount and mechanic.get("kind") in DEFAULT_AMOUNTS:
        amount["base"] = DEFAULT_AMOUNTS[mechanic["kind"]]
    if "scaling_stat" not in amount and "stat" in amount:
        amount["scaling_stat"] = amount["stat"]
    if "scaling_stat" not in amount and "stat" in mechanic:
        amount["scaling_stat"] = mechanic["stat"]


def parse_card_package_json(text: str) -> CardPackage:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON") from exc

    try:
        return CardPackage(**normalize_card_package_payload(payload))
    except ValidationError as exc:
        raise ValueError(f"Invalid card package: {exc}") from exc
