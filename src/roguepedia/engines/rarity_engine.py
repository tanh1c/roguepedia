from roguepedia.schemas.evidence import EvidenceItem, EvidenceResult
from roguepedia.schemas.profile import EntityProfile


def infer_rarity(profile: EntityProfile) -> EvidenceResult:
    length_score = min(75.0, profile.wiki_word_count / 220.0)
    reference_score = min(25.0, profile.wiki_reference_count * 0.10)
    score = min(100.0, length_score + reference_score)

    if score >= 92:
        rarity = "legendary"
    elif score >= 72:
        rarity = "rare"
    elif score >= 45:
        rarity = "uncommon"
    else:
        rarity = "common"

    return EvidenceResult(
        value=rarity,
        score=score,
        evidence=[
            EvidenceItem(field="wiki_word_count", matched=str(profile.wiki_word_count), weight=1 / 220),
            EvidenceItem(field="wiki_reference_count", matched=str(profile.wiki_reference_count), weight=0.10),
        ],
    )
