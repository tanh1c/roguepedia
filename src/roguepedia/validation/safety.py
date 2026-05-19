def is_living_human_candidate(entity_type: str, birth_year: int | None, death_year: int | None) -> bool:
    return entity_type == "human" and birth_year is not None and death_year is None
