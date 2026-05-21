import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from roguepedia.schemas.card import CardAmount, CardMechanic, CardType

CharacterRarity = Literal["D", "C", "B", "A", "S"]
PoolCardRarity = Literal["basic", "common", "signature", "rare", "ultimate"]

RARITY_ORDER: dict[str, int] = {"D": 0, "C": 1, "B": 2, "A": 3, "S": 4}
RARITY_POWER_MODIFIER: dict[str, float] = {"D": 0.85, "C": 1.0, "B": 1.1, "A": 1.2, "S": 1.35}


def normalize_key(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower())
    return normalized.strip("_")


class PoolCardTemplate(BaseModel):
    id: str
    name: str
    domains: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    min_character_rarity: CharacterRarity = "D"
    card_rarity: PoolCardRarity = "common"
    weight: int = Field(default=5, ge=1)
    energy_cost: int = Field(ge=0, le=3)
    card_type: CardType
    mechanics: list[CardMechanic]
    description: str
    mechanics_text: str
    exhaust: bool = False

    @field_validator("domains", "roles", "tags", mode="before")
    @classmethod
    def normalize_keys(cls, values: list[str]) -> list[str]:
        return [normalize_key(value) for value in values]


def damage_template(
    domain: str,
    suffix: str,
    name: str,
    *,
    base: int,
    scaling_stat: str,
    roles: list[str] | None = None,
    tags: list[str] | None = None,
    rarity: CharacterRarity = "D",
    card_rarity: PoolCardRarity = "common",
    energy_cost: int = 1,
    status: str | None = None,
) -> PoolCardTemplate:
    mechanics = [
        CardMechanic(
            kind="damage",
            target="selected_enemy",
            amount=CardAmount(base=base, scaling_stat=scaling_stat, scaling_ratio=0.22),
        )
    ]
    mechanics_text = f"Deal {base} damage."
    if status:
        mechanics.append(CardMechanic(kind="apply_status", target="selected_enemy", status=status, duration=2))
        mechanics_text = f"Deal {base} damage and apply {status}."
    return PoolCardTemplate(
        id=f"{normalize_key(domain)}_{suffix}",
        name=name,
        domains=[domain],
        roles=roles or ["Damage"],
        tags=tags or [domain],
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=7,
        energy_cost=energy_cost,
        card_type="attack",
        mechanics=mechanics,
        description=name,
        mechanics_text=mechanics_text,
    )


def shield_template(
    domain: str,
    suffix: str,
    name: str,
    *,
    base: int,
    roles: list[str] | None = None,
    tags: list[str] | None = None,
    rarity: CharacterRarity = "D",
    card_rarity: PoolCardRarity = "common",
    status: str | None = None,
) -> PoolCardTemplate:
    mechanics = [CardMechanic(kind="shield", target="self", amount=CardAmount(base=base, scaling_stat="defense", scaling_ratio=0.18))]
    mechanics_text = f"Gain {base} shield."
    if status:
        mechanics.append(CardMechanic(kind="apply_status", target="self", status=status, duration=2))
        mechanics_text = f"Gain {base} shield and {status}."
    return PoolCardTemplate(
        id=f"{normalize_key(domain)}_{suffix}",
        name=name,
        domains=[domain],
        roles=roles or ["Tank", "Support"],
        tags=tags or [domain],
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=6,
        energy_cost=1,
        card_type="skill",
        mechanics=mechanics,
        description=name,
        mechanics_text=mechanics_text,
    )


def status_template(
    domain: str,
    suffix: str,
    name: str,
    *,
    status: str,
    target: str = "selected_enemy",
    roles: list[str] | None = None,
    tags: list[str] | None = None,
    rarity: CharacterRarity = "C",
    card_rarity: PoolCardRarity = "common",
    draw: bool = False,
) -> PoolCardTemplate:
    mechanics = [CardMechanic(kind="apply_status", target=target, status=status, duration=2)]
    mechanics_text = f"Apply {status}."
    if draw:
        mechanics.append(CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1)))
        mechanics_text = f"Apply {status}. Draw 1 card."
    return PoolCardTemplate(
        id=f"{normalize_key(domain)}_{suffix}",
        name=name,
        domains=[domain],
        roles=roles or ["Control", "Debuffer"],
        tags=tags or [domain, status],
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=5,
        energy_cost=1,
        card_type="skill",
        mechanics=mechanics,
        description=name,
        mechanics_text=mechanics_text,
    )


def utility_template(
    domain: str,
    suffix: str,
    name: str,
    *,
    kind: str,
    base: int,
    roles: list[str] | None = None,
    tags: list[str] | None = None,
    rarity: CharacterRarity = "C",
    card_rarity: PoolCardRarity = "common",
    energy_cost: int = 1,
) -> PoolCardTemplate:
    mechanics = [CardMechanic(kind=kind, target="self", amount=CardAmount(base=base))]
    return PoolCardTemplate(
        id=f"{normalize_key(domain)}_{suffix}",
        name=name,
        domains=[domain],
        roles=roles or ["Support"],
        tags=tags or [domain],
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=5,
        energy_cost=energy_cost,
        card_type="utility",
        mechanics=mechanics,
        description=name,
        mechanics_text=f"{kind.replace('_', ' ').title()} {base}.",
    )


def archetype_template(
    domain: str,
    suffix: str,
    name: str,
    *,
    mechanics: list[CardMechanic],
    card_type: CardType,
    roles: list[str],
    tags: list[str],
    rarity: CharacterRarity = "C",
    card_rarity: PoolCardRarity = "common",
    energy_cost: int = 1,
    exhaust: bool = False,
) -> PoolCardTemplate:
    return PoolCardTemplate(
        id=f"{normalize_key(domain)}_{suffix}",
        name=name,
        domains=[domain],
        roles=roles,
        tags=tags,
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=8,
        energy_cost=energy_cost,
        card_type=card_type,
        mechanics=mechanics,
        description=name,
        mechanics_text=mechanics_summary(mechanics),
        exhaust=exhaust,
    )


def mechanics_summary(mechanics: list[CardMechanic]) -> str:
    parts: list[str] = []
    for mechanic in mechanics:
        amount = mechanic.amount.base if mechanic.amount else 0
        if mechanic.kind == "damage":
            parts.append(f"Deal {amount} damage")
        elif mechanic.kind == "shield":
            parts.append(f"Gain {amount} shield")
        elif mechanic.kind == "heal":
            parts.append(f"Heal {amount} HP")
        elif mechanic.kind == "draw_cards":
            parts.append(f"Draw {amount} card(s)")
        elif mechanic.kind == "gain_energy":
            parts.append(f"Gain {amount} energy")
        elif mechanic.kind in {"apply_status", "mark", "buff_stat", "debuff_stat"}:
            parts.append(f"Apply {mechanic.status or mechanic.kind}")
        elif mechanic.kind == "conditional":
            parts.append(f"Trigger if {mechanic.condition or 'condition met'}")
    return ". ".join(parts) + "."


def role_template(
    role: str,
    suffix: str,
    name: str,
    *,
    kind: str,
    base: int,
    tags: list[str],
    rarity: CharacterRarity = "C",
    card_rarity: PoolCardRarity = "common",
    energy_cost: int = 1,
    status: str | None = None,
) -> PoolCardTemplate:
    target = "selected_enemy" if kind in {"damage", "debuff_stat"} else "self"
    amount = CardAmount(base=base, scaling_stat="attack" if kind == "damage" else "none", scaling_ratio=0.12 if kind == "damage" else 0.0)
    mechanic_status = status if kind in {"buff_stat", "debuff_stat"} else None
    mechanics = [CardMechanic(kind=kind, target=target, amount=amount, status=mechanic_status)]
    mechanics_text = f"{kind.replace('_', ' ').title()} {base}."
    if status and mechanic_status is None:
        mechanics.append(CardMechanic(kind="apply_status", target=target, status=status, duration=2))
        mechanics_text = f"{mechanics_text} Apply {status}."
    return PoolCardTemplate(
        id=f"global_{normalize_key(role)}_{suffix}",
        name=name,
        domains=[],
        roles=[role],
        tags=tags,
        min_character_rarity=rarity,
        card_rarity=card_rarity,
        weight=4,
        energy_cost=energy_cost,
        card_type="attack" if kind == "damage" else "skill",
        mechanics=mechanics,
        description=name,
        mechanics_text=mechanics_text,
    )


def domain_suite(domain: str, *, stat: str, status: str, tags: list[str]) -> list[PoolCardTemplate]:
    key = normalize_key(domain)
    return [
        damage_template(domain, "strike", f"{domain} Strike", base=7, scaling_stat=stat, tags=tags, rarity="D", card_rarity="basic"),
        shield_template(domain, "guard", f"{domain} Guard", base=7, tags=tags, rarity="D", card_rarity="basic"),
        status_template(domain, "pressure", f"{domain} Pressure", status=status, tags=tags + [status], rarity="C"),
        utility_template(domain, "insight", f"{domain} Insight", kind="draw_cards", base=1, tags=tags, rarity="C"),
        damage_template(domain, "surge", f"{domain} Surge", base=10, scaling_stat=stat, tags=tags, rarity="B", card_rarity="signature", status=status),
        shield_template(domain, "formation", f"{domain} Formation", base=11, tags=tags, rarity="B", card_rarity="signature", status="focus" if key in {"knowledge", "technology", "strategy"} else "morale"),
        damage_template(domain, "breakthrough", f"{domain} Breakthrough", base=14, scaling_stat=stat, tags=tags, rarity="A", card_rarity="rare", energy_cost=2, status=status),
    ]


CARD_POOL: list[PoolCardTemplate] = []

for _domain, _stat, _status, _tags in [
    ("Knowledge", "intelligence", "focus", ["research", "scholar"]),
    ("Technology", "intelligence", "focus", ["engineer", "invention"]),
    ("Electricity", "intelligence", "shock", ["electricity", "engineer"]),
    ("War", "attack", "mark", ["war", "military"]),
    ("Strategy", "intelligence", "mark", ["strategy", "tactician"]),
    ("Influence", "influence", "morale", ["leader", "ruler"]),
    ("Nature", "survival", "regen", ["nature", "organism"]),
    ("Survival", "survival", "adapt", ["survival", "resilient"]),
    ("Poison", "attack", "poison", ["poison", "venomous"]),
    ("Disease", "survival", "weaken", ["disease", "pathogen"]),
    ("Art", "influence", "weaken", ["art", "artist"]),
    ("Medicine", "intelligence", "regen", ["medicine", "healer"]),
    ("Adaptation", "survival", "adapt", ["adaptation", "evolution"]),
]:
    CARD_POOL.extend(domain_suite(_domain, stat=_stat, status=_status, tags=_tags))

for _domain, _stat, _status, _tags in [
    ("Time", "intelligence", "focus", ["time", "chronology"]),
    ("Creation", "influence", "morale", ["creation", "builder"]),
    ("Exploration", "survival", "adapt", ["exploration", "traveler"]),
    ("Chaos", "attack", "weaken", ["chaos", "trickster"]),
]:
    CARD_POOL.extend(domain_suite(_domain, stat=_stat, status=_status, tags=_tags))

for _domain, _stat, _status, _tags, _recipes in [
    ("Knowledge", "intelligence", "focus", ["knowledge", "research", "scholar"], [
        ("peer_review", "Peer Review", "skill", "Control", [CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "C", 1),
        ("citation_chain", "Citation Chain", "utility", "Support", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2))], "B", 1),
        ("thesis_defense", "Thesis Defense", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=10, scaling_stat="intelligence", scaling_ratio=0.16)), CardMechanic(kind="apply_status", target="self", status="focus", duration=2)], "B", 1),
        ("breakthrough_model", "Breakthrough Model", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=12, scaling_stat="intelligence", scaling_ratio=0.26)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 2),
    ]),
    ("Technology", "intelligence", "focus", ["technology", "engineer", "invention"], [
        ("prototype_loop", "Prototype Loop", "utility", "Support", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 0),
        ("calibrated_array", "Calibrated Array", "attack", "Damage", [CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=9, scaling_stat="intelligence", scaling_ratio=0.22)), CardMechanic(kind="apply_status", target="front_enemy", status="focus", duration=2)], "C", 1),
        ("failsafe_shell", "Failsafe Shell", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=12, scaling_stat="defense", scaling_ratio=0.2)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "A", 1),
        ("recursive_upgrade", "Recursive Upgrade", "power", "Buffer", [CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="focus")], "A", 2),
    ]),
    ("Electricity", "intelligence", "shock", ["electricity", "engineer", "shock"], [
        ("arc_jump", "Arc Jump", "attack", "Damage", [CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=8, scaling_stat="intelligence", scaling_ratio=0.22)), CardMechanic(kind="damage", target="back_enemy", amount=CardAmount(base=5, scaling_stat="intelligence", scaling_ratio=0.16))], "C", 1),
        ("static_reservoir", "Static Reservoir", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=8, scaling_stat="defense", scaling_ratio=0.16)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "B", 1),
        ("capacitor_burst", "Capacitor Burst", "utility", "Support", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 0),
        ("chain_lightning", "Chain Lightning", "attack", "Damage", [CardMechanic(kind="damage", target="all_enemies", amount=CardAmount(base=8, scaling_stat="intelligence", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="all_enemies", status="shock", duration=2)], "A", 2),
    ]),
    ("War", "attack", "mark", ["war", "military", "mark"], [
        ("opening_volley", "Opening Volley", "attack", "Damage", [CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=9, scaling_stat="attack", scaling_ratio=0.22)), CardMechanic(kind="mark", target="front_enemy")], "C", 1),
        ("shield_wall", "Shield Wall", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=13, scaling_stat="defense", scaling_ratio=0.2))], "B", 1),
        ("rout_the_line", "Rout the Line", "attack", "Damage", [CardMechanic(kind="damage", target="all_enemies", amount=CardAmount(base=7, scaling_stat="attack", scaling_ratio=0.16)), CardMechanic(kind="apply_status", target="all_enemies", status="mark", duration=2)], "A", 2),
        ("battle_rhythm", "Battle Rhythm", "utility", "Buffer", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="apply_status", target="self", status="morale", duration=2)], "B", 1),
    ]),
    ("Strategy", "intelligence", "mark", ["strategy", "tactician", "control"], [
        ("forced_error", "Forced Error", "skill", "Control", [CardMechanic(kind="debuff_stat", target="selected_enemy", amount=CardAmount(base=1), status="mark"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "C", 1),
        ("forked_plan", "Forked Plan", "utility", "Support", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "A", 1),
        ("kill_box", "Kill Box", "attack", "Damage", [CardMechanic(kind="damage", target="marked_enemy", amount=CardAmount(base=14, scaling_stat="intelligence", scaling_ratio=0.24)), CardMechanic(kind="mark", target="selected_enemy")], "B", 2),
        ("contingency", "Contingency", "power", "Control", [CardMechanic(kind="conditional", target="self", condition="enemy_marked"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 1),
    ]),
    ("Influence", "influence", "morale", ["influence", "leader", "ruler"], [
        ("public_mandate", "Public Mandate", "skill", "Buffer", [CardMechanic(kind="apply_status", target="all_allies", status="morale", duration=2), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "C", 1),
        ("command_network", "Command Network", "utility", "Support", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 1),
        ("soft_power", "Soft Power", "skill", "Control", [CardMechanic(kind="apply_status", target="all_enemies", status="weaken", duration=2)], "B", 1),
        ("rallying_speech", "Rallying Speech", "power", "Buffer", [CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="morale")], "A", 2),
    ]),
    ("Nature", "survival", "regen", ["nature", "organism", "regen"], [
        ("root_snare", "Root Snare", "skill", "Control", [CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2), CardMechanic(kind="shield", target="self", amount=CardAmount(base=6, scaling_stat="survival", scaling_ratio=0.14))], "C", 1),
        ("wild_regrowth", "Wild Regrowth", "skill", "Healer", [CardMechanic(kind="heal", target="self", amount=CardAmount(base=8, scaling_stat="survival", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="self", status="regen", duration=2)], "B", 1),
        ("thorn_bloom", "Thorn Bloom", "attack", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=8, scaling_stat="defense", scaling_ratio=0.14)), CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=7, scaling_stat="survival", scaling_ratio=0.14))], "B", 1),
        ("predator_cycle", "Predator Cycle", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=13, scaling_stat="survival", scaling_ratio=0.24)), CardMechanic(kind="heal", target="self", amount=CardAmount(base=4, scaling_stat="survival", scaling_ratio=0.1))], "A", 2),
    ]),
    ("Survival", "survival", "adapt", ["survival", "resilient", "adapt"], [
        ("last_scrap", "Last Scrap", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=9, scaling_stat="defense", scaling_ratio=0.18)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "C", 1),
        ("scar_tissue", "Scar Tissue", "power", "Tank", [CardMechanic(kind="apply_status", target="self", status="adapt", duration=3)], "B", 1),
        ("resourceful_turn", "Resourceful Turn", "utility", "Support", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="shield", target="self", amount=CardAmount(base=5, scaling_stat="defense", scaling_ratio=0.1))], "B", 0),
        ("outlast", "Outlast", "skill", "Healer", [CardMechanic(kind="heal", target="self", amount=CardAmount(base=6, scaling_stat="survival", scaling_ratio=0.14)), CardMechanic(kind="shield", target="self", amount=CardAmount(base=10, scaling_stat="defense", scaling_ratio=0.16))], "A", 2),
    ]),
    ("Poison", "attack", "poison", ["poison", "venomous"], [
        ("venom_tip", "Venom Tip", "attack", "Debuffer", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=7, scaling_stat="attack", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="selected_enemy", status="poison", duration=3)], "C", 1),
        ("toxin_cloud", "Toxin Cloud", "skill", "Debuffer", [CardMechanic(kind="apply_status", target="all_enemies", status="poison", duration=2)], "B", 1),
        ("paralytic_dose", "Paralytic Dose", "skill", "Control", [CardMechanic(kind="debuff_stat", target="selected_enemy", amount=CardAmount(base=2), status="weaken"), CardMechanic(kind="apply_status", target="selected_enemy", status="poison", duration=2)], "B", 1),
        ("lethal_cascade", "Lethal Cascade", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=12, scaling_stat="attack", scaling_ratio=0.22)), CardMechanic(kind="apply_status", target="all_enemies", status="poison", duration=2)], "A", 2),
    ]),
    ("Disease", "survival", "weaken", ["disease", "pathogen", "weaken"], [
        ("fever_spike", "Fever Spike", "attack", "Debuffer", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=8, scaling_stat="survival", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2)], "C", 1),
        ("vector_spread", "Vector Spread", "skill", "Debuffer", [CardMechanic(kind="apply_status", target="all_enemies", status="weaken", duration=2), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 1),
        ("immune_escape", "Immune Escape", "utility", "Trickster", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="apply_status", target="self", status="adapt", duration=2)], "B", 0),
        ("pandemic_curve", "Pandemic Curve", "power", "Debuffer", [CardMechanic(kind="conditional", target="self", condition="enemy_debuffed"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2))], "A", 2),
    ]),
    ("Art", "influence", "weaken", ["art", "artist", "performance"], [
        ("striking_image", "Striking Image", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=8, scaling_stat="influence", scaling_ratio=0.2)), CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2)], "C", 1),
        ("improvisation", "Improvisation", "utility", "Trickster", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2))], "B", 1),
        ("audience_sway", "Audience Sway", "skill", "Control", [CardMechanic(kind="apply_status", target="all_enemies", status="weaken", duration=2), CardMechanic(kind="apply_status", target="self", status="morale", duration=2)], "B", 1),
        ("masterpiece", "Masterpiece", "power", "Buffer", [CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="morale"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 2),
    ]),
    ("Medicine", "intelligence", "regen", ["medicine", "healer"], [
        ("diagnose", "Diagnose", "skill", "Control", [CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "C", 1),
        ("stabilize", "Stabilize", "skill", "Healer", [CardMechanic(kind="heal", target="self", amount=CardAmount(base=9, scaling_stat="intelligence", scaling_ratio=0.16)), CardMechanic(kind="shield", target="self", amount=CardAmount(base=5, scaling_stat="defense", scaling_ratio=0.1))], "B", 1),
        ("field_surgery", "Field Surgery", "utility", "Healer", [CardMechanic(kind="heal", target="self", amount=CardAmount(base=12, scaling_stat="intelligence", scaling_ratio=0.18))], "A", 2),
        ("preventive_care", "Preventive Care", "power", "Support", [CardMechanic(kind="apply_status", target="self", status="regen", duration=3), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 1),
    ]),
    ("Adaptation", "survival", "adapt", ["adaptation", "evolution"], [
        ("mutate", "Mutate", "utility", "Trickster", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "B", 0),
        ("adaptive_hide", "Adaptive Hide", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=10, scaling_stat="defense", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="self", status="adapt", duration=2)], "C", 1),
        ("evolutionary_pressure", "Evolutionary Pressure", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=11, scaling_stat="survival", scaling_ratio=0.22)), CardMechanic(kind="debuff_stat", target="selected_enemy", amount=CardAmount(base=1), status="weaken")], "B", 1),
        ("branching_trait", "Branching Trait", "power", "Buffer", [CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="adapt"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 2),
    ]),
    ("Time", "intelligence", "focus", ["time", "chronology"], [
        ("rewind", "Rewind", "utility", "Control", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "A", 1),
        ("delayed_strike", "Delayed Strike", "attack", "Damage", [CardMechanic(kind="conditional", target="self", condition="next_turn"), CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=14, scaling_stat="intelligence", scaling_ratio=0.24))], "B", 1),
        ("chronal_barrier", "Chronal Barrier", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=11, scaling_stat="defense", scaling_ratio=0.18)), CardMechanic(kind="apply_status", target="self", status="focus", duration=2)], "C", 1),
        ("paradox_engine", "Paradox Engine", "power", "Support", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 2),
    ]),
    ("Creation", "influence", "morale", ["creation", "builder"], [
        ("blueprint", "Blueprint", "utility", "Support", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2))], "C", 1),
        ("reinforced_frame", "Reinforced Frame", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=12, scaling_stat="defense", scaling_ratio=0.2)), CardMechanic(kind="apply_status", target="self", status="morale", duration=2)], "B", 1),
        ("master_builder", "Master Builder", "power", "Buffer", [CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="morale"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", 2),
        ("constructive_blow", "Constructive Blow", "attack", "Damage", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=10, scaling_stat="influence", scaling_ratio=0.2)), CardMechanic(kind="shield", target="self", amount=CardAmount(base=6, scaling_stat="defense", scaling_ratio=0.1))], "B", 1),
    ]),
    ("Exploration", "survival", "adapt", ["exploration", "traveler"], [
        ("scout_ahead", "Scout Ahead", "utility", "Support", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "C", 0),
        ("charted_escape", "Charted Escape", "skill", "Tank", [CardMechanic(kind="shield", target="self", amount=CardAmount(base=9, scaling_stat="defense", scaling_ratio=0.16)), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 1),
        ("frontier_gambit", "Frontier Gambit", "attack", "Trickster", [CardMechanic(kind="damage", target="back_enemy", amount=CardAmount(base=12, scaling_stat="survival", scaling_ratio=0.2)), CardMechanic(kind="apply_status", target="back_enemy", status="weaken", duration=2)], "B", 1),
        ("uncharted_route", "Uncharted Route", "power", "Support", [CardMechanic(kind="conditional", target="self", condition="new_route"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2))], "A", 2),
    ]),
    ("Chaos", "attack", "weaken", ["chaos", "trickster"], [
        ("wild_spark", "Wild Spark", "attack", "Trickster", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=6, scaling_stat="attack", scaling_ratio=0.16)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "C", 0),
        ("scramble", "Scramble", "skill", "Control", [CardMechanic(kind="apply_status", target="all_enemies", status="weaken", duration=2), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", 1),
        ("lucky_break", "Lucky Break", "utility", "Trickster", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "A", 1),
        ("beautiful_mess", "Beautiful Mess", "power", "Buffer", [CardMechanic(kind="conditional", target="self", condition="random_advantage"), CardMechanic(kind="apply_status", target="self", status="morale", duration=2)], "A", 2),
    ]),
]:
    for _suffix, _name, _card_type, _role, _mechanics, _rarity, _cost in _recipes:
        CARD_POOL.append(
            archetype_template(
                _domain,
                _suffix,
                _name,
                mechanics=_mechanics,
                card_type=_card_type,
                roles=[_role],
                tags=_tags,
                rarity=_rarity,
                card_rarity="rare" if _rarity == "A" else "signature" if _rarity == "B" else "common",
                energy_cost=_cost,
            )
        )

for _domain, _tags, _recipes in [
    ("Technology", ["technology", "engineer", "summon", "relic_tech"], [
        ("clockwork_assistant", "Clockwork Assistant", "power", [CardMechanic(kind="conditional", target="self", condition="summon_clockwork_assistant"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "B", "signature", 1),
        ("relic_interface", "Relic Interface", "utility", [CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1)), CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=1), status="focus")], "A", "rare", 1),
        ("autonomous_drone", "Autonomous Drone", "power", [CardMechanic(kind="conditional", target="self", condition="summon_drone"), CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=6, scaling_stat="intelligence", scaling_ratio=0.14))], "A", "rare", 2),
    ]),
    ("Electricity", ["electricity", "shock", "chain"], [
        ("voltage_chain", "Voltage Chain", "attack", [CardMechanic(kind="damage", target="front_enemy", amount=CardAmount(base=7, scaling_stat="intelligence", scaling_ratio=0.16)), CardMechanic(kind="damage", target="back_enemy", amount=CardAmount(base=7, scaling_stat="intelligence", scaling_ratio=0.16)), CardMechanic(kind="apply_status", target="all_enemies", status="shock", duration=2)], "B", "signature", 1),
        ("storm_lattice", "Storm Lattice", "power", [CardMechanic(kind="conditional", target="self", condition="chain_on_shock"), CardMechanic(kind="gain_energy", target="self", amount=CardAmount(base=1))], "A", "rare", 2),
    ]),
    ("Strategy", ["strategy", "trap", "combo"], [
        ("ambush_clause", "Ambush Clause", "skill", [CardMechanic(kind="conditional", target="self", condition="trap_when_enemy_attacks"), CardMechanic(kind="mark", target="selected_enemy")], "B", "signature", 1),
        ("combo_route", "Combo Route", "utility", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="conditional", target="self", condition="next_attack_costs_less")], "A", "rare", 1),
        ("checkmate_net", "Checkmate Net", "attack", [CardMechanic(kind="damage", target="marked_enemy", amount=CardAmount(base=16, scaling_stat="intelligence", scaling_ratio=0.26)), CardMechanic(kind="conditional", target="self", condition="bonus_if_trap_ready")], "S", "ultimate", 3),
    ]),
    ("Disease", ["disease", "curse", "plague"], [
        ("curse_carrier", "Curse Carrier", "skill", [CardMechanic(kind="apply_status", target="selected_enemy", status="curse", duration=3), CardMechanic(kind="apply_status", target="selected_enemy", status="weaken", duration=2)], "B", "signature", 1),
        ("plague_bloom", "Plague Bloom", "power", [CardMechanic(kind="conditional", target="self", condition="plague_spreads_on_debuff"), CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=1))], "A", "rare", 2),
        ("black_archive", "Black Archive", "ultimate", [CardMechanic(kind="apply_status", target="all_enemies", status="curse", duration=3), CardMechanic(kind="apply_status", target="all_enemies", status="weaken", duration=3)], "S", "ultimate", 3),
    ]),
    ("Art", ["art", "inspiration", "combo"], [
        ("inspiration_spark", "Inspiration Spark", "utility", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="apply_status", target="self", status="inspiration", duration=2)], "B", "signature", 1),
        ("crescendo_combo", "Crescendo Combo", "attack", [CardMechanic(kind="damage", target="selected_enemy", amount=CardAmount(base=10, scaling_stat="influence", scaling_ratio=0.2)), CardMechanic(kind="conditional", target="self", condition="repeat_if_inspired")], "A", "rare", 2),
    ]),
    ("Survival", ["survival", "stance", "adapt"], [
        ("guarded_stance", "Guarded Stance", "power", [CardMechanic(kind="apply_status", target="self", status="guarded_stance", duration=3), CardMechanic(kind="shield", target="self", amount=CardAmount(base=10, scaling_stat="defense", scaling_ratio=0.18))], "B", "signature", 1),
        ("predator_stance", "Predator Stance", "power", [CardMechanic(kind="apply_status", target="self", status="predator_stance", duration=3), CardMechanic(kind="buff_stat", target="self", amount=CardAmount(base=2), status="adapt")], "A", "rare", 2),
    ]),
    ("Knowledge", ["knowledge", "combo", "inspiration"], [
        ("theory_combo", "Theory Combo", "utility", [CardMechanic(kind="draw_cards", target="self", amount=CardAmount(base=2)), CardMechanic(kind="conditional", target="self", condition="combo_if_skill_played")], "B", "signature", 1),
        ("forbidden_thesis", "Forbidden Thesis", "power", [CardMechanic(kind="apply_status", target="self", status="inspiration", duration=3), CardMechanic(kind="apply_status", target="selected_enemy", status="curse", duration=2)], "A", "rare", 2),
    ]),
]:
    for _suffix, _name, _card_type, _mechanics, _rarity, _card_rarity, _cost in _recipes:
        CARD_POOL.append(
            archetype_template(
                _domain,
                _suffix,
                _name,
                mechanics=_mechanics,
                card_type=_card_type,
                roles=["Support", "Control", "Damage"],
                tags=_tags,
                rarity=_rarity,
                card_rarity=_card_rarity,
                energy_cost=_cost,
                exhaust=_card_type == "ultimate",
            )
        )

CARD_POOL.extend(
    [
        damage_template("Knowledge", "grand_theory", "Grand Theory", base=18, scaling_stat="intelligence", tags=["knowledge", "research"], rarity="S", card_rarity="ultimate", energy_cost=3, status="focus"),
        damage_template("Electricity", "storm_relay", "Storm Relay", base=18, scaling_stat="intelligence", tags=["electricity", "shock"], rarity="S", card_rarity="ultimate", energy_cost=3, status="shock"),
        damage_template("War", "decisive_campaign", "Decisive Campaign", base=18, scaling_stat="attack", tags=["war", "military"], rarity="S", card_rarity="ultimate", energy_cost=3, status="mark"),
        damage_template("Nature", "apex_cycle", "Apex Cycle", base=16, scaling_stat="survival", tags=["nature", "predator"], rarity="S", card_rarity="ultimate", energy_cost=3, status="regen"),
        shield_template("Survival", "last_bastion", "Last Bastion", base=18, tags=["survival", "tank"], rarity="S", card_rarity="ultimate", status="adapt"),
        status_template("Strategy", "perfect_read", "Perfect Read", status="mark", tags=["strategy", "control"], rarity="A", card_rarity="rare", draw=True),
        status_template("Influence", "commanding_presence", "Commanding Presence", status="morale", target="all_allies", tags=["influence", "leader"], rarity="A", card_rarity="rare", draw=True),
        status_template("Poison", "toxin_cascade", "Toxin Cascade", status="poison", target="all_enemies", tags=["poison", "venomous"], rarity="A", card_rarity="rare"),
        status_template("Disease", "outbreak_vector", "Outbreak Vector", status="weaken", target="all_enemies", tags=["disease", "pathogen"], rarity="A", card_rarity="rare"),
        utility_template("Art", "inspiring_refrain", "Inspiring Refrain", kind="draw_cards", base=2, tags=["art", "support"], rarity="B", card_rarity="signature"),
        utility_template("Medicine", "rapid_triage", "Rapid Triage", kind="heal", base=8, tags=["medicine", "healer"], rarity="B", card_rarity="signature"),
        utility_template("Technology", "overclock", "Overclock", kind="gain_energy", base=1, tags=["technology", "engineer"], rarity="B", card_rarity="signature", energy_cost=0),
        utility_template("Adaptation", "evolutionary_branch", "Evolutionary Branch", kind="draw_cards", base=2, tags=["adaptation", "evolution"], rarity="A", card_rarity="rare"),
        damage_template("Time", "paradox_cut", "Paradox Cut", base=16, scaling_stat="intelligence", tags=["time", "control"], rarity="A", card_rarity="rare", energy_cost=2, status="focus"),
        utility_template("Creation", "masterwork", "Masterwork", kind="draw_cards", base=2, tags=["creation", "builder"], rarity="B", card_rarity="signature"),
        shield_template("Exploration", "charted_route", "Charted Route", base=13, tags=["exploration", "traveler"], rarity="B", card_rarity="signature", status="adapt"),
        status_template("Chaos", "wild_turn", "Wild Turn", status="weaken", target="all_enemies", tags=["chaos", "trickster"], rarity="A", card_rarity="rare", draw=True),
    ]
)

for _role, _items in {
    "Damage": [("clean_hit", "Clean Hit", "damage", 8, "D", None), ("heavy_commit", "Heavy Commit", "damage", 12, "B", "mark"), ("finisher", "Finisher", "damage", 15, "A", "weaken")],
    "Tank": [("brace", "Brace", "shield", 7, "D", None), ("hold_line", "Hold Line", "shield", 11, "B", "resilience"), ("fortress_stance", "Fortress Stance", "shield", 15, "A", "adapt")],
    "Support": [("quick_plan", "Quick Plan", "draw_cards", 1, "D", None), ("team_focus", "Team Focus", "draw_cards", 2, "B", "focus"), ("tempo_burst", "Tempo Burst", "gain_energy", 1, "B", None)],
    "Control": [("pin_down", "Pin Down", "debuff_stat", 1, "C", "mark"), ("stall", "Stall", "draw_cards", 1, "C", "weaken"), ("lockdown", "Lockdown", "debuff_stat", 2, "A", "weaken")],
    "Healer": [("field_care", "Field Care", "heal", 5, "D", None), ("second_wind", "Second Wind", "heal", 8, "B", "regen"), ("mass_recovery", "Mass Recovery", "heal", 11, "A", "morale")],
    "Debuffer": [("soften", "Soften", "debuff_stat", 1, "C", "weaken"), ("expose", "Expose", "debuff_stat", 2, "B", "mark"), ("collapse", "Collapse", "damage", 10, "A", "weaken")],
    "Buffer": [("rally", "Rally", "draw_cards", 1, "C", "morale"), ("sharpen", "Sharpen", "gain_energy", 1, "B", "focus"), ("momentum_engine", "Momentum Engine", "draw_cards", 2, "A", "morale")],
    "Trickster": [("feint", "Feint", "draw_cards", 1, "C", None), ("misdirect", "Misdirect", "debuff_stat", 1, "B", "weaken"), ("reversal", "Reversal", "damage", 11, "A", "mark")],
}.items():
    for _suffix, _name, _kind, _base, _rarity, _status in _items:
        CARD_POOL.append(
            role_template(
                _role,
                _suffix,
                _name,
                kind=_kind,
                base=_base,
                tags=[normalize_key(_role)],
                rarity=_rarity,
                card_rarity="rare" if _rarity == "A" else "common",
                energy_cost=0 if _kind == "gain_energy" else 1,
                status=_status,
            )
        )
