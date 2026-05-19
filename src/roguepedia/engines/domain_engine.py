from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile

DOMAIN_KEYWORDS = {
    "strategy": ["strategy", "strategist", "military", "general", "war", "tactics"],
    "science": ["science", "scientist", "physicist", "chemist", "inventor", "engineer", "radioactivity"],
    "nature": ["animal", "organism", "species", "taxon", "moss", "water", "survive", "resilient"],
    "art": ["artist", "writer", "poet", "composer", "painter", "music"],
}


def infer_domain(profile: EntityProfile) -> EvidenceResult:
    if profile.entity_type == "organism":
        return EvidenceResult(
            value="nature",
            score=1.0,
            evidence=[EvidenceItem(field="entity_type", matched="organism", weight=1.0)],
        )

    text = profile.source_text().lower()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in text]
        if matched:
            return EvidenceResult(
                value=domain,
                score=float(len(matched)),
                evidence=[EvidenceItem(field="source_text", matched=word, weight=1.0) for word in matched],
            )

    return EvidenceResult(value="general", score=0.0)
