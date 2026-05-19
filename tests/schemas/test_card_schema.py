from roguepedia.schemas.card import Card, CardAmount, CardMechanic, GroundingInfo


def test_card_with_damage_mechanic():
    card = Card(
        id="Q9036_alternating_current",
        owner_character_id="Q9036",
        name="Alternating Current",
        card_type="attack",
        card_rarity="signature",
        energy_cost=1,
        description="Strike with a controlled electrical surge.",
        mechanics_text="Deal intelligence-scaling damage.",
        mechanics=[
            CardMechanic(
                kind="damage",
                target="selected_enemy",
                amount=CardAmount(base=6, scaling_stat="intelligence", scaling_ratio=0.35),
            )
        ],
        grounding=GroundingInfo(
            inspired_by="Associated with alternating current electrical systems.",
            grounding_keywords=["alternating current", "electrical"],
        ),
    )

    assert card.energy_cost == 1
    assert card.mechanics[0].kind == "damage"
