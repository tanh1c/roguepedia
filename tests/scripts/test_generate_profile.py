from pathlib import Path

from scripts.generate_profile import normalized_profile_path


def test_normalized_profile_path_uses_qid_filename(tmp_path: Path):
    assert normalized_profile_path(tmp_path, "Q9036") == tmp_path / "normalized" / "Q9036.json"
