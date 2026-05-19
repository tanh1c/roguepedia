import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia.collectors.entity_collector import RawEntityCollector
from roguepedia.config import settings
from roguepedia.generation.character_assembler import assemble_no_llm_character, assemble_no_llm_character_with_cards
from roguepedia.generation.deepseek_client import DeepSeekClient
from roguepedia.generation.llm_retry import generate_with_repair
from roguepedia.normalizers.profile_normalizer import normalize_entity_profile
from roguepedia.validation.card_package_validator import apply_card_package
from roguepedia.storage.json_store import write_json


def generated_character_path(data_dir: Path, qid: str) -> Path:
    return data_dir / "generated" / "characters" / f"{qid}.json"


def should_generate_cards(*, no_llm: bool, with_cards: bool) -> bool:
    return no_llm and with_cards


def generation_mode(*, no_llm: bool, with_cards: bool, llm_provider: str) -> str:
    if no_llm and with_cards:
        return "no_llm_with_cards"
    if no_llm:
        return "no_llm"
    if llm_provider == "none":
        return "deterministic_fallback"
    return "llm"


def make_llm_client(*, llm_provider: str, api_key: str, model: str):
    if llm_provider != "deepseek":
        raise ValueError(f"Unsupported LLM_PROVIDER: {llm_provider}")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek")
    return DeepSeekClient(api_key=api_key, model=model or "deepseek-v4-flash")


def should_fallback_after_llm_error(error: Exception) -> bool:
    return isinstance(error, ValueError)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Roguepedia game character")
    parser.add_argument("name", help="Entity name to search")
    parser.add_argument("--language", default="en")
    parser.add_argument("--no-llm", action="store_true", help="Use deterministic generation only")
    parser.add_argument("--with-cards", action="store_true", help="Include deterministic template cards")
    args = parser.parse_args()

    mode = generation_mode(no_llm=args.no_llm, with_cards=args.with_cards, llm_provider=settings.llm_provider)

    collector = RawEntityCollector()
    result = collector.collect_by_name(args.name, language=args.language)
    profile = normalize_entity_profile(result.wikidata, result.wikipedia.raw if result.wikipedia else None)
    if mode in {"no_llm_with_cards", "deterministic_fallback"}:
        character = assemble_no_llm_character_with_cards(profile)
        if mode == "deterministic_fallback":
            character.generation_metadata["fallback_reason"] = "llm_provider_not_configured"
    elif mode == "llm":
        base_character = assemble_no_llm_character(profile)
        client = make_llm_client(
            llm_provider=settings.llm_provider,
            api_key=settings.llm_api_key,
            model=settings.llm_model or "deepseek-v4-flash",
        )
        try:
            package = generate_with_repair(client, base_character, max_attempts=2)
            character = apply_card_package(base_character, package, fallback=True)
        except Exception as exc:
            if not should_fallback_after_llm_error(exc):
                raise
            character = assemble_no_llm_character_with_cards(profile)
            character.generation_metadata["fallback_reason"] = "llm_error"
    else:
        character = assemble_no_llm_character(profile)
    path = generated_character_path(settings.data_dir, character.id)
    write_json(path, character.model_dump(mode="json"))

    print(f"Character: {character.id} {character.name}")
    print(f"Era: {character.era}")
    print(f"Class: {character.character_class}")
    print(f"Domain: {character.domain}")
    print(f"Role: {character.role}")
    print(f"Rarity: {character.rarity} ({character.rarity_score:.1f})")
    print(f"Tags: {', '.join(character.tags)}")
    print(f"Cards: {len(character.cards)}")
    print(f"Mode: {mode}")
    print(f"Saved: {path}")


if __name__ == "__main__":
    main()
