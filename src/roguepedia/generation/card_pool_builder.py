import hashlib
import random

from pydantic import BaseModel, Field

from roguepedia.schemas.character import DeckPreset

from roguepedia.generation.card_pool import CARD_POOL, RARITY_ORDER, RARITY_POWER_MODIFIER, PoolCardTemplate, normalize_key
from roguepedia.schemas.card import Card, CardAmount, CardMechanic, GroundingInfo


class CharacterCardProfile(BaseModel):
    character_id: str
    domain: str
    role: str
    character_class: str
    tags: list[str] = Field(default_factory=list)
    rarity: str

    @property
    def normalized_domain(self) -> str:
        return normalize_key(self.domain)

    @property
    def normalized_role(self) -> str:
        return normalize_key(self.role)

    @property
    def normalized_class(self) -> str:
        return normalize_key(self.character_class)

    @property
    def normalized_tags(self) -> set[str]:
        return {normalize_key(tag) for tag in self.tags}


def card_count_for_rarity(rarity: str) -> int:
    return {"D": 5, "C": 6, "B": 7, "A": 8, "S": 9}[rarity]


def select_pool_templates(profile: CharacterCardProfile, count: int | None = None) -> list[PoolCardTemplate]:
    target_count = count if count is not None else card_count_for_rarity(profile.rarity)
    eligible = [
        template
        for template in CARD_POOL
        if RARITY_ORDER[template.min_character_rarity] <= RARITY_ORDER[profile.rarity]
        and template_matches_profile(template, profile)
    ]
    rng = random.Random(seed_for_profile(profile))
    selected: list[PoolCardTemplate] = []

    while eligible and len(selected) < target_count:
        weights = [max(1, score_template(template, profile, selected)) for template in eligible]
        chosen = rng.choices(eligible, weights=weights, k=1)[0]
        selected.append(chosen)
        eligible.remove(chosen)

    return selected


def template_matches_profile(template: PoolCardTemplate, profile: CharacterCardProfile) -> bool:
    if profile.normalized_domain in template.domains:
        return True
    if profile.normalized_class in template.tags or profile.normalized_tags.intersection(template.tags):
        return True
    return not template.domains and profile.normalized_role in template.roles


def score_template(template: PoolCardTemplate, profile: CharacterCardProfile, selected: list[PoolCardTemplate]) -> int:
    score = template.weight
    score += 6 if profile.normalized_domain in template.domains else 0
    score += 4 if profile.normalized_role in template.roles else 0
    score += 2 if profile.normalized_class in template.tags else 0
    score += 2 * len(profile.normalized_tags.intersection(template.tags))

    mechanic_kind = template.mechanics[0].kind if template.mechanics else ""
    mechanic_overlap = sum(len({mechanic.kind for mechanic in card.mechanics}.intersection({mechanic.kind for mechanic in template.mechanics})) for card in selected)
    card_type_overlap = sum(card.card_type == template.card_type for card in selected)
    generic_overlap = sum(is_generic_suite_card(card) for card in selected) if is_generic_suite_card(template) else 0
    return score - (mechanic_overlap * 4) - (card_type_overlap * 2) - (generic_overlap * 8)


def is_generic_suite_card(template: PoolCardTemplate) -> bool:
    return any(template.id.endswith(f"_{suffix}") for suffix in ("strike", "guard", "pressure", "insight", "surge", "formation", "breakthrough"))


def seed_for_profile(profile: CharacterCardProfile) -> int:
    digest = hashlib.sha256(profile.character_id.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def build_pool_cards(
    profile: CharacterCardProfile,
    *,
    character_name: str,
    grounding_keywords: list[str],
    count: int | None = None,
) -> list[Card]:
    templates = select_pool_templates(profile, count=count)
    return [instantiate_pool_card(template, profile, character_name, grounding_keywords) for template in templates]


def build_deck_presets(
    profile: CharacterCardProfile,
    *,
    character_name: str,
    grounding_keywords: list[str],
    core_cards: list[Card] | None = None,
) -> list[DeckPreset]:
    core = core_cards or build_pool_cards(profile, character_name=character_name, grounding_keywords=grounding_keywords)
    return [
        DeckPreset(
            id="core",
            name="Core Codex",
            archetype="balanced",
            description="A balanced deck built from the character's main domain and signature identity.",
            cards=core,
        ),
        DeckPreset(
            id="aggressive",
            name="Duelist Arsenal",
            archetype="aggressive",
            description="A pressure deck that favors attacks, marks, afflictions, and burst tempo.",
            cards=build_biased_preset_cards(profile, "aggressive", character_name=character_name, grounding_keywords=grounding_keywords),
        ),
        DeckPreset(
            id="control",
            name="Control Script",
            archetype="control",
            description="A slower deck that favors status control, draw, shield, and sustain tools.",
            cards=build_biased_preset_cards(profile, "control", character_name=character_name, grounding_keywords=grounding_keywords),
        ),
    ]


def build_biased_preset_cards(
    profile: CharacterCardProfile,
    preset_id: str,
    *,
    character_name: str,
    grounding_keywords: list[str],
) -> list[Card]:
    target_count = card_count_for_rarity(profile.rarity)
    eligible = [
        template
        for template in CARD_POOL
        if RARITY_ORDER[template.min_character_rarity] <= RARITY_ORDER[profile.rarity]
        and template_matches_profile(template, profile)
    ]
    rng = random.Random(seed_for_profile(profile) + sum(ord(character) for character in preset_id))
    selected: list[PoolCardTemplate] = []

    while eligible and len(selected) < target_count:
        weights = [max(1, score_template(template, profile, selected) + preset_bias(template, preset_id)) for template in eligible]
        chosen = rng.choices(eligible, weights=weights, k=1)[0]
        selected.append(chosen)
        eligible.remove(chosen)

    cards = [instantiate_pool_card(template, profile, character_name, grounding_keywords) for template in selected]
    return [card.model_copy(update={"id": f"{profile.character_id.lower()}-{preset_id}-{card.id.removeprefix(f'{profile.character_id.lower()}-')}"}, deep=True) for card in cards]


def preset_bias(template: PoolCardTemplate, preset_id: str) -> int:
    kinds = {mechanic.kind for mechanic in template.mechanics}
    statuses = {mechanic.status for mechanic in template.mechanics if mechanic.status}
    if preset_id == "aggressive":
        return (
            (8 if "damage" in kinds else 0)
            + (5 if statuses.intersection({"mark", "poison", "shock", "weaken"}) else 0)
            + (3 if template.card_type == "attack" else 0)
            + (2 if template.energy_cost == 0 else 0)
        )
    return (
        (7 if kinds.intersection({"apply_status", "debuff_stat", "mark"}) else 0)
        + (6 if kinds.intersection({"shield", "heal"}) else 0)
        + (5 if "draw_cards" in kinds else 0)
        + (3 if template.card_type in {"skill", "utility", "power"} else 0)
    )


def instantiate_pool_card(
    template: PoolCardTemplate,
    profile: CharacterCardProfile,
    character_name: str,
    grounding_keywords: list[str],
) -> Card:
    mechanics = [scale_mechanic(mechanic, profile.rarity) for mechanic in template.mechanics]
    return Card(
        id=f"{profile.character_id.lower()}-{template.id}",
        owner_character_id=profile.character_id,
        name=template.name,
        card_type=template.card_type,
        card_rarity=template.card_rarity,
        energy_cost=template.energy_cost,
        description=template.description,
        mechanics_text=template.mechanics_text,
        mechanics=mechanics,
        targeting=mechanics[0].target if mechanics else None,
        exhaust=template.exhaust,
        grounding=GroundingInfo(
            inspired_by=f"{character_name}: {template.name}",
            grounding_keywords=grounding_keywords,
        ),
    )


def scale_mechanic(mechanic: CardMechanic, rarity: str) -> CardMechanic:
    if mechanic.amount is None:
        return mechanic.model_copy(deep=True)

    amount = mechanic.amount.model_copy(
        update={"base": max(1, round(mechanic.amount.base * RARITY_POWER_MODIFIER[rarity]))}
    )
    return mechanic.model_copy(update={"amount": amount}, deep=True)
