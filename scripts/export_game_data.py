import argparse
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia.config import settings
from roguepedia.generation.card_pool import CARD_POOL
from roguepedia.generation.card_pool_builder import instantiate_pool_card
from roguepedia.generation.card_pool_builder import CharacterCardProfile
from roguepedia.storage.json_store import read_json, write_json


def export_path(data_dir: Path) -> Path:
    return data_dir / "exports" / "game_characters.json"


def skill_codex_export_path(data_dir: Path) -> Path:
    return data_dir / "exports" / "skill_codex.json"


def frontend_export_path(project_root: Path) -> Path:
    return project_root / "frontend" / "src" / "game" / "gameCharacters.json"


def frontend_skill_codex_path(project_root: Path) -> Path:
    return project_root / "frontend" / "src" / "game" / "skillCodex.json"


def load_exportable_characters(data_dir: Path) -> list[dict[str, Any]]:
    characters_dir = data_dir / "generated" / "characters"
    characters: list[dict[str, Any]] = []
    for path in sorted(characters_dir.glob("*.json")):
        character = read_json(path)
        if is_exportable_character(character):
            characters.append(character)
    return characters


def is_exportable_character(character: dict[str, Any]) -> bool:
    validation = character.get("validation", {})
    return (
        bool(character.get("cards"))
        and validation.get("schema_valid") is True
        and validation.get("grounded") is True
        and validation.get("mechanics_valid") is True
        and validation.get("balance_valid") is True
        and validation.get("safety_valid") is True
    )


def write_export(data_dir: Path, *, limit: int | None = None, project_root: Path | None = None) -> Path:
    characters = load_exportable_characters(data_dir)
    if limit is not None:
        characters = characters[:limit]
    runtime_characters = [to_runtime_character(character) for character in characters]
    runtime_skill_codex = build_runtime_skill_codex()
    path = export_path(data_dir)
    write_json(path, runtime_characters)
    write_json(skill_codex_export_path(data_dir), runtime_skill_codex)
    write_json(frontend_export_path(project_root or Path.cwd()), runtime_characters)
    write_json(frontend_skill_codex_path(project_root or Path.cwd()), runtime_skill_codex)
    return path


def to_runtime_character(character: dict[str, Any]) -> dict[str, Any]:
    return {**character, "rarity": runtime_rarity(character.get("rarity"), character.get("rarity_score", 0))}


def build_runtime_skill_codex() -> list[dict[str, Any]]:
    profile = CharacterCardProfile(
        character_id="skill-codex",
        domain="Knowledge",
        role="Support",
        character_class="Archivist",
        tags=[],
        rarity="S",
    )
    return [
        instantiate_pool_card(template, profile, "Skill Codex", template.tags).model_dump(mode="json")
        for template in sorted(CARD_POOL, key=lambda card: (card.domains[0] if card.domains else "global", card.card_type, card.name))
    ]


def runtime_rarity(rarity: str | None, score: float | int) -> str:
    if rarity == "legendary" and score >= 92:
        return "S"
    if score >= 72:
        return "A"
    if score >= 45:
        return "B"
    if score >= 20:
        return "C"
    return "D"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export accepted Roguepedia characters for the frontend")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    path = write_export(settings.data_dir, limit=args.limit)
    print(f"Exported: {len(load_exportable_characters(settings.data_dir))}")
    print(f"Saved: {path}")


if __name__ == "__main__":
    main()
