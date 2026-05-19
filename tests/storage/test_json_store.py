from pathlib import Path

from roguepedia.storage.json_store import read_json, write_json


def test_write_and_read_json(tmp_path: Path):
    path = tmp_path / "nested" / "data.json"

    write_json(path, {"id": "Q9036", "name": "Nikola Tesla"})

    assert read_json(path) == {"id": "Q9036", "name": "Nikola Tesla"}
