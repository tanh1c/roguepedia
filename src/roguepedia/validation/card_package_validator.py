from copy import deepcopy

from roguepedia.generation.character_assembler import assemble_no_llm_character_with_cards
from roguepedia.generation.llm_parser import CardPackage
from roguepedia.schemas.character import GameCharacter, ValidationReport
from roguepedia.validation.mechanics_validator import validate_mechanics


GROUNDING_GAMEPLAY_TERMS = {
    "attack",
    "defense",
    "advance",
    "victory",
    "knowledge",
    "deception",
    "master",
    "supreme",
    "resilience",
    "shield",
    "heal",
    "healing",
    "mark",
    "extreme",
    "endurance",
    "tenacity",
    "stealth",
    "escape",
    "flexibility",
    "strength",
}


def validate_card_package(character: GameCharacter, package: CardPackage) -> ValidationReport:
    report = ValidationReport(schema_valid=True, safety_valid=character.validation.safety_valid)

    for card in package.cards:
        for error in validate_mechanics(card.mechanics):
            report.rejected_reasons.append(f"{card.id}: {error}")
        for keyword in card.grounding.grounding_keywords:
            if not is_grounded_keyword(character, keyword, package):
                report.rejected_reasons.append(f"ungrounded keyword: {keyword}")

    for error in validate_mechanics(package.passive_trait.mechanics):
        report.rejected_reasons.append(f"{package.passive_trait.id}: {error}")
    for keyword in package.passive_trait.grounding.grounding_keywords:
        if not is_grounded_keyword(character, keyword, package):
            report.rejected_reasons.append(f"ungrounded keyword: {keyword}")

    report.mechanics_valid = not any("requires" in reason or "cannot" in reason for reason in report.rejected_reasons)
    report.grounded = not any(reason.startswith("ungrounded keyword") for reason in report.rejected_reasons)
    report.balance_valid = 5 <= len(package.cards) <= 6 or len(package.cards) == 1
    return report


def is_grounded_keyword(character: GameCharacter, keyword: str, package: CardPackage) -> bool:
    normalized_keyword = keyword.lower()
    allowed_keywords = {tag.lower() for tag in character.tags}
    allowed_keywords.add(character.name.lower())
    if normalized_keyword in allowed_keywords or normalized_keyword in GROUNDING_GAMEPLAY_TERMS:
        return True
    card_text = "\n".join(
        [
            card.name + " " + card.description + " " + card.mechanics_text
            for card in package.cards
        ]
    )
    source_text = "\n".join(
        [
            character.lore,
            character.short_lore,
            package.lore,
            package.short_lore,
            character.name,
            " ".join(character.tags),
            card_text,
            package.passive_trait.name + " " + package.passive_trait.description,
        ]
    ).lower()
    if normalized_keyword in source_text:
        return True
    return any(len(term) >= 4 and term in source_text for term in normalized_keyword.replace("-", " ").split())


def apply_card_package(character: GameCharacter, package: CardPackage, *, fallback: bool = False) -> GameCharacter:
    report = validate_card_package(character, package)
    if report.rejected_reasons and fallback:
        fallback_character = assemble_no_llm_character_with_cards(character_to_profile_like(character))
        fallback_character.generation_metadata["fallback_reason"] = "validation_failed"
        return fallback_character

    updated = deepcopy(character)
    updated.cards = package.cards
    updated.passive_trait = package.passive_trait
    updated.lore = package.lore
    updated.short_lore = package.short_lore
    updated.validation = report
    updated.generation_metadata["llm_used"] = True
    updated.generation_metadata["cards_generated"] = True
    return updated


def character_to_profile_like(character: GameCharacter):
    from roguepedia.schemas.profile import EntityProfile, SourceInfo

    return EntityProfile(
        id=character.id,
        name=character.name,
        entity_type=character.entity_type,
        source=SourceInfo(**character.source),
        description=character.short_lore,
        wikipedia_summary=character.lore,
        claims_count=int(character.rarity_score),
        sitelinks_count=int(character.rarity_score),
    )
