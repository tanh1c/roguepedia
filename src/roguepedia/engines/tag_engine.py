from roguepedia.schemas.profile import EntityProfile

TAG_KEYWORDS = [
    "war",
    "strategy",
    "tactics",
    "science",
    "invention",
    "radiation",
    "survival",
    "nature",
    "art",
]


def infer_tags(profile: EntityProfile, *, domain: str, character_class: str, role: str) -> list[str]:
    tags = [domain, character_class, role]
    if character_class == "survivor":
        tags.append("survival")
    text = profile.source_text().lower()
    for keyword in TAG_KEYWORDS:
        if keyword in text and keyword not in tags:
            tags.append(keyword)
    return tags
