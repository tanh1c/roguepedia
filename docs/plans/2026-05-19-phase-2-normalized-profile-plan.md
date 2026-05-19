# Phase 2 Normalized Profile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert cached raw Wikidata/Wikipedia payloads into validated `EntityProfile` objects with basic safety precheck for living humans.

**Architecture:** Keep Phase 2 deterministic and source-grounded. Add small Wikidata parsing helpers, normalize raw payloads into the existing `EntityProfile` schema, apply a safety precheck, then expose a CLI that collects raw data and writes `data/normalized/{qid}.json`.

**Tech Stack:** Python 3.11+, Pydantic, pytest, httpx clients from Phase 1, JSON storage helpers.

---

## Task 2.1: Add Wikidata value parsing helpers

**Files:**

- Create: `src/roguepedia/normalizers/wikidata_helpers.py`
- Test: `tests/normalizers/test_wikidata_helpers.py`

**Step 1: Write failing tests**

Create `tests/normalizers/test_wikidata_helpers.py`:

```python
from roguepedia.normalizers.wikidata_helpers import (
    claim_entity_ids,
    claim_time_years,
    english_aliases,
    english_description,
    english_label,
    sitelink_title,
)


def test_extracts_english_label_description_aliases_and_sitelink():
    entity = {
        "labels": {"en": {"value": "Nikola Tesla"}},
        "descriptions": {"en": {"value": "inventor and engineer"}},
        "aliases": {"en": [{"value": "Tesla"}, {"value": "Никола Тесла"}]},
        "sitelinks": {"enwiki": {"title": "Nikola Tesla"}},
    }

    assert english_label(entity) == "Nikola Tesla"
    assert english_description(entity) == "inventor and engineer"
    assert english_aliases(entity) == ["Tesla", "Никола Тесла"]
    assert sitelink_title(entity) == "Nikola Tesla"


def test_extracts_entity_ids_from_claims():
    entity = {
        "claims": {
            "P31": [
                {"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}},
                {"mainsnak": {"datavalue": {"value": {"id": "Q215627"}}}},
            ]
        }
    }

    assert claim_entity_ids(entity, "P31") == ["Q5", "Q215627"]


def test_extracts_years_from_time_claims():
    entity = {
        "claims": {
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1856-07-10T00:00:00Z"}}}}],
            "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1943-01-07T00:00:00Z"}}}}],
        }
    }

    assert claim_time_years(entity, "P569") == [1856]
    assert claim_time_years(entity, "P570") == [1943]
```

**Step 2: Run tests to verify failure**

```bash
python -m pytest tests/normalizers/test_wikidata_helpers.py -v
```

Expected: FAIL because helper module does not exist.

**Step 3: Implement helpers**

Create `src/roguepedia/normalizers/wikidata_helpers.py`:

```python
from typing import Any


def english_label(entity: dict[str, Any]) -> str | None:
    return entity.get("labels", {}).get("en", {}).get("value")


def english_description(entity: dict[str, Any]) -> str | None:
    return entity.get("descriptions", {}).get("en", {}).get("value")


def english_aliases(entity: dict[str, Any]) -> list[str]:
    return [alias["value"] for alias in entity.get("aliases", {}).get("en", []) if alias.get("value")]


def sitelink_title(entity: dict[str, Any], site: str = "enwiki") -> str | None:
    return entity.get("sitelinks", {}).get(site, {}).get("title")


def claim_entity_ids(entity: dict[str, Any], property_id: str) -> list[str]:
    ids: list[str] = []
    for claim in entity.get("claims", {}).get(property_id, []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        if isinstance(value, dict) and value.get("id"):
            ids.append(value["id"])
    return ids


def claim_time_years(entity: dict[str, Any], property_id: str) -> list[int]:
    years: list[int] = []
    for claim in entity.get("claims", {}).get(property_id, []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        time_value = value.get("time") if isinstance(value, dict) else None
        if time_value:
            years.append(int(time_value[:5]))
    return years
```

**Step 4: Run tests**

```bash
python -m pytest tests/normalizers/test_wikidata_helpers.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/roguepedia/normalizers/wikidata_helpers.py tests/normalizers/test_wikidata_helpers.py
git commit -m "feat: add wikidata parsing helpers"
```

---

## Task 2.2: Add entity type and safety precheck helpers

**Files:**

- Create: `src/roguepedia/normalizers/entity_type.py`
- Create: `src/roguepedia/validation/safety.py`
- Test: `tests/normalizers/test_entity_type.py`
- Test: `tests/validation/test_safety.py`

**Step 1: Write failing entity type tests**

Create `tests/normalizers/test_entity_type.py`:

```python
from roguepedia.normalizers.entity_type import detect_entity_type


def test_detects_human_from_instance_of_q5():
    assert detect_entity_type(["Q5"]) == "human"


def test_detects_organism_from_taxon_instance():
    assert detect_entity_type(["Q16521"]) == "organism"


def test_detects_unknown_when_no_known_ids_match():
    assert detect_entity_type(["Q43229"]) == "unknown"
```

**Step 2: Write failing safety tests**

Create `tests/validation/test_safety.py`:

```python
from roguepedia.validation.safety import is_living_human_candidate


def test_flags_human_with_birth_year_and_no_death_year():
    assert is_living_human_candidate("human", birth_year=1980, death_year=None) is True


def test_does_not_flag_deceased_human():
    assert is_living_human_candidate("human", birth_year=1856, death_year=1943) is False


def test_does_not_flag_non_human():
    assert is_living_human_candidate("organism", birth_year=None, death_year=None) is False
```

**Step 3: Run tests to verify failure**

```bash
python -m pytest tests/normalizers/test_entity_type.py tests/validation/test_safety.py -v
```

Expected: FAIL because modules do not exist.

**Step 4: Implement entity type helper**

Create `src/roguepedia/normalizers/entity_type.py`:

```python
HUMAN_INSTANCE_IDS = {"Q5"}
ORGANISM_INSTANCE_IDS = {"Q16521", "Q7432", "Q729", "Q7239"}


def detect_entity_type(instance_of_ids: list[str]) -> str:
    ids = set(instance_of_ids)
    if ids & HUMAN_INSTANCE_IDS:
        return "human"
    if ids & ORGANISM_INSTANCE_IDS:
        return "organism"
    return "unknown"
```

**Step 5: Implement safety helper**

Create `src/roguepedia/validation/safety.py`:

```python
def is_living_human_candidate(entity_type: str, birth_year: int | None, death_year: int | None) -> bool:
    return entity_type == "human" and birth_year is not None and death_year is None
```

**Step 6: Run tests**

```bash
python -m pytest tests/normalizers/test_entity_type.py tests/validation/test_safety.py -v
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/roguepedia/normalizers/entity_type.py src/roguepedia/validation/safety.py tests/normalizers/test_entity_type.py tests/validation/test_safety.py
git commit -m "feat: add entity type and safety precheck"
```

---

## Task 2.3: Implement profile normalizer

**Files:**

- Create: `src/roguepedia/normalizers/profile_normalizer.py`
- Test: `tests/normalizers/test_profile_normalizer.py`

**Step 1: Write failing tests**

Create `tests/normalizers/test_profile_normalizer.py`:

```python
from roguepedia.normalizers.profile_normalizer import normalize_entity_profile


def test_normalizes_human_profile_from_raw_payloads():
    wikidata = {
        "id": "Q9036",
        "labels": {"en": {"value": "Nikola Tesla"}},
        "descriptions": {"en": {"value": "inventor and engineer"}},
        "aliases": {"en": [{"value": "Tesla"}]},
        "claims": {
            "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1856-07-10T00:00:00Z"}}}}],
            "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1943-01-07T00:00:00Z"}}}}],
        },
        "sitelinks": {"enwiki": {"title": "Nikola Tesla"}},
    }
    wikipedia = {
        "title": "Nikola Tesla",
        "extract": "Nikola Tesla was an inventor and electrical engineer.",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Nikola_Tesla"}},
        "thumbnail": {"source": "https://example.test/tesla.jpg"},
    }

    profile = normalize_entity_profile(wikidata, wikipedia)

    assert profile.id == "Q9036"
    assert profile.name == "Nikola Tesla"
    assert profile.entity_type == "human"
    assert profile.birth_year == 1856
    assert profile.death_year == 1943
    assert profile.source.wikipedia_title == "Nikola Tesla"
    assert profile.is_living_person_candidate is False


def test_flags_living_human_candidate():
    wikidata = {
        "id": "Q42",
        "labels": {"en": {"value": "Example Person"}},
        "claims": {
            "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
            "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1980-01-01T00:00:00Z"}}}}],
        },
        "sitelinks": {},
    }

    profile = normalize_entity_profile(wikidata, None)

    assert profile.is_living_person_candidate is True
```

**Step 2: Run tests to verify failure**

```bash
python -m pytest tests/normalizers/test_profile_normalizer.py -v
```

Expected: FAIL because normalizer module does not exist.

**Step 3: Implement normalizer**

Create `src/roguepedia/normalizers/profile_normalizer.py`:

```python
from typing import Any

from roguepedia.normalizers.entity_type import detect_entity_type
from roguepedia.normalizers.wikidata_helpers import (
    claim_entity_ids,
    claim_time_years,
    english_aliases,
    english_description,
    english_label,
    sitelink_title,
)
from roguepedia.schemas.profile import EntityProfile, SourceInfo
from roguepedia.validation.safety import is_living_human_candidate


def normalize_entity_profile(wikidata: dict[str, Any], wikipedia: dict[str, Any] | None = None) -> EntityProfile:
    qid = wikidata["id"]
    instance_of_ids = claim_entity_ids(wikidata, "P31")
    entity_type = detect_entity_type(instance_of_ids)
    birth_years = claim_time_years(wikidata, "P569")
    death_years = claim_time_years(wikidata, "P570")
    birth_year = birth_years[0] if birth_years else None
    death_year = death_years[0] if death_years else None
    wiki_title = sitelink_title(wikidata)

    source = SourceInfo(
        wikidata_id=qid,
        wikidata_url=f"https://www.wikidata.org/wiki/{qid}",
        wikipedia_title=wiki_title,
        wikipedia_url=(wikipedia or {}).get("content_urls", {}).get("desktop", {}).get("page"),
        image_url=(wikipedia or {}).get("thumbnail", {}).get("source"),
    )

    return EntityProfile(
        id=qid,
        name=english_label(wikidata) or qid,
        description=english_description(wikidata),
        entity_type=entity_type,
        source=source,
        aliases=english_aliases(wikidata),
        birth_year=birth_year,
        death_year=death_year,
        wikipedia_summary=(wikipedia or {}).get("extract"),
        wikipedia_extract=(wikipedia or {}).get("extract"),
        sitelinks_count=len(wikidata.get("sitelinks", {})),
        claims_count=sum(len(claims) for claims in wikidata.get("claims", {}).values()),
        instance_of_labels=instance_of_ids,
        is_living_person_candidate=is_living_human_candidate(entity_type, birth_year, death_year),
        raw_wikidata=wikidata,
        raw_wikipedia=wikipedia or {},
    )
```

**Step 4: Run tests**

```bash
python -m pytest tests/normalizers/test_profile_normalizer.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/roguepedia/normalizers/profile_normalizer.py tests/normalizers/test_profile_normalizer.py
git commit -m "feat: normalize raw entities into profiles"
```

---

## Task 2.4: Add profile generation CLI

**Files:**

- Create: `scripts/generate_profile.py`
- Test: `tests/scripts/test_generate_profile.py`

**Step 1: Write failing formatting/path test**

Create `tests/scripts/test_generate_profile.py`:

```python
from pathlib import Path

from scripts.generate_profile import normalized_profile_path


def test_normalized_profile_path_uses_qid_filename(tmp_path: Path):
    assert normalized_profile_path(tmp_path, "Q9036") == tmp_path / "normalized" / "Q9036.json"
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/scripts/test_generate_profile.py -v
```

Expected: FAIL because script does not exist.

**Step 3: Implement CLI**

Create `scripts/generate_profile.py`:

```python
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
```

**Step 4: Run test**

```bash
python -m pytest tests/scripts/test_generate_profile.py -v
```

Expected: PASS.

**Step 5: Run live smoke tests**

```bash
python scripts/generate_profile.py "Marie Curie"
python scripts/generate_profile.py "Octopus"
```

Expected: Each command prints profile details and writes `data/normalized/{qid}.json`.

**Step 6: Commit**

```bash
git add scripts/generate_profile.py tests/scripts/test_generate_profile.py data/normalized/.gitkeep
git commit -m "feat: add normalized profile generation cli"
```

Avoid committing generated normalized JSON payloads unless explicitly requested.

---

## Task 2.5: Add fixture-backed seed profile tests

**Files:**

- Create: `tests/fixtures/raw_tesla_wikidata.json`
- Create: `tests/fixtures/raw_tesla_wikipedia.json`
- Test: `tests/normalizers/test_seed_profiles.py`

**Step 1: Write fixture-backed tests**

Create compact fixture files with only fields needed by the normalizer.

Create `tests/normalizers/test_seed_profiles.py`:

```python
from pathlib import Path

from roguepedia.normalizers.profile_normalizer import normalize_entity_profile
from roguepedia.storage.json_store import read_json

FIXTURES = Path(__file__).parents[1] / "fixtures"


def test_tesla_fixture_normalizes_to_deceased_human():
    profile = normalize_entity_profile(
        read_json(FIXTURES / "raw_tesla_wikidata.json"),
        read_json(FIXTURES / "raw_tesla_wikipedia.json"),
    )

    assert profile.id == "Q9036"
    assert profile.entity_type == "human"
    assert profile.birth_year == 1856
    assert profile.death_year == 1943
    assert profile.is_living_person_candidate is False
```

**Step 2: Run test to verify it fails until fixtures exist**

```bash
python -m pytest tests/normalizers/test_seed_profiles.py -v
```

Expected: FAIL because fixtures do not exist.

**Step 3: Add compact fixtures**

Create `tests/fixtures/raw_tesla_wikidata.json`:

```json
{
  "id": "Q9036",
  "labels": {"en": {"value": "Nikola Tesla"}},
  "descriptions": {"en": {"value": "Serbian-American engineer and inventor"}},
  "aliases": {"en": [{"value": "Tesla"}]},
  "claims": {
    "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
    "P569": [{"mainsnak": {"datavalue": {"value": {"time": "+1856-07-10T00:00:00Z"}}}}],
    "P570": [{"mainsnak": {"datavalue": {"value": {"time": "+1943-01-07T00:00:00Z"}}}}]
  },
  "sitelinks": {"enwiki": {"title": "Nikola Tesla"}}
}
```

Create `tests/fixtures/raw_tesla_wikipedia.json`:

```json
{
  "title": "Nikola Tesla",
  "extract": "Nikola Tesla was a Serbian-American engineer and inventor.",
  "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Nikola_Tesla"}},
  "thumbnail": {"source": "https://example.test/tesla.jpg"}
}
```

**Step 4: Run tests**

```bash
python -m pytest tests/normalizers/test_seed_profiles.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/fixtures tests/normalizers/test_seed_profiles.py
git commit -m "test: add seed profile normalization fixture"
```

---

## Phase 2 Acceptance Verification

Run:

```bash
python scripts/generate_profile.py "Marie Curie"
python scripts/generate_profile.py "Octopus"
python -m pytest tests/normalizers tests/validation -v
```

Expected:

- Profiles validate against `EntityProfile`.
- Humans have birth/death years when available.
- Organisms have an organism entity type when instance claims match the supported taxonomy IDs.
- Living human candidates are flagged by safety precheck.
- Generated profile JSON files are written under `data/normalized/` but are not committed by default.

---

Plan complete and saved to `docs/plans/2026-05-19-phase-2-normalized-profile-plan.md`.
