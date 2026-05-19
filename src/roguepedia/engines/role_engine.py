from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile

ROLE_KEYWORDS = {
    "tank": ["survive", "survives", "survival", "resilient", "extreme", "defense", "radiation"],
    "control": ["strategy", "strategist", "tactics", "military", "general", "war"],
    "support": ["scientist", "teacher", "research", "knowledge", "medicine"],
    "damage": ["warrior", "weapon", "attack", "conqueror"],
}


def infer_role(profile: EntityProfile) -> EvidenceResult:
    if profile.entity_type == "organism":
        return EvidenceResult(
            value="tank",
            score=1.0,
            evidence=[EvidenceItem(field="entity_type", matched="organism", weight=1.0)],
        )

    text = profile.source_text().lower()
    for role, keywords in ROLE_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in text]
        if matched:
            return EvidenceResult(
                value=role,
                score=float(len(matched)),
                evidence=[EvidenceItem(field="source_text", matched=word, weight=1.0) for word in matched],
            )

    return EvidenceResult(value="balanced", score=0.0)
