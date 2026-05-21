from pathlib import Path

from scripts.export_game_data import export_path, frontend_export_path, frontend_skill_codex_path, load_exportable_characters, runtime_rarity, skill_codex_export_path, write_export
from roguepedia.storage.json_store import read_json, write_json


def test_export_path_uses_data_exports_directory(tmp_path: Path):
    assert export_path(tmp_path) == tmp_path / "exports" / "game_characters.json"


def test_skill_codex_export_path_uses_data_exports_directory(tmp_path: Path):
    assert skill_codex_export_path(tmp_path) == tmp_path / "exports" / "skill_codex.json"


def test_frontend_export_path_uses_frontend_game_directory(tmp_path: Path):
    assert frontend_export_path(tmp_path) == tmp_path / "frontend" / "src" / "game" / "gameCharacters.json"


def test_frontend_skill_codex_path_uses_frontend_game_directory(tmp_path: Path):
    assert frontend_skill_codex_path(tmp_path) == tmp_path / "frontend" / "src" / "game" / "skillCodex.json"


def write_character_fixtures(tmp_path: Path) -> None:
    characters_dir = tmp_path / "generated" / "characters"
    write_json(
        characters_dir / "Q1.json",
        {
            "id": "Q1",
            "name": "Accepted",
            "rarity": "legendary",
            "rarity_score": 92.0,
            "cards": [{"id": "c1"}],
            "validation": {
                "schema_valid": True,
                "grounded": True,
                "mechanics_valid": True,
                "balance_valid": True,
                "safety_valid": True,
                "warnings": [],
                "rejected_reasons": [],
            },
        },
    )
    write_json(
        characters_dir / "Q2.json",
        {
            "id": "Q2",
            "name": "Rejected",
            "cards": [],
            "validation": {
                "schema_valid": True,
                "grounded": False,
                "mechanics_valid": False,
                "balance_valid": False,
                "safety_valid": True,
                "warnings": [],
                "rejected_reasons": ["bad"],
            },
        },
    )


def test_load_exportable_characters_keeps_valid_playable_characters(tmp_path: Path):
    write_character_fixtures(tmp_path)

    exported = load_exportable_characters(tmp_path)

    assert [character["id"] for character in exported] == ["Q1"]


def test_write_export_writes_backend_and_frontend_files(tmp_path: Path):
    write_character_fixtures(tmp_path)

    path = write_export(tmp_path, project_root=tmp_path)

    assert path == tmp_path / "exports" / "game_characters.json"
    assert path.exists()
    assert frontend_export_path(tmp_path).exists()
    assert skill_codex_export_path(tmp_path).exists()
    assert frontend_skill_codex_path(tmp_path).exists()


def test_write_export_writes_full_skill_codex(tmp_path: Path):
    write_character_fixtures(tmp_path)

    write_export(tmp_path, project_root=tmp_path)

    skill_codex = read_json(frontend_skill_codex_path(tmp_path))
    assert len(skill_codex) >= 220
    assert {card["owner_character_id"] for card in skill_codex} == {"skill-codex"}
    assert {card["upgraded"] for card in skill_codex} == {False}
    assert {card["grounding"]["inspired_by"] for card in skill_codex}


def test_write_export_maps_backend_rarity_to_runtime_tiers(tmp_path: Path):
    write_character_fixtures(tmp_path)

    write_export(tmp_path, project_root=tmp_path)

    exported = read_json(frontend_export_path(tmp_path))
    assert exported[0]["rarity"] == "S"


def test_runtime_rarity_requires_exceptional_scores_for_s_tier():
    assert runtime_rarity("legendary", 91.9) == "A"
    assert runtime_rarity("legendary", 92.0) == "S"
    assert runtime_rarity("rare", 72.0) == "A"
    assert runtime_rarity("uncommon", 45.0) == "B"
    assert runtime_rarity("common", 20.0) == "C"
    assert runtime_rarity("common", 10.0) == "D"
