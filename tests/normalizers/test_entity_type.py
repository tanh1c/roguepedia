from roguepedia.normalizers.entity_type import detect_entity_type


def test_detects_human_from_instance_of_q5():
    assert detect_entity_type(["Q5"]) == "human"


def test_detects_organism_from_taxon_instance():
    assert detect_entity_type(["Q16521"]) == "organism"


def test_detects_unknown_when_no_known_ids_match():
    assert detect_entity_type(["Q43229"]) == "unknown"
