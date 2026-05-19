HUMAN_INSTANCE_IDS = {"Q5"}
ORGANISM_INSTANCE_IDS = {"Q16521", "Q7432", "Q729", "Q7239"}


def detect_entity_type(instance_of_ids: list[str]) -> str:
    ids = set(instance_of_ids)
    if ids & HUMAN_INSTANCE_IDS:
        return "human"
    if ids & ORGANISM_INSTANCE_IDS:
        return "organism"
    return "unknown"
