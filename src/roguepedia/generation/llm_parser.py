import json

from pydantic import BaseModel, ValidationError

from roguepedia.schemas.card import Card, PassiveTrait


class CardPackage(BaseModel):
    cards: list[Card]
    passive_trait: PassiveTrait
    lore: str
    short_lore: str


def parse_card_package_json(text: str) -> CardPackage:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON") from exc

    try:
        return CardPackage(**payload)
    except ValidationError as exc:
        raise ValueError(f"Invalid card package: {exc}") from exc
