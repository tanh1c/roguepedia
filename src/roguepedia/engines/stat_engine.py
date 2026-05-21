import math

from roguepedia.schemas.character import CharacterStats
from roguepedia.schemas.profile import EntityProfile


def infer_stats(
    profile: EntityProfile,
    *,
    character_class: str,
    role: str,
    domain: str,
) -> CharacterStats:
    values = {
        "hp": 55,
        "attack": 50,
        "defense": 50,
        "speed": 50,
        "intelligence": 50,
        "influence": 50,
        "survival": 50,
    }

    knowledge_budget = _knowledge_budget(profile)
    values["intelligence"] += round(knowledge_budget * 0.35)
    values["influence"] += round(knowledge_budget * 0.25)
    values["survival"] += round(knowledge_budget * 0.15)
    values["hp"] += round(knowledge_budget * 0.10)
    values["attack"] += round(knowledge_budget * 0.10)
    values["defense"] += round(knowledge_budget * 0.05)

    if character_class == "scholar":
        values["intelligence"] += 25
    if character_class == "tactician":
        values["intelligence"] += 15
        values["influence"] += 15
    if character_class == "survivor":
        values["survival"] += 25
        values["defense"] += 10
    if role == "tank":
        values["hp"] += 15
        values["defense"] += 15
    if role == "control":
        values["intelligence"] += 10
        values["speed"] += 5
    if role == "support":
        values["influence"] += 10
    if domain == "nature":
        values["survival"] += 10
    if domain == "strategy":
        values["influence"] += 10

    if profile.entity_type == "organism":
        values["survival"] += 5

    return CharacterStats(**{key: min(100, value) for key, value in values.items()})


def _knowledge_budget(profile: EntityProfile) -> int:
    coverage_level = min(30, int(math.log10(max(profile.wiki_word_count, 1)) * 8))
    reference_level = min(15, int(math.sqrt(profile.wiki_reference_count) * 1.5))
    return coverage_level + reference_level
