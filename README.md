# Roguepedia

Roguepedia is a roguelike deck-building game prototype that turns historical and knowledge-base characters into playable card-game heroes. The project includes a data/generation pipeline plus a React frontend for playing runs, inspecting character lore, fighting enemies, collecting artifacts, and exploring a node-based map.

## Repository structure

- `frontend/` — React, TypeScript, Vite, Tailwind CSS game frontend.
- `src/roguepedia/` — Python generation, validation, and supporting game-data tooling.
- `scripts/` — command-line scripts for collecting/generating/exporting character data.
- `tests/` — Python test suite for generation and validation logic.
- `docs/` — planning and implementation notes.
- `data/` — local generated/raw/normalized/exported data artifacts.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Useful frontend commands:

```bash
npm test
npm run build
```

See `frontend/README.md` for frontend-specific notes.

## Python tooling

Install the Python package in editable mode from the repository root:

```bash
pip install -e .
```

Run tests:

```bash
pytest
```

## Data and secrets

Generated data under `data/` can be large and environment-specific. Keep raw/generated outputs and local `.env` files out of commits unless intentionally publishing a curated export.

LLM provider credentials, such as DeepSeek API keys, should live in `.env` only and must not be committed.

## Current game flow

The frontend loads exported runtime characters, starts a run with a party member, and supports:

- node-based run map navigation
- combat with playable cards and energy
- enemy and player stat inspection
- battle log and end-turn controls
- artifact previews
- active synergy display
- lore and card inspection
