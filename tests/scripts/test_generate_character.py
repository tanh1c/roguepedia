from pathlib import Path

from scripts.generate_character import generated_character_path, should_generate_cards


def test_generated_character_path_uses_qid_filename(tmp_path: Path):
    assert generated_character_path(tmp_path, "Q9312") == tmp_path / "generated" / "characters" / "Q9312.json"


def test_should_generate_cards_requires_with_cards_flag():
    assert should_generate_cards(no_llm=True, with_cards=True) is True
    assert should_generate_cards(no_llm=True, with_cards=False) is False
