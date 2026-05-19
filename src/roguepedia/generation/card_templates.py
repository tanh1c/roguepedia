from roguepedia.schemas.card import Card, CardAmount, CardMechanic, GroundingInfo, PassiveTrait
from roguepedia.schemas.character import CharacterStats

BASIC_DAMAGE = 8
BASIC_SHIELD = 7
BASIC_HEAL = 5


def grounding(character_name: str, keywords: list[str]) -> GroundingInfo:
    return GroundingInfo(inspired_by=character_name, grounding_keywords=keywords)


def card_id(character_id: str, suffix: str) -> str:
    return f"{character_id.lower()}-{suffix}"


def build_template_cards(
    *,
    character_id: str,
    character_name: str,
    domain: str,
    character_class: str,
    role: str,
    stats: CharacterStats,
    grounding_keywords: list[str],
) -> list[Card]:
    if domain == "nature" or character_class == "survivor" or role == "tank":
        return nature_survival_cards(character_id, character_name, grounding_keywords)
    if domain == "strategy" or character_class == "tactician" or role == "control":
        return strategy_control_cards(character_id, character_name, grounding_keywords)
    return balanced_cards(character_id, character_name, grounding_keywords)


def strategy_control_cards(character_id: str, character_name: str, keywords: list[str]) -> list[Card]:
    info = grounding(character_name, keywords)
    return [
        Card(
            id=card_id(character_id, "opening-strike"),
            owner_character_id=character_id,
            name="Opening Strike",
            card_type="attack",
            card_rarity="basic",
            energy_cost=1,
            description="Deal damage to an enemy.",
            mechanics_text="Deal 8 damage.",
            mechanics=[CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=BASIC_DAMAGE, scaling_stat="attack", scaling_ratio=0.1))],
            targeting="selected_enemy",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "marked-formation"),
            owner_character_id=character_id,
            name="Marked Formation",
            card_type="skill",
            card_rarity="common",
            energy_cost=1,
            description="Mark an enemy and draw a card.",
            mechanics_text="Mark an enemy. Draw 1 card.",
            mechanics=[
                CardMechanic(kind="mark", target="selected_enemy"),
                CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1)),
            ],
            targeting="selected_enemy",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "controlled-advance"),
            owner_character_id=character_id,
            name="Controlled Advance",
            card_type="power",
            card_rarity="signature",
            energy_cost=2,
            description="Gain focus and shield.",
            mechanics_text="Gain 7 shield and 1 focus for 2 turns.",
            mechanics=[
                CardMechanic(kind="shield", target="self", amount=CardAmount(base=BASIC_SHIELD, scaling_stat="defense", scaling_ratio=0.1)),
                CardMechanic(kind="apply_status", target="self", status="focus", duration=2),
            ],
            targeting="self",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "exploit-mark"),
            owner_character_id=character_id,
            name="Exploit Mark",
            card_type="attack",
            card_rarity="rare",
            energy_cost=2,
            description="Hit a marked enemy hard.",
            mechanics_text="Deal 14 damage to a marked enemy.",
            mechanics=[CardMechanic(kind="damage", target="marked_enemy", amount=CardAmount(base=14, scaling_stat="intelligence", scaling_ratio=0.15))],
            targeting="marked_enemy",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "tactical-reserve"),
            owner_character_id=character_id,
            name="Tactical Reserve",
            card_type="utility",
            card_rarity="common",
            energy_cost=0,
            description="Gain energy.",
            mechanics_text="Gain 1 energy.",
            mechanics=[CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))],
            targeting="self",
            grounding=info,
        ),
    ]


def nature_survival_cards(character_id: str, character_name: str, keywords: list[str]) -> list[Card]:
    info = grounding(character_name, keywords)
    return [
        Card(
            id=card_id(character_id, "bite"),
            owner_character_id=character_id,
            name="Survival Bite",
            card_type="attack",
            card_rarity="basic",
            energy_cost=1,
            description="Deal damage to an enemy.",
            mechanics_text="Deal 8 damage.",
            mechanics=[CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=BASIC_DAMAGE, scaling_stat="attack", scaling_ratio=0.1))],
            targeting="selected_enemy",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "harden"),
            owner_character_id=character_id,
            name="Harden",
            card_type="skill",
            card_rarity="common",
            energy_cost=1,
            description="Gain shield.",
            mechanics_text="Gain 10 shield.",
            mechanics=[CardMechanic(kind="shield", target="self", amount=CardAmount(base=10, scaling_stat="defense", scaling_ratio=0.2))],
            targeting="self",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "recover"),
            owner_character_id=character_id,
            name="Recover",
            card_type="skill",
            card_rarity="common",
            energy_cost=1,
            description="Heal yourself.",
            mechanics_text="Heal 5 HP.",
            mechanics=[CardMechanic(kind="heal", target="self", amount=CardAmount(base=BASIC_HEAL, scaling_stat="survival", scaling_ratio=0.1))],
            targeting="self",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "endure"),
            owner_character_id=character_id,
            name="Endure",
            card_type="power",
            card_rarity="signature",
            energy_cost=2,
            description="Gain resilience.",
            mechanics_text="Gain resilience for 3 turns.",
            mechanics=[CardMechanic(kind="apply_status", target="self", status="resilience", duration=3)],
            targeting="self",
            grounding=info,
        ),
        Card(
            id=card_id(character_id, "adapt"),
            owner_character_id=character_id,
            name="Adapt",
            card_type="utility",
            card_rarity="rare",
            energy_cost=1,
            description="Draw cards and gain shield.",
            mechanics_text="Draw 1 card and gain 7 shield.",
            mechanics=[
                CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1)),
                CardMechanic(kind="shield", target="self", amount=CardAmount(base=BASIC_SHIELD)),
            ],
            targeting="self",
            grounding=info,
        ),
    ]


def balanced_cards(character_id: str, character_name: str, keywords: list[str]) -> list[Card]:
    return strategy_control_cards(character_id, character_name, keywords)[:3] + nature_survival_cards(character_id, character_name, keywords)[:2]


def build_template_passive(
    *,
    character_id: str,
    character_name: str,
    domain: str,
    character_class: str,
    role: str,
    grounding_keywords: list[str],
) -> PassiveTrait:
    if domain == "nature" or character_class == "survivor" or role == "tank":
        mechanic = CardMechanic(kind="shield", target="self", amount=CardAmount(base=2))
        name = "Survival Instinct"
        description = "Starts each battle with extra shield."
    else:
        mechanic = CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))
        name = "Prepared Mind"
        description = "Starts each battle with extra tactical options."

    return PassiveTrait(
        id=card_id(character_id, "passive"),
        owner_character_id=character_id,
        name=name,
        description=description,
        mechanics=[mechanic],
        grounding=grounding(character_name, grounding_keywords),
    )
