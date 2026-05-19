import argparse
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia.collectors.entity_collector import RawEntityCollector


def format_inspection(
    *,
    qid: str,
    label: str,
    description: str | None,
    wikidata_url: str,
    wikipedia_url: str | None,
    summary: str | None,
    image_url: str | None,
) -> str:
    lines = [
        f"QID: {qid}",
        f"Label: {label}",
        f"Description: {description or '-'}",
        f"Wikidata: {wikidata_url}",
        f"Wikipedia: {wikipedia_url or '-'}",
        f"Image: {image_url or '-'}",
        "",
        "Summary:",
        summary or "-",
    ]
    return "\n".join(lines)


def description_from_entity(entity: dict[str, Any], language: str = "en") -> str | None:
    return entity.get("descriptions", {}).get(language, {}).get("value")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a Wikidata/Wikipedia entity")
    parser.add_argument("name", help="Entity name to search")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    collector = RawEntityCollector()
    result = collector.collect_by_name(args.name, language=args.language)
    wiki = result.wikipedia

    print(
        format_inspection(
            qid=result.qid,
            label=result.label,
            description=description_from_entity(result.wikidata, args.language),
            wikidata_url=f"https://www.wikidata.org/wiki/{result.qid}",
            wikipedia_url=wiki.url if wiki else None,
            summary=wiki.extract if wiki else None,
            image_url=wiki.image_url if wiki else None,
        )
    )


if __name__ == "__main__":
    main()
