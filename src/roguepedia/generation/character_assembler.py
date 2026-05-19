from roguepedia.engines.class_engine import infer_character_class
from roguepedia.engines.domain_engine import infer_domain
from roguepedia.engines.era_engine import infer_era
from roguepedia.engines.rarity_engine import infer_rarity
from roguepedia.engines.role_engine import infer_role
from roguepedia.engines.stat_engine import infer_stats
from roguepedia.engines.tag_engine import infer_tags
from roguepedia.schemas.character import GameCharacter, ValidationReport
from roguepedia.schemas.evidence import EvidenceResult
from roguepedia.schemas.profile import EntityProfile


def evidence_payload(result: EvidenceResult) -> list[dict]:
    return [item.model_dump(mode="json") for item in result.evidence]


def assemble_no_llm_character(profile: EntityProfile) -> GameCharacter:
    era = infer_era(profile)
    domain = infer_domain(profile)
    character_class = infer_character_class(profile)
    role = infer_role(profile)
    rarity = infer_rarity(profile)
    stats = infer_stats(
        profile,
        character_class=character_class.value,
        role=role.value,
        domain=domain.value,
    )
    tags = infer_tags(
        profile,
        domain=domain.value,
        character_class=character_class.value,
        role=role.value,
    )

    return GameCharacter(
        id=profile.id,
        name=profile.name,
        entity_type=profile.entity_type,
        source=profile.source.model_dump(mode="json"),
        image_url=profile.source.image_url,
        era=era.value,
        character_class=character_class.value,
        role=role.value,
        domain=domain.value,
        rarity=rarity.value,
        rarity_score=rarity.score,
        stats=stats,
        tags=tags,
        cards=[],
        passive_trait=None,
        lore=profile.wikipedia_summary or profile.description or profile.name,
        short_lore=profile.description or profile.name,
        validation=ValidationReport(schema_valid=True, grounded=True, safety_valid=not profile.is_living_person_candidate),
        generation_metadata={
            "llm_used": False,
            "evidence": {
                "era": evidence_payload(era),
                "domain": evidence_payload(domain),
                "character_class": evidence_payload(character_class),
                "role": evidence_payload(role),
                "rarity": evidence_payload(rarity),
            },
        },
    )
