import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia.collectors.entity_collector import RawEntityCollector
from roguepedia.config import settings
from roguepedia.generation.character_assembler import assemble_no_llm_character
from roguepedia.normalizers.profile_normalizer import normalize_entity_profile
from roguepedia.storage.json_store import write_json


def generated_character_path(data_dir: Path, qid: str) -> Path:
    return data_dir / "generated" / "characters" / f"{qid}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Roguepedia game character")
    parser.add_argument("name", help="Entity name to search")
    parser.add_argument("--language", default="en")
    parser.add_argument("--no-llm", action="store_true", help="Use deterministic generation only")
    args = parser.parse_args()

    if not args.no_llm:
        raise SystemExit("Only --no-llm generation is implemented")

    collector = RawEntityCollector()
    result = collector.collect_by_name(args.name, language=args.language)
    profile = normalize_entity_profile(result.wikidata, result.wikipedia.raw if result.wikipedia else None)
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
    print(f"Saved: {path}")


if __name__ == "__main__":
    main()
