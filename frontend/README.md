# Roguepedia Frontend

Roguepedia is a React/Vite roguelike card-game frontend. The UI presents a codex-inspired combat screen with a run map, playable cards, character/enemy inspection, artifacts, synergies, and lore panels.

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS v4
- Vitest
- lucide-react icons

## Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build production assets:

```bash
npm run build
```

## Project notes

- Runtime characters are loaded from `src/game/gameCharacters.json` via `src/game/roster.ts`.
- The main UI composition lives in `src/App.tsx`.
- Game state and combat/run logic live under `src/game/`.
