from typing import Any

from roguepedia.normalizers.entity_type import detect_entity_type
from roguepedia.normalizers.wikidata_helpers import (
    claim_entity_ids,
    claim_time_years,
    english_aliases,
    english_description,
    english_label,
    sitelink_title,
)
from roguepedia.schemas.profile import EntityProfile, SourceInfo
from roguepedia.validation.safety import is_living_human_candidate


def normalize_entity_profile(wikidata: dict[str, Any], wikipedia: dict[str, Any] | None = None) -> EntityProfile:
    qid = wikidata["id"]
    instance_of_ids = claim_entity_ids(wikidata, "P31")
    entity_type = detect_entity_type(instance_of_ids)
    birth_years = claim_time_years(wikidata, "P569")
    death_years = claim_time_years(wikidata, "P570")
    birth_year = birth_years[0] if birth_years else None
    death_year = death_years[0] if death_years else None
    wiki_title = sitelink_title(wikidata)

    source = SourceInfo(
        wikidata_id=qid,
        wikidata_url=f"https://www.wikidata.org/wiki/{qid}",
        wikipedia_title=wiki_title,
        wikipedia_url=(wikipedia or {}).get("content_urls", {}).get("desktop", {}).get("page"),
        image_url=(wikipedia or {}).get("thumbnail", {}).get("source"),
    )

    return EntityProfile(
        id=qid,
        name=english_label(wikidata) or wiki_title or qid,
        description=english_description(wikidata),
        entity_type=entity_type,
        source=source,
        aliases=english_aliases(wikidata),
        birth_year=birth_year,
        death_year=death_year,
        wikipedia_summary=(wikipedia or {}).get("extract"),
        wikipedia_extract=(wikipedia or {}).get("extract"),
        sitelinks_count=len(wikidata.get("sitelinks", {})),
        claims_count=sum(len(claims) for claims in wikidata.get("claims", {}).values()),
        instance_of_labels=instance_of_ids,
        is_living_person_candidate=is_living_human_candidate(entity_type, birth_year, death_year),
        raw_wikidata=wikidata,
        raw_wikipedia=wikipedia or {},
    )
