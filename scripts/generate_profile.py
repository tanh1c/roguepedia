import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia.collectors.entity_collector import RawEntityCollector
from roguepedia.config import settings
from roguepedia.normalizers.profile_normalizer import normalize_entity_profile
from roguepedia.storage.json_store import write_json


def normalized_profile_path(data_dir: Path, qid: str) -> Path:
    return data_dir / "normalized" / f"{qid}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a normalized Roguepedia entity profile")
    parser.add_argument("name", help="Entity name to search")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    collector = RawEntityCollector()
    result = collector.collect_by_name(args.name, language=args.language)
    profile = normalize_entity_profile(
        result.wikidata,
        result.wikipedia.raw if result.wikipedia else None,
    )
    path = normalized_profile_path(settings.data_dir, profile.id)
    write_json(path, profile.model_dump(mode="json"))

    print(f"Profile: {profile.id} {profile.name}")
    print(f"Entity type: {profile.entity_type}")
    print(f"Living person candidate: {profile.is_living_person_candidate}")
    print(f"Saved: {path}")


if __name__ == "__main__":
    main()
