from copy import deepcopy

from roguepedia.generation.character_assembler import assemble_no_llm_character_with_cards
from roguepedia.generation.llm_parser import CardPackage
from roguepedia.schemas.character import GameCharacter, ValidationReport
from roguepedia.validation.mechanics_validator import validate_mechanics


def validate_card_package(character: GameCharacter, package: CardPackage) -> ValidationReport:
    report = ValidationReport(schema_valid=True, safety_valid=character.validation.safety_valid)
    allowed_keywords = {tag.lower() for tag in character.tags}
    allowed_keywords.add(character.name.lower())

    for card in package.cards:
        for error in validate_mechanics(card.mechanics):
            report.rejected_reasons.append(f"{card.id}: {error}")
        for keyword in card.grounding.grounding_keywords:
            if keyword.lower() not in allowed_keywords:
                report.rejected_reasons.append(f"ungrounded keyword: {keyword}")

    for error in validate_mechanics(package.passive_trait.mechanics):
        report.rejected_reasons.append(f"{package.passive_trait.id}: {error}")
    for keyword in package.passive_trait.grounding.grounding_keywords:
        if keyword.lower() not in allowed_keywords:
            report.rejected_reasons.append(f"ungrounded keyword: {keyword}")

    report.mechanics_valid = not any("requires" in reason or "cannot" in reason for reason in report.rejected_reasons)
    report.grounded = not any(reason.startswith("ungrounded keyword") for reason in report.rejected_reasons)
    report.balance_valid = 5 <= len(package.cards) <= 6 or len(package.cards) == 1
    return report


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
