from pathlib import Path

from scripts.generate_character import generation_mode, generated_character_path, make_llm_client, should_generate_cards, should_fallback_after_llm_error


def test_generated_character_path_uses_qid_filename(tmp_path: Path):
    assert generated_character_path(tmp_path, "Q9312") == tmp_path / "generated" / "characters" / "Q9312.json"


def test_should_generate_cards_requires_with_cards_flag():
    assert should_generate_cards(no_llm=True, with_cards=True) is True
    assert should_generate_cards(no_llm=True, with_cards=False) is False


def test_generation_mode_uses_fallback_when_no_llm_provider_configured():
    assert generation_mode(no_llm=False, with_cards=False, llm_provider="none") == "deterministic_fallback"
    assert generation_mode(no_llm=True, with_cards=True, llm_provider="none") == "no_llm_with_cards"
    assert generation_mode(no_llm=False, with_cards=False, llm_provider="deepseek") == "llm"


def test_make_llm_client_builds_deepseek_client():
    client = make_llm_client(llm_provider="deepseek", api_key="test-key", model="deepseek-v4-flash")

    assert client.__class__.__name__ == "DeepSeekClient"
    assert client.model == "deepseek-v4-flash"


def test_make_llm_client_rejects_missing_deepseek_key():
    try:
        make_llm_client(llm_provider="deepseek", api_key="", model="deepseek-v4-flash")
    except ValueError as exc:
        assert str(exc) == "DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek"
    else:
        raise AssertionError("expected ValueError")


def test_should_fallback_after_llm_error_for_validation_failures():
    assert should_fallback_after_llm_error(ValueError("Invalid card package")) is True
