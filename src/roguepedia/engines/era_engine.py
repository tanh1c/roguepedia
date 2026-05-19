from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile


def infer_era(profile: EntityProfile) -> EvidenceResult:
    year = profile.birth_year or (profile.active_years[0] if profile.active_years else None)
    if year is None:
        return EvidenceResult(value="unknown", score=0.0)

    if year < 500:
        era = "ancient"
    elif year < 1500:
        era = "medieval"
    elif year < 1800:
        era = "early_modern"
    elif year < 1950:
        era = "modern"
    else:
        era = "contemporary"

    return EvidenceResult(
        value=era,
        score=1.0,
        evidence=[EvidenceItem(field="birth_year", matched=str(year), weight=1.0)],
    )
