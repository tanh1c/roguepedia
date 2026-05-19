from pathlib import Path

from scripts.generate_character import generated_character_path


def test_generated_character_path_uses_qid_filename(tmp_path: Path):
    assert generated_character_path(tmp_path, "Q9312") == tmp_path / "generated" / "characters" / "Q9312.json"
