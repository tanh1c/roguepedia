from roguepedia.validation.safety import is_living_human_candidate


def test_flags_human_with_birth_year_and_no_death_year():
    assert is_living_human_candidate("human", birth_year=1980, death_year=None) is True


def test_does_not_flag_deceased_human():
    assert is_living_human_candidate("human", birth_year=1856, death_year=1943) is False


def test_does_not_flag_non_human():
    assert is_living_human_candidate("organism", birth_year=None, death_year=None) is False
