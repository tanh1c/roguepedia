from pathlib import Path

from scripts.generate_character import generation_mode, generated_character_path, should_generate_cards


def test_generated_character_path_uses_qid_filename(tmp_path: Path):
    assert generated_character_path(tmp_path, "Q9312") == tmp_path / "generated" / "characters" / "Q9312.json"


def test_should_generate_cards_requires_with_cards_flag():
    assert should_generate_cards(no_llm=True, with_cards=True) is True
    assert should_generate_cards(no_llm=True, with_cards=False) is False


def test_generation_mode_uses_fallback_when_no_llm_provider_configured():
    assert generation_mode(no_llm=False, with_cards=False, llm_provider="none") == "deterministic_fallback"
    assert generation_mode(no_llm=True, with_cards=True, llm_provider="none") == "no_llm_with_cards"
    assert generation_mode(no_llm=False, with_cards=False, llm_provider="fake") == "llm"
