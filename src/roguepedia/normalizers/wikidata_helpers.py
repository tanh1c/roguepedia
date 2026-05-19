from typing import Any


def english_label(entity: dict[str, Any]) -> str | None:
    return entity.get("labels", {}).get("en", {}).get("value")


def english_description(entity: dict[str, Any]) -> str | None:
    return entity.get("descriptions", {}).get("en", {}).get("value")


def english_aliases(entity: dict[str, Any]) -> list[str]:
    return [alias["value"] for alias in entity.get("aliases", {}).get("en", []) if alias.get("value")]


def sitelink_title(entity: dict[str, Any], site: str = "enwiki") -> str | None:
    return entity.get("sitelinks", {}).get(site, {}).get("title")


def claim_entity_ids(entity: dict[str, Any], property_id: str) -> list[str]:
    ids: list[str] = []
    for claim in entity.get("claims", {}).get(property_id, []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        if isinstance(value, dict) and value.get("id"):
            ids.append(value["id"])
    return ids


def claim_time_years(entity: dict[str, Any], property_id: str) -> list[int]:
    years: list[int] = []
    for claim in entity.get("claims", {}).get(property_id, []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        time_value = value.get("time") if isinstance(value, dict) else None
        if time_value:
            years.append(int(time_value[:5]))
    return years
