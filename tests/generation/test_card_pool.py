from roguepedia.generation.card_pool import CARD_POOL, PoolCardTemplate, RARITY_ORDER, normalize_key
from roguepedia.schemas.card import CardAmount, CardMechanic


def test_pool_template_accepts_valid_card():
    template = PoolCardTemplate(
        id="electricity_chain_discharge",
        name="Chain Discharge",
        domains=["Electricity", "Technology"],
        roles=["Damage", "Control"],
        tags=["electricity", "engineer"],
        min_character_rarity="B",
        card_rarity="rare",
        weight=8,
        energy_cost=2,
        card_type="attack",
        mechanics=[
            CardMechanic(
                kind="damage",
                target="selected_enemy",
                amount=CardAmount(base=10, scaling_stat="intelligence", scaling_ratio=0.35),
            )
        ],
        description="Release a branching surge through the enemy line.",
        mechanics_text="Deal damage.",
    )

    assert template.domains == ["electricity", "technology"]
    assert template.min_character_rarity == "B"


def test_normalize_key_handles_display_names():
    assert normalize_key("Military Strategy") == "military_strategy"
    assert normalize_key("Electricity") == "electricity"


def test_rarity_order_supports_game_rarities():
    assert RARITY_ORDER["D"] < RARITY_ORDER["S"]


def test_card_pool_has_meaningful_size():
    assert len(CARD_POOL) >= 240


def test_card_pool_ids_are_unique():
    ids = [card.id for card in CARD_POOL]
    assert len(ids) == len(set(ids))


def test_card_pool_covers_core_domains():
    domains = {domain for card in CARD_POOL for domain in card.domains}
    assert {"knowledge", "technology", "strategy", "war", "nature", "survival", "electricity"}.issubset(domains)


def test_card_pool_has_rarity_gates():
    rarities = {card.min_character_rarity for card in CARD_POOL}
    assert {"D", "C", "B", "A", "S"}.issubset(rarities)


def test_card_pool_has_distinct_archetype_skill_fantasies():
    tags = {tag for card in CARD_POOL for tag in card.tags}
    assert {"summon", "combo", "curse", "chain", "stance", "trap", "relic_tech", "plague", "inspiration"}.issubset(tags)
