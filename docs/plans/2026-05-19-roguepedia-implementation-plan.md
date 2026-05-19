# Roguepedia Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Roguepedia as a web roguelike collection deck-builder whose playable characters and cards are generated from Wikipedia/Wikidata facts.

**Architecture:** Use a Python generation backend to fetch/normalize source facts, infer deterministic gameplay metadata, generate validated card packages, and export runtime JSON. Use a React + Phaser web client that consumes exported game data and never parses raw prose for combat mechanics.

**Tech Stack:** Python 3.11+, Pydantic, pytest, httpx, FastAPI later, SQLite later, React, TypeScript, Vite, Phaser, Vitest later.

---

## Current Project State

The project is greenfield and currently contains:

- `raw_plan.md`
- `docs/plans/2026-05-19-roguepedia-design.md`
- this implementation plan

The directory is not currently a git repository. If version control is desired, initialize git before implementation.

---

## Execution Rules

- Do not hardcode individual character outcomes.
- Only hardcode global schemas, formulas, templates, validators, and effect vocabularies.
- Use TDD for deterministic code.
- Keep frontend combat deterministic.
- Do not call an LLM during combat.
- Do not let natural-language card text drive mechanics.
- Every new mechanic kind must update schema, validator, combat resolver, tests, and generation prompt.
- Keep commits frequent if the project is initialized as a git repo.
- Review manually after Phase 3, Phase 5, Phase 6, Phase 8, and before ship.

---

# Phase 0 — Project Foundation

**Goal:** Create a stable backend/frontend workspace that future agents can extend without inventing structure.

**Acceptance:**

```bash
python -m pytest
python scripts/check_project.py
npm --prefix frontend run build
```

Expected:

- pytest passes.
- project check prints repository paths/config summary.
- frontend builds.

---

## Task 0.1: Create Python package scaffold

**Files:**

- Create: `pyproject.toml`
- Create: `src/roguepedia/__init__.py`
- Create: `src/roguepedia/config.py`
- Create: `scripts/check_project.py`
- Create: `tests/test_package_import.py`

**Step 1: Create `pyproject.toml`**

```toml
[project]
name = "roguepedia"
version = "0.1.0"
description = "Wikipedia/Wikidata-driven roguelike collection deck-builder generator"
requires-python = ">=3.11"
dependencies = [
    "pydantic>=2.7",
    "pydantic-settings>=2.2",
    "httpx>=0.27",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "ruff>=0.5",
]

[build-system]
requires = ["setuptools>=69", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]

[tool.ruff]
line-length = 100
src = ["src", "tests", "scripts"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
```

**Step 2: Create package init**

`src/roguepedia/__init__.py`:

```python
__version__ = "0.1.0"
```

**Step 3: Create config module**

`src/roguepedia/config.py`:

```python
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    data_dir: Path = Field(default=Path("data"))
    wikidata_api_url: str = "https://www.wikidata.org/w/api.php"
    wikidata_sparql_url: str = "https://query.wikidata.org/sparql"
    wikipedia_api_base: str = "https://en.wikipedia.org/api/rest_v1"
    allow_living_people: bool = False
    max_batch_size: int = 100
    cache_ttl_days: int = 30


settings = Settings()
```

**Step 4: Create project check script**

`scripts/check_project.py`:

```python
from roguepedia import __version__
from roguepedia.config import settings


def main() -> None:
    print(f"Roguepedia {__version__}")
    print(f"Environment: {settings.app_env}")
    print(f"Data directory: {settings.data_dir}")


if __name__ == "__main__":
    main()
```

**Step 5: Write import test**

`tests/test_package_import.py`:

```python
from roguepedia import __version__
from roguepedia.config import settings


def test_package_imports():
    assert __version__ == "0.1.0"
    assert settings.app_env == "development"
```

**Step 6: Run tests**

Run:

```bash
python -m pytest tests/test_package_import.py -v
```

Expected: PASS.

**Step 7: Run project check**

Run:

```bash
python scripts/check_project.py
```

Expected output contains `Roguepedia 0.1.0`.

**Step 8: Commit if git exists**

```bash
git add pyproject.toml src/ scripts/ tests/
git commit -m "chore: scaffold roguepedia python package"
```

Skip commit if no git repository exists.

---

## Task 0.2: Create environment and data directories

**Files:**

- Create: `.env.example`
- Create: `data/.gitkeep`
- Create: `data/raw/.gitkeep`
- Create: `data/raw/wikidata/.gitkeep`
- Create: `data/raw/wikipedia/.gitkeep`
- Create: `data/normalized/.gitkeep`
- Create: `data/generated/.gitkeep`
- Create: `data/generated/characters/.gitkeep`
- Create: `data/generated/rejected/.gitkeep`
- Create: `data/generated/reports/.gitkeep`
- Create: `data/exports/.gitkeep`
- Create: `data/cache/.gitkeep`

**Step 1: Create `.env.example`**

```env
APP_ENV=development
DATA_DIR=./data

WIKIDATA_API_URL=https://www.wikidata.org/w/api.php
WIKIDATA_SPARQL_URL=https://query.wikidata.org/sparql
WIKIPEDIA_API_BASE=https://en.wikipedia.org/api/rest_v1

LLM_PROVIDER=none
LLM_MODEL=
LLM_API_KEY=

ALLOW_LIVING_PEOPLE=false
MAX_BATCH_SIZE=100
CACHE_TTL_DAYS=30
```

**Step 2: Create data directories**

Create all directories listed above and place `.gitkeep` in each empty directory.

**Step 3: Verify config still works**

Run:

```bash
python scripts/check_project.py
```

Expected: prints data directory.

**Step 4: Commit if git exists**

```bash
git add .env.example data/
git commit -m "chore: add environment and data directories"
```

---

## Task 0.3: Add backend schema package placeholders

**Files:**

- Create: `src/roguepedia/schemas/__init__.py`
- Create: `src/roguepedia/clients/__init__.py`
- Create: `src/roguepedia/storage/__init__.py`
- Create: `src/roguepedia/normalizers/__init__.py`
- Create: `src/roguepedia/engines/__init__.py`
- Create: `src/roguepedia/generation/__init__.py`
- Create: `src/roguepedia/validation/__init__.py`
- Create: `tests/test_module_imports.py`

**Step 1: Create package files**

Each `__init__.py` may be empty.

**Step 2: Write import test**

`tests/test_module_imports.py`:

```python
import roguepedia.clients
import roguepedia.engines
import roguepedia.generation
import roguepedia.normalizers
import roguepedia.schemas
import roguepedia.storage
import roguepedia.validation


def test_internal_packages_import():
    assert roguepedia.schemas is not None
```

**Step 3: Run test**

```bash
python -m pytest tests/test_module_imports.py -v
```

Expected: PASS.

**Step 4: Commit if git exists**

```bash
git add src/roguepedia tests/test_module_imports.py
git commit -m "chore: add backend module structure"
```

---

## Task 0.4: Create initial source and runtime schemas

**Files:**

- Create: `src/roguepedia/schemas/source.py`
- Create: `src/roguepedia/schemas/profile.py`
- Create: `src/roguepedia/schemas/card.py`
- Create: `src/roguepedia/schemas/character.py`
- Test: `tests/schemas/test_profile_schema.py`
- Test: `tests/schemas/test_card_schema.py`
- Test: `tests/schemas/test_character_schema.py`

**Step 1: Write profile schema test**

`tests/schemas/test_profile_schema.py`:

```python
from roguepedia.schemas.profile import EntityProfile, SourceInfo


def test_entity_profile_minimal():
    profile = EntityProfile(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source=SourceInfo(
            wikidata_id="Q9036",
            wikidata_url="https://www.wikidata.org/wiki/Q9036",
        ),
    )

    assert profile.id == "Q9036"
    assert profile.aliases == []
    assert profile.occupations == []
    assert profile.is_living_person_candidate is False
```

**Step 2: Implement source/profile schemas**

`src/roguepedia/schemas/source.py`:

```python
from pydantic import BaseModel


class SourceInfo(BaseModel):
    wikidata_id: str
    wikidata_url: str
    wikipedia_title: str | None = None
    wikipedia_url: str | None = None
    image_url: str | None = None
    language: str = "en"
```

`src/roguepedia/schemas/profile.py`:

```python
from typing import Any

from pydantic import BaseModel, Field

from roguepedia.schemas.source import SourceInfo


class EntityProfile(BaseModel):
    id: str
    name: str
    description: str | None = None
    entity_type: str
    source: SourceInfo

    aliases: list[str] = Field(default_factory=list)
    birth_year: int | None = None
    death_year: int | None = None
    active_years: list[int] = Field(default_factory=list)

    occupations: list[str] = Field(default_factory=list)
    fields: list[str] = Field(default_factory=list)
    notable_works: list[str] = Field(default_factory=list)
    awards: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)

    taxon_rank: str | None = None
    parent_taxa: list[str] = Field(default_factory=list)
    traits: list[str] = Field(default_factory=list)
    habitats: list[str] = Field(default_factory=list)

    wikipedia_summary: str | None = None
    wikipedia_extract: str | None = None

    sitelinks_count: int = 0
    claims_count: int = 0
    instance_of_labels: list[str] = Field(default_factory=list)
    claim_labels: list[str] = Field(default_factory=list)
    is_living_person_candidate: bool = False

    raw_wikidata: dict[str, Any] = Field(default_factory=dict)
    raw_wikipedia: dict[str, Any] = Field(default_factory=dict)

    def source_text(self) -> str:
        parts = [
            self.name,
            self.description or "",
            " ".join(self.aliases),
            " ".join(self.occupations),
            " ".join(self.fields),
            " ".join(self.notable_works),
            " ".join(self.awards),
            " ".join(self.traits),
            " ".join(self.habitats),
            self.wikipedia_summary or "",
            self.wikipedia_extract or "",
        ]
        return "\n".join(part for part in parts if part)
```

**Step 3: Write card schema test**

`tests/schemas/test_card_schema.py`:

```python
from roguepedia.schemas.card import Card, CardAmount, CardMechanic, GroundingInfo


def test_card_with_damage_mechanic():
    card = Card(
        id="Q9036_alternating_current",
        owner_character_id="Q9036",
        name="Alternating Current",
        card_type="attack",
        card_rarity="signature",
        energy_cost=1,
        description="Strike with a controlled electrical surge.",
        mechanics_text="Deal intelligence-scaling damage.",
        mechanics=[
            CardMechanic(
                kind="damage",
                target="selected_enemy",
                amount=CardAmount(base=6, scaling_stat="intelligence", scaling_ratio=0.35),
            )
        ],
        grounding=GroundingInfo(
            inspired_by="Associated with alternating current electrical systems.",
            grounding_keywords=["alternating current", "electrical"],
        ),
    )

    assert card.energy_cost == 1
    assert card.mechanics[0].kind == "damage"
```

**Step 4: Implement card schema**

`src/roguepedia/schemas/card.py`:

```python
from typing import Literal

from pydantic import BaseModel, Field

ScalingStat = Literal["hp", "attack", "defense", "speed", "intelligence", "influence", "survival", "none"]
MechanicKind = Literal[
    "damage",
    "shield",
    "heal",
    "apply_status",
    "remove_status",
    "draw_cards",
    "gain_energy",
    "buff_stat",
    "debuff_stat",
    "mark",
    "move_position",
    "revive_once",
    "conditional",
]
CardType = Literal["attack", "skill", "power", "ultimate", "utility"]
CardRarity = Literal["basic", "common", "signature", "rare", "ultimate"]
Target = Literal[
    "self",
    "selected_enemy",
    "selected_ally",
    "front_enemy",
    "back_enemy",
    "adjacent_allies",
    "all_enemies",
    "all_allies",
    "lowest_hp_ally",
    "marked_enemy",
]


class CardAmount(BaseModel):
    base: int = 0
    scaling_stat: ScalingStat = "none"
    scaling_ratio: float = 0.0


class CardMechanic(BaseModel):
    kind: MechanicKind
    target: Target
    amount: CardAmount | None = None
    status: str | None = None
    duration: int | None = None
    condition: str | None = None


class GroundingInfo(BaseModel):
    inspired_by: str
    grounding_keywords: list[str] = Field(default_factory=list)


class Card(BaseModel):
    id: str
    owner_character_id: str
    name: str
    card_type: CardType
    card_rarity: CardRarity
    energy_cost: int = Field(ge=0, le=3)
    description: str
    mechanics_text: str
    mechanics: list[CardMechanic]
    targeting: Target | None = None
    exhaust: bool = False
    upgraded: bool = False
    grounding: GroundingInfo


class PassiveTrait(BaseModel):
    id: str
    owner_character_id: str
    name: str
    description: str
    mechanics: list[CardMechanic] = Field(default_factory=list)
    grounding: GroundingInfo
```

**Step 5: Write character schema test**

`tests/schemas/test_character_schema.py`:

```python
from roguepedia.schemas.card import GroundingInfo, PassiveTrait
from roguepedia.schemas.character import CharacterStats, GameCharacter, ValidationReport


def test_game_character_minimal():
    character = GameCharacter(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source={"wikidata_id": "Q9036"},
        era="Modern",
        character_class="Engineer",
        role="Control",
        domain="Electricity",
        rarity="Legendary",
        rarity_score=82.0,
        stats=CharacterStats(
            hp=50,
            attack=50,
            defense=50,
            speed=50,
            intelligence=90,
            influence=70,
            survival=45,
        ),
        tags=["human", "engineer", "electricity"],
        cards=[],
        passive_trait=PassiveTrait(
            id="Q9036_passive",
            owner_character_id="Q9036",
            name="Inventive Spark",
            description="Technology cards gain focus.",
            grounding=GroundingInfo(inspired_by="Inventor and engineer.", grounding_keywords=["inventor"]),
        ),
        lore="A visionary engineer.",
        short_lore="Electricity-focused engineer.",
        validation=ValidationReport(schema_valid=True, grounded=True, balance_valid=True, safety_valid=True),
    )

    assert character.character_class == "Engineer"
```

**Step 6: Implement character schema**

`src/roguepedia/schemas/character.py`:

```python
from pydantic import BaseModel, Field

from roguepedia.schemas.card import Card, PassiveTrait


class CharacterStats(BaseModel):
    hp: int = Field(ge=20, le=100)
    attack: int = Field(ge=20, le=100)
    defense: int = Field(ge=20, le=100)
    speed: int = Field(ge=20, le=100)
    intelligence: int = Field(ge=20, le=100)
    influence: int = Field(ge=20, le=100)
    survival: int = Field(ge=20, le=100)


class ValidationReport(BaseModel):
    schema_valid: bool = False
    grounded: bool = False
    mechanics_valid: bool = False
    balance_valid: bool = False
    safety_valid: bool = False
    warnings: list[str] = Field(default_factory=list)
    rejected_reasons: list[str] = Field(default_factory=list)


class GameCharacter(BaseModel):
    id: str
    name: str
    entity_type: str
    source: dict
    image_url: str | None = None

    era: str
    character_class: str
    role: str
    domain: str
    rarity: str
    rarity_score: float

    stats: CharacterStats
    tags: list[str]
    cards: list[Card]
    passive_trait: PassiveTrait

    lore: str
    short_lore: str
    validation: ValidationReport
    generation_metadata: dict = Field(default_factory=dict)
```

**Step 7: Run schema tests**

```bash
python -m pytest tests/schemas -v
```

Expected: PASS.

**Step 8: Commit if git exists**

```bash
git add src/roguepedia/schemas tests/schemas
git commit -m "feat: add initial roguepedia schemas"
```

---

## Task 0.5: Scaffold frontend app

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`

**Step 1: Create frontend package**

`frontend/package.json`:

```json
{
  "name": "roguepedia-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "phaser": "latest"
  },
  "devDependencies": {}
}
```

**Step 2: Create Vite files**

`frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Roguepedia</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});
```

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

**Step 3: Create React shell**

`frontend/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`frontend/src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Roguepedia</p>
        <h1>Wikipedia-powered roguelike deck-builder</h1>
        <p>
          Generate grounded characters from real entities, recruit them after battle, and build a
          run-defining deck from their cards.
        </p>
      </section>
    </main>
  );
}
```

`frontend/src/styles.css`:

```css
:root {
  color: #eef2ff;
  background: #0b1020;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.hero-card {
  max-width: 720px;
  padding: 40px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.95));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.eyebrow {
  margin: 0 0 12px;
  color: #38bdf8;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
}

h1 {
  margin: 0 0 16px;
  font-size: clamp(2.4rem, 5vw, 4.8rem);
  line-height: 0.95;
}

p {
  color: #cbd5e1;
  font-size: 1.1rem;
  line-height: 1.7;
}
```

**Step 4: Install and build**

Run:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Expected: frontend build succeeds.

**Step 5: Commit if git exists**

```bash
git add frontend/
git commit -m "chore: scaffold roguepedia frontend"
```

---

## Task 0.6: Create distilled project plan

**Files:**

- Create: `PROJECT_PLAN.md`

**Step 1: Create `PROJECT_PLAN.md`**

```markdown
# Roguepedia Project Plan

Roguepedia is a web roguelike collection deck-builder powered by Wikipedia/Wikidata.

## Core Rule

Do not hardcode individual character outcomes. Only hardcode global schemas, formulas, templates, validators, mechanic vocabularies, and balance rules.

## MVP

- 30-50 accepted playable generated characters.
- Deck-building combat.
- Recruit-after-battle.
- One short campaign.
- Artifacts and tag synergies.
- Strict validation before export.

## Implementation Source of Truth

- Design: `docs/plans/2026-05-19-roguepedia-design.md`
- Implementation: `docs/plans/2026-05-19-roguepedia-implementation-plan.md`
```

**Step 2: Commit if git exists**

```bash
git add PROJECT_PLAN.md
git commit -m "docs: add distilled project plan"
```

---

# Phase 1 — Wikidata/Wikipedia Ingestion

**Goal:** Fetch and cache source facts from Wikidata/Wikipedia for named entities.

**Acceptance:**

```bash
python scripts/inspect_entity.py "Nikola Tesla"
python scripts/inspect_entity.py "Tardigrade"
```

Expected output includes QID, label, description, source links, summary, image URL if available, and raw fact hints.

---

## Task 1.1: Add JSON storage helpers

**Files:**

- Create: `src/roguepedia/storage/json_store.py`
- Test: `tests/storage/test_json_store.py`

**Step 1: Write failing tests**

`tests/storage/test_json_store.py`:

```python
from pathlib import Path

from roguepedia.storage.json_store import read_json, write_json


def test_write_and_read_json(tmp_path: Path):
    path = tmp_path / "nested" / "data.json"

    write_json(path, {"id": "Q9036", "name": "Nikola Tesla"})

    assert read_json(path) == {"id": "Q9036", "name": "Nikola Tesla"}
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/storage/test_json_store.py -v
```

Expected: FAIL because module does not exist.

**Step 3: Implement JSON store**

`src/roguepedia/storage/json_store.py`:

```python
import json
from pathlib import Path
from typing import Any


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
```

**Step 4: Run test**

```bash
python -m pytest tests/storage/test_json_store.py -v
```

Expected: PASS.

**Step 5: Commit if git exists**

```bash
git add src/roguepedia/storage/json_store.py tests/storage/test_json_store.py
git commit -m "feat: add json storage helpers"
```

---

## Task 1.2: Add Wikidata search client

**Files:**

- Create: `src/roguepedia/clients/wikidata_client.py`
- Test: `tests/clients/test_wikidata_client.py`

**Step 1: Write unit test with mocked transport**

`tests/clients/test_wikidata_client.py`:

```python
import httpx

from roguepedia.clients.wikidata_client import WikidataClient


def test_search_entities_returns_results():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["action"] == "wbsearchentities"
        return httpx.Response(
            200,
            json={
                "search": [
                    {
                        "id": "Q9036",
                        "label": "Nikola Tesla",
                        "description": "Serbian-American inventor and engineer",
                        "concepturi": "http://www.wikidata.org/entity/Q9036",
                    }
                ]
            },
        )

    client = WikidataClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    results = client.search_entities("Nikola Tesla")

    assert results[0].qid == "Q9036"
    assert results[0].label == "Nikola Tesla"
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/clients/test_wikidata_client.py -v
```

Expected: FAIL because client does not exist.

**Step 3: Implement client**

`src/roguepedia/clients/wikidata_client.py`:

```python
from dataclasses import dataclass
from typing import Any

import httpx

from roguepedia.config import settings


@dataclass(frozen=True)
class WikidataSearchResult:
    qid: str
    label: str
    description: str | None
    url: str


class WikidataClient:
    def __init__(self, http_client: httpx.Client | None = None, api_url: str | None = None) -> None:
        self.http_client = http_client or httpx.Client(timeout=20.0)
        self.api_url = api_url or settings.wikidata_api_url

    def search_entities(self, query: str, language: str = "en", limit: int = 5) -> list[WikidataSearchResult]:
        response = self.http_client.get(
            self.api_url,
            params={
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "format": "json",
                "limit": limit,
            },
        )
        response.raise_for_status()
        payload = response.json()
        return [self._parse_search_result(item) for item in payload.get("search", [])]

    def _parse_search_result(self, item: dict[str, Any]) -> WikidataSearchResult:
        qid = item["id"]
        return WikidataSearchResult(
            qid=qid,
            label=item.get("label", qid),
            description=item.get("description"),
            url=f"https://www.wikidata.org/wiki/{qid}",
        )
```

**Step 4: Run test**

```bash
python -m pytest tests/clients/test_wikidata_client.py -v
```

Expected: PASS.

**Step 5: Commit if git exists**

```bash
git add src/roguepedia/clients/wikidata_client.py tests/clients/test_wikidata_client.py
git commit -m "feat: add wikidata entity search"
```

---

## Task 1.3: Add Wikidata entity fetch

**Files:**

- Modify: `src/roguepedia/clients/wikidata_client.py`
- Modify: `tests/clients/test_wikidata_client.py`

**Step 1: Add failing test**

Append to `tests/clients/test_wikidata_client.py`:

```python

def test_get_entity_returns_entity_payload():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["action"] == "wbgetentities"
        assert request.url.params["ids"] == "Q9036"
        return httpx.Response(
            200,
            json={
                "entities": {
                    "Q9036": {
                        "id": "Q9036",
                        "labels": {"en": {"value": "Nikola Tesla"}},
                        "descriptions": {"en": {"value": "inventor and engineer"}},
                        "claims": {},
                        "sitelinks": {},
                    }
                }
            },
        )

    client = WikidataClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    entity = client.get_entity("Q9036")

    assert entity["id"] == "Q9036"
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/clients/test_wikidata_client.py::test_get_entity_returns_entity_payload -v
```

Expected: FAIL because method does not exist.

**Step 3: Implement method**

Add to `WikidataClient`:

```python
    def get_entity(self, qid: str, language: str = "en") -> dict[str, Any]:
        response = self.http_client.get(
            self.api_url,
            params={
                "action": "wbgetentities",
                "ids": qid,
                "languages": language,
                "props": "labels|descriptions|aliases|claims|sitelinks",
                "format": "json",
            },
        )
        response.raise_for_status()
        payload = response.json()
        entity = payload.get("entities", {}).get(qid)
        if not entity or "missing" in entity:
            raise ValueError(f"Wikidata entity not found: {qid}")
        return entity
```

**Step 4: Run tests**

```bash
python -m pytest tests/clients/test_wikidata_client.py -v
```

Expected: PASS.

**Step 5: Commit if git exists**

```bash
git add src/roguepedia/clients/wikidata_client.py tests/clients/test_wikidata_client.py
git commit -m "feat: fetch wikidata entity payloads"
```

---

## Task 1.4: Add Wikipedia summary client

**Files:**

- Create: `src/roguepedia/clients/wikipedia_client.py`
- Test: `tests/clients/test_wikipedia_client.py`

**Step 1: Write failing test**

`tests/clients/test_wikipedia_client.py`:

```python
import httpx

from roguepedia.clients.wikipedia_client import WikipediaClient


def test_get_summary_returns_summary_payload():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).endswith("/page/summary/Nikola%20Tesla")
        return httpx.Response(
            200,
            json={
                "title": "Nikola Tesla",
                "extract": "Nikola Tesla was an inventor and electrical engineer.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Nikola_Tesla"}},
                "thumbnail": {"source": "https://example.test/tesla.jpg"},
            },
        )

    client = WikipediaClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = client.get_summary("Nikola Tesla")

    assert summary.title == "Nikola Tesla"
    assert "electrical engineer" in summary.extract
    assert summary.image_url == "https://example.test/tesla.jpg"
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/clients/test_wikipedia_client.py -v
```

Expected: FAIL because module does not exist.

**Step 3: Implement client**

`src/roguepedia/clients/wikipedia_client.py`:

```python
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from roguepedia.config import settings


@dataclass(frozen=True)
class WikipediaSummary:
    title: str
    extract: str
    url: str | None
    image_url: str | None
    raw: dict


class WikipediaClient:
    def __init__(self, http_client: httpx.Client | None = None, api_base: str | None = None) -> None:
        self.http_client = http_client or httpx.Client(timeout=20.0)
        self.api_base = (api_base or settings.wikipedia_api_base).rstrip("/")

    def get_summary(self, title: str) -> WikipediaSummary:
        response = self.http_client.get(f"{self.api_base}/page/summary/{quote(title)}")
        response.raise_for_status()
        payload = response.json()
        return WikipediaSummary(
            title=payload.get("title", title),
            extract=payload.get("extract", ""),
            url=payload.get("content_urls", {}).get("desktop", {}).get("page"),
            image_url=payload.get("thumbnail", {}).get("source"),
            raw=payload,
        )
```

**Step 4: Run test**

```bash
python -m pytest tests/clients/test_wikipedia_client.py -v
```

Expected: PASS.

**Step 5: Commit if git exists**

```bash
git add src/roguepedia/clients/wikipedia_client.py tests/clients/test_wikipedia_client.py
git commit -m "feat: add wikipedia summary client"
```

---

## Task 1.5: Add raw entity collector

**Files:**

- Create: `src/roguepedia/collectors/__init__.py`
- Create: `src/roguepedia/collectors/entity_collector.py`
- Test: `tests/collectors/test_entity_collector.py`

**Step 1: Write failing test**

`tests/collectors/test_entity_collector.py`:

```python
from pathlib import Path

from roguepedia.collectors.entity_collector import RawEntityCollector
from roguepedia.storage.json_store import read_json


class FakeWikidataClient:
    def search_entities(self, query: str, language: str = "en", limit: int = 5):
        return [type("Result", (), {"qid": "Q9036", "label": "Nikola Tesla"})()]

    def get_entity(self, qid: str, language: str = "en"):
        return {"id": qid, "labels": {"en": {"value": "Nikola Tesla"}}, "sitelinks": {}}


class FakeWikipediaClient:
    def get_summary(self, title: str):
        return type(
            "Summary",
            (),
            {
                "title": title,
                "extract": "Nikola Tesla was an inventor.",
                "url": "https://en.wikipedia.org/wiki/Nikola_Tesla",
                "image_url": None,
                "raw": {"title": title},
            },
        )()


def test_collect_by_name_saves_raw_payloads(tmp_path: Path):
    collector = RawEntityCollector(
        wikidata_client=FakeWikidataClient(),
        wikipedia_client=FakeWikipediaClient(),
        data_dir=tmp_path,
    )

    result = collector.collect_by_name("Nikola Tesla")

    assert result.qid == "Q9036"
    assert (tmp_path / "raw" / "wikidata" / "Q9036.json").exists()
    assert (tmp_path / "raw" / "wikipedia" / "Q9036.json").exists()
    assert read_json(tmp_path / "raw" / "wikidata" / "Q9036.json")["id"] == "Q9036"
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/collectors/test_entity_collector.py -v
```

Expected: FAIL because collector does not exist.

**Step 3: Implement collector**

`src/roguepedia/collectors/__init__.py`: empty.

`src/roguepedia/collectors/entity_collector.py`:

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from roguepedia.clients.wikidata_client import WikidataClient
from roguepedia.clients.wikipedia_client import WikipediaClient, WikipediaSummary
from roguepedia.config import settings
from roguepedia.storage.json_store import write_json


@dataclass(frozen=True)
class RawEntityResult:
    qid: str
    label: str
    wikidata: dict[str, Any]
    wikipedia: WikipediaSummary | None


class RawEntityCollector:
    def __init__(
        self,
        wikidata_client: WikidataClient | Any | None = None,
        wikipedia_client: WikipediaClient | Any | None = None,
        data_dir: Path | None = None,
    ) -> None:
        self.wikidata_client = wikidata_client or WikidataClient()
        self.wikipedia_client = wikipedia_client or WikipediaClient()
        self.data_dir = data_dir or settings.data_dir

    def collect_by_name(self, name: str, language: str = "en") -> RawEntityResult:
        results = self.wikidata_client.search_entities(name, language=language, limit=5)
        if not results:
            raise ValueError(f"No Wikidata entity found for {name!r}")

        selected = results[0]
        return self.collect_by_qid(selected.qid, label=selected.label, language=language)

    def collect_by_qid(self, qid: str, label: str | None = None, language: str = "en") -> RawEntityResult:
        wikidata = self.wikidata_client.get_entity(qid, language=language)
        title = label or self._label_from_entity(wikidata, language) or qid
        wikipedia = self.wikipedia_client.get_summary(title)

        write_json(self.data_dir / "raw" / "wikidata" / f"{qid}.json", wikidata)
        write_json(self.data_dir / "raw" / "wikipedia" / f"{qid}.json", wikipedia.raw)

        return RawEntityResult(qid=qid, label=title, wikidata=wikidata, wikipedia=wikipedia)

    def _label_from_entity(self, entity: dict[str, Any], language: str) -> str | None:
        return entity.get("labels", {}).get(language, {}).get("value")
```

**Step 4: Run test**

```bash
python -m pytest tests/collectors/test_entity_collector.py -v
```

Expected: PASS.

**Step 5: Commit if git exists**

```bash
git add src/roguepedia/collectors tests/collectors/test_entity_collector.py
git commit -m "feat: collect and cache raw entity data"
```

---

## Task 1.6: Create inspect entity CLI

**Files:**

- Create: `scripts/inspect_entity.py`
- Test: `tests/scripts/test_inspect_entity.py`

**Step 1: Write formatting helper test**

`tests/scripts/test_inspect_entity.py`:

```python
from scripts.inspect_entity import format_inspection


def test_format_inspection_includes_core_fields():
    text = format_inspection(
        qid="Q9036",
        label="Nikola Tesla",
        description="inventor and engineer",
        wikidata_url="https://www.wikidata.org/wiki/Q9036",
        wikipedia_url="https://en.wikipedia.org/wiki/Nikola_Tesla",
        summary="Nikola Tesla was an inventor and electrical engineer.",
        image_url="https://example.test/tesla.jpg",
    )

    assert "Q9036" in text
    assert "Nikola Tesla" in text
    assert "electrical engineer" in text
    assert "https://www.wikidata.org/wiki/Q9036" in text
```

**Step 2: Run test to verify failure**

```bash
python -m pytest tests/scripts/test_inspect_entity.py -v
```

Expected: FAIL because script does not exist/import.

**Step 3: Implement CLI**

`scripts/inspect_entity.py`:

```python
import argparse
from typing import Any

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
```

**Step 4: Run test**

```bash
python -m pytest tests/scripts/test_inspect_entity.py -v
```

Expected: PASS.

**Step 5: Run live smoke test**

```bash
python scripts/inspect_entity.py "Nikola Tesla"
```

Expected: prints QID, label, description, source links, summary, and image if available.

**Step 6: Run second smoke test**

```bash
python scripts/inspect_entity.py "Tardigrade"
```

Expected: prints entity information and saves raw JSON.

**Step 7: Commit if git exists**

```bash
git add scripts/inspect_entity.py tests/scripts/test_inspect_entity.py data/raw/
git commit -m "feat: add entity inspection cli"
```

Avoid committing large raw API payloads if they become too large; prefer fixture files later.

---

## Phase 1 Manual Review Checkpoint

After Phase 1, review:

- Does `inspect_entity.py "Nikola Tesla"` select Q9036?
- Does `inspect_entity.py "Tardigrade"` select the intended organism page/entity?
- Are raw JSON files saved under `data/raw/wikidata/` and `data/raw/wikipedia/`?
- Are errors understandable for unknown entities?
- Is API usage minimal and cached enough for development?

Do not proceed to Phase 2 until the five seed entities can be fetched or ambiguity handling is documented.

---

# Phase 2 — Normalized Profile + Safety Precheck

**Goal:** Convert raw source data into stable `EntityProfile` objects.

## High-Level Tasks

1. Add Wikidata claim parsing helpers.
2. Add label extraction for common claims.
3. Implement entity type detection.
4. Implement year extraction.
5. Implement human normalizer.
6. Implement organism normalizer.
7. Implement safety precheck for living humans.
8. Create `scripts/generate_profile.py`.
9. Save normalized JSON to `data/normalized/{qid}.json`.
10. Add fixture-backed tests for seed entities.

**Acceptance:**

```bash
python scripts/generate_profile.py "Marie Curie"
python scripts/generate_profile.py "Octopus"
python -m pytest tests/normalizers tests/validation -v
```

Expected:

- Profiles validate against `EntityProfile`.
- Humans have birth/death years when available.
- Organisms have taxon/trait text hints when available.
- Living human candidates are excluded unless `ALLOW_LIVING_PEOPLE=true`.

---

# Phase 3 — Deterministic Gameplay Metadata

**Goal:** Infer gameplay metadata without LLM.

## High-Level Tasks

1. Implement evidence result schema.
2. Implement era engine.
3. Implement class engine.
4. Implement domain engine.
5. Implement role engine.
6. Implement rarity engine.
7. Implement stat engine.
8. Implement tag engine.
9. Create no-LLM character assembler.
10. Create `scripts/generate_character.py --no-llm`.

**Acceptance:**

```bash
python scripts/generate_character.py "Sun Tzu" --no-llm
python scripts/generate_character.py "Tardigrade" --no-llm
python -m pytest tests/engines -v
```

Expected:

- Sun Tzu becomes Strategy/Control-like with ancient/early era evidence.
- Tardigrade becomes Survival/Nature-like with high survival/defense.
- Each inference includes evidence.

**Manual review required before Phase 4.**

---

# Phase 4 — Card Schema + Deterministic Templates

**Goal:** Produce executable card packages before using LLM.

## High-Level Tasks

1. Expand card schema if Phase 0 schema is insufficient.
2. Implement mechanics validator.
3. Implement balance constants for cards.
4. Implement deterministic card template registry by class/domain.
5. Implement passive trait templates.
6. Implement card package generator.
7. Add `--with-cards` to no-LLM character generation.
8. Add tests for every mechanic kind.

**Acceptance:**

```bash
python scripts/generate_character.py "Tardigrade" --no-llm --with-cards
python -m pytest tests/generation tests/validation -v
```

Expected:

- Character has 5-6 executable cards/passive.
- No generated card has unsupported mechanics.
- Game could execute mechanics without parsing text.

---

# Phase 5 — LLM Card/Lore Generation + Strict Validation

**Goal:** Generate grounded, flavorful, mechanically valid card packages.

## High-Level Tasks

1. Add provider-neutral LLM interface.
2. Add prompt builder with allowed mechanics/statuses.
3. Add JSON parser and retry logic.
4. Add grounding validator.
5. Add LLM judge interface.
6. Add safety validator.
7. Add repair prompt.
8. Add deterministic fallback path.
9. Add accepted/dev-only/rejected output routing.
10. Add reports under `data/generated/reports/`.

**Acceptance:**

```bash
python scripts/generate_character.py "Nikola Tesla"
python scripts/generate_character.py "Marie Curie"
python scripts/generate_character.py "Sun Tzu"
python scripts/generate_character.py "Tardigrade"
python scripts/generate_character.py "Octopus"
```

Expected:

- Each seed character has distinct grounded cards.
- Invalid LLM output is repaired or rejected.
- No playable character has unsupported mechanics.

**Manual review required before Phase 6.**

---

# Phase 6 — Minimal Deck Combat Engine

**Goal:** Play a battle using generated cards.

## High-Level Tasks

1. Create frontend runtime TypeScript schemas.
2. Add sample exported data fixture from five seed characters.
3. Implement combat state model.
4. Implement draw/discard/reshuffle.
5. Implement energy spending.
6. Implement target validation.
7. Implement mechanic resolver.
8. Implement status resolver.
9. Implement enemy intent AI.
10. Build Phaser combat sandbox.
11. Add React battle screen.
12. Add tests for pure combat logic.

**Acceptance:**

```bash
npm --prefix frontend run build
```

And manually:

- Load battle sandbox.
- Draw 5 cards.
- Play cards with targets.
- Enemy acts.
- Win/loss resolves.

**Manual review required before Phase 7.**

---

# Phase 7 — Run Map + Recruit Loop

**Goal:** Convert combat sandbox into a playable run.

## High-Level Tasks

1. Implement run state.
2. Implement branching map generator.
3. Implement battle/elite/rest/event/boss nodes.
4. Implement reward screen.
5. Implement recruit-after-battle.
6. Implement active party and reserve roster.
7. Add deck updates when recruiting.
8. Add run summary.
9. Add local run reset.

**Acceptance:**

- Start run.
- Clear several nodes.
- Recruit character.
- Reach boss.
- Win or lose run.

---

# Phase 8 — Batch Generation for MVP Roster

**Goal:** Generate 30-50 accepted playable characters.

## High-Level Tasks

1. Add SPARQL client.
2. Add category query templates.
3. Add batch collector.
4. Add batch generation CLI.
5. Add target accepted count.
6. Add rejection aggregation.
7. Add balance report.
8. Add export script.
9. Load export in frontend.

**Acceptance:**

```bash
python scripts/generate_batch.py --category mixed --target-accepted 50
python scripts/export_game_data.py
npm --prefix frontend run build
```

Expected:

- 30-50 accepted playable characters.
- Rejected characters have reports.
- `data/exports/game_characters.json` loads in frontend.

**Manual review required after Phase 8.**

---

# Phase 9 — Campaign Content + Artifacts + Synergies

**Goal:** Make runs strategically interesting.

## High-Level Tasks

1. Add artifact schema/runtime definitions.
2. Hand-author 20-30 artifacts.
3. Add synergy schema/runtime definitions.
4. Hand-author 10-15 tag synergy rules.
5. Add card upgrade rules.
6. Add act difficulty scaling.
7. Add boss templates.
8. Add simple event choices.
9. Add source/lore panels.

**Acceptance:**

- Full run lasts about 20-30 minutes.
- At least five deck archetypes are viable:
  - Knowledge/Technology
  - War/Strategy
  - Nature/Survival
  - Art/Influence
  - Poison/Disease
- Artifacts and synergies affect player choices.

---

# Phase 10 — Polish, Balance, and Ship Candidate

**Goal:** Prepare the MVP for public testing.

## High-Level Tasks

1. Add onboarding/tutorial.
2. Polish card UI/tooltips.
3. Polish run map UI.
4. Polish combat feedback.
5. Add settings.
6. Add local-storage run save.
7. Run roster content safety review.
8. Tune card/stat balance.
9. Add deployment scripts.
10. Create release checklist.

**Acceptance:**

- Public web build works.
- New player can understand first run.
- No obvious broken cards.
- No ungrounded/offensive playable characters.
- Export pipeline is reproducible.

---

# Final Verification Checklist

Before calling the MVP complete:

```bash
python -m pytest
npm --prefix frontend run build
python scripts/export_game_data.py
```

Manual checks:

- Complete one full run.
- Recruit at least two characters.
- Verify artifacts trigger.
- Verify synergies trigger.
- Inspect at least 10 character source panels.
- Review rejected reports.
- Confirm no living humans are in playable roster unless explicitly allowed.

---

# Execution Options

Plan complete and saved to `docs/plans/2026-05-19-roguepedia-implementation-plan.md`.

Two execution options:

1. **Subagent-Driven (this session)** — dispatch fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — open a new session with `superpowers:executing-plans`, batch execution with checkpoints.
