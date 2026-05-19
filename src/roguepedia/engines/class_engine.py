from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile

CLASS_KEYWORDS = {
    "survivor": ["survive", "survival", "resilient", "extreme", "radiation", "dehydration"],
    "scholar": ["scientist", "physicist", "chemist", "inventor", "engineer", "studied", "nobel"],
    "tactician": ["strategy", "strategist", "general", "military", "war", "tactics"],
    "artist": ["artist", "writer", "poet", "composer", "painter"],
}


def infer_character_class(profile: EntityProfile) -> EvidenceResult:
    text = profile.source_text().lower()
    for character_class, keywords in CLASS_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in text]
        if matched:
            return EvidenceResult(
                value=character_class,
                score=float(len(matched)),
                evidence=[EvidenceItem(field="source_text", matched=word, weight=1.0) for word in matched],
            )

    return EvidenceResult(value="adventurer", score=0.0)
