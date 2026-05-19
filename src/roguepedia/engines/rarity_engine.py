from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile


def infer_rarity(profile: EntityProfile) -> EvidenceResult:
    score = min(100.0, profile.sitelinks_count * 0.5 + profile.claims_count * 0.2)
    if score >= 80:
        rarity = "legendary"
    elif score >= 50:
        rarity = "rare"
    elif score >= 25:
        rarity = "uncommon"
    else:
        rarity = "common"

    return EvidenceResult(
        value=rarity,
        score=score,
        evidence=[
            EvidenceItem(field="sitelinks_count", matched=str(profile.sitelinks_count), weight=0.5),
            EvidenceItem(field="claims_count", matched=str(profile.claims_count), weight=0.2),
        ],
    )
