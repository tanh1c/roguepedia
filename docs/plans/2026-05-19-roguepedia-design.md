# Roguepedia Design

Date: 2026-05-19

## 1. Product Shape and MVP

Roguepedia is a web roguelike collection deck-builder where playable characters are generated from Wikipedia/Wikidata entities. Characters may be historical people, scientists, rulers, artists, military leaders, animals, plants, microorganisms, extinct species, or other real organisms.

The core product has two halves:

1. **Character generation pipeline**
   - Input: entity name or Wikidata QID.
   - Output: validated game-ready character JSON.
   - Wikipedia/Wikidata are the fact sources.
   - The project must not hardcode per-character outcomes.
   - It may hardcode global schemas, formulas, templates, validators, effect vocabularies, and balance rules.

2. **Playable roguelike deck-building game**
   - Web game using React plus Phaser.
   - Slay-the-Spire-inspired run map.
   - Team-based collection/recruit loop.
   - Characters contribute generated card packages to a shared combat deck.

### MVP Scope

The MVP should be larger than a technical prototype but smaller than the original 450-character target.

MVP includes:

- 30-50 accepted playable generated characters.
- One complete short roguelike campaign.
- Deck-building combat.
- Recruit-after-battle.
- Artifacts and tag synergies.
- Character viewer/source panel for inspection.
- Batch generation with strict validation.
- Exported game data consumed by the frontend.

MVP excludes:

- 450-character roster.
- Multiplayer.
- Account system.
- Cloud saves.
- Gacha/monetization.
- Runtime LLM calls during combat.
- Full localization.
- Full procedural story/event generation.

### MVP Success Criteria

The MVP is successful when:

- A player can complete a 20-30 minute run in the browser.
- The game loads 30-50 accepted playable characters from generated export data.
- Character cards are grounded in Wikipedia/Wikidata facts.
- Combat decisions involve deck, energy, positions, artifacts, and synergies.
- Recruited characters alter the deck and strategy.
- Unsafe, ungrounded, living-human, or mechanically invalid characters are rejected before export.

## 2. System Architecture

Roguepedia uses four layers:

```txt
[Wikipedia/Wikidata APIs]
          ↓
[Python Generation Backend]
          ↓
[Game Data Export JSON]
          ↓
[Web Game Client: React + Phaser]
```

### Python Generation Backend

The backend handles all source data, normalization, LLM use, validation, and export.

Responsibilities:

- Search Wikidata entities.
- Fetch Wikidata entity JSON.
- Fetch Wikipedia summary/extract.
- Save raw source data.
- Normalize source data into `EntityProfile`.
- Infer deterministic gameplay metadata.
- Generate cards/lore using an LLM or deterministic templates.
- Validate schema, grounding, safety, mechanics, and balance.
- Repair/regenerate invalid outputs.
- Save accepted/rejected reports.
- Export game-ready data.

Use Python + FastAPI, but start with CLI-first milestones. Add API once generation is stable.

### Data Storage

Use file-based JSON plus SQLite cache for the MVP.

```txt
data/
  raw/
    wikidata/
    wikipedia/
  normalized/
  generated/
    characters/
    rejected/
    reports/
  exports/
    game_characters.json
  cache/
    roguepedia.sqlite
```

JSON is easy to inspect and consume. SQLite is enough for caching API responses and generation attempts. Postgres and job queues are later scaling options.

### Game Data Contract

The frontend consumes only exported runtime data. It should not depend on raw Wikidata/Wikipedia payloads.

`data/exports/game_characters.json` is the main contract between generation backend and game client.

Runtime game data includes:

- character identity
- source links
- image URL
- class/domain/role/era/rarity
- stats
- cards
- passive trait
- tags
- synergies
- artifacts
- status definitions
- balance constants

### Web Game Client

Use React for shell/UI and Phaser for combat scenes.

React handles:

- routing/layout
- character collection viewer
- run map
- party/recruit screens
- card/source panels
- settings/dev tools

Phaser handles:

- combat board
- input/targeting
- animations/VFX
- turn resolution presentation

### Runtime Determinism

LLM calls happen only during generation. Combat uses structured mechanics, not natural-language effect text. If a generated card cannot compile into supported mechanics, it cannot enter the playable roster.

## 3. Character Generation Pipeline

The pipeline has two major outputs:

1. `EntityProfile`: fact-only normalized source data.
2. `GameCharacter`: validated gameplay data.

Flow:

```txt
Input name/QID
  ↓
Entity search/disambiguation
  ↓
Raw Wikidata + Wikipedia fetch
  ↓
Normalize EntityProfile
  ↓
Safety precheck
  ↓
Deterministic gameplay metadata
  ↓
Deterministic rarity + stats
  ↓
LLM card/lore draft
  ↓
Mechanical effect compiler
  ↓
Validators
  ↓
Repair/regenerate loop
  ↓
Accepted playable character or rejected report
```

### Entity Search

For name input, the CLI/API may auto-pick the best Wikidata result only when confidence is high. Ambiguous matches should require `--qid` or return a candidate list.

### EntityProfile Normalization

`EntityProfile` contains facts, not gameplay interpretation. It should include aliases, instance-of labels, claim labels, source text, and living-person indicators because these are needed for rarity, entity type detection, grounding, and safety.

### Deterministic Metadata Engines

Each engine returns both a value and evidence:

```json
{
  "value": "Electricity",
  "confidence": 0.88,
  "evidence": ["electrical engineer", "alternating current"],
  "source_fields": ["occupations", "wikipedia_summary"]
}
```

Engines:

- entity type
- era
- class
- domain
- role
- rarity
- stats
- tags
- synergies later

### Card Generation

Characters produce card packages, not only fixed skill buttons.

Initial character package:

- 2 common/basic cards
- 2 signature cards
- 1 passive trait
- 1 ultimate/rare card

Cards include display text and executable mechanics.

Example mechanic:

```json
{
  "kind": "damage",
  "target": "selected_enemy",
  "amount": {
    "base": 6,
    "scaling_stat": "intelligence",
    "scaling_ratio": 0.35
  }
}
```

### Strict Validation Gates

A character enters `accepted_playable` only if all gates pass:

1. **Schema gate**
   - Required fields exist.
   - Card/passive structure is valid.
   - JSON is parseable.

2. **Grounding gate**
   - Every card has `inspired_by`.
   - Grounding keywords match source text.
   - LLM judge verifies card inspiration is fact-grounded.

3. **Mechanical gate**
   - Every card uses supported mechanics only.
   - Targeting is valid.
   - Energy cost, rarity, and card type are valid.

4. **Balance gate**
   - Stats fit rarity budget.
   - Card power fits energy/card rarity budget.
   - Status durations and multipliers are capped.

5. **Safety gate**
   - Living humans excluded by default.
   - Protected traits are not used as gameplay sources.
   - Controversial figures are handled neutrally.
   - Hate/extremist/defamatory content is rejected.

### Repair/Regenerate Loop

Generation should not fail after one bad LLM output.

```txt
Attempt 1: generate from profile + metadata
Validate
If invalid: repair invalid fields
Validate
If invalid: deterministic template fallback
Validate
If invalid: reject with report
```

Acceptance levels:

- `accepted_playable`: can appear in game.
- `accepted_dev_only`: valid enough to inspect, not used in game.
- `rejected`: stored with report.

### Seed Vertical Slice

Before scaling, prove distinct generated identities for:

- Nikola Tesla: technology/electricity.
- Marie Curie: science/radiation/knowledge, handled respectfully.
- Sun Tzu: strategy/control.
- Tardigrade: survival/tank/adapt.
- Octopus: trickster/nature/control.

If these five do not create distinct combat roles, improve schema/prompts/templates before scaling.

## 4. Deck-Building Combat Design

### Core Concept

Each character contributes generated cards to a shared team deck.

```txt
Character facts → generated card package → team deck → draw hand → play cards with energy
```

### Combat Format

- 3 active characters.
- Reserve roster up to 6.
- Shared deck built from active/recruited characters.
- Each turn: draw 5 cards, gain 3 energy, play cards, discard unplayed cards.
- Discard reshuffles into draw pile when needed.
- Characters exist on board with HP/stats/position.
- If a character dies, their cards become unplayable until revived or battle ends.

### Positions

Use three simple slots:

```txt
[Front] [Middle] [Back]
```

Positions affect targeting and role identity:

- Front: higher threat, tank position.
- Middle: neutral.
- Back: safer for fragile knowledge/support characters, vulnerable to backline/AOE targeting.

Targeting can include:

- selected enemy
- selected ally
- front enemy
- back enemy
- adjacent allies
- all enemies
- all allies
- lowest HP ally
- marked enemy

### Status Interactions

MVP statuses:

- shock
- poison
- burn
- bleed
- stun
- slow
- weaken
- vulnerable
- shield
- regen
- focus
- morale
- mark
- adapt
- evade

Statuses should have executable definitions and combo potential, such as shock chaining, mark increasing next hit, focus improving intelligence cards, and adapt granting defensive response.

### Artifacts

Artifacts are hand-authored global run modifiers for MVP.

Examples:

- Knowledge cards draw extra cards.
- Shock lasts longer.
- Nature characters start with shield/regen.
- Strategy cards apply mark.

Artifacts should not be generated from Wikipedia in MVP.

### Synergies

Synergies are global tag rules.

Examples:

- 2 Knowledge: draw 1 extra card on turn 1.
- 2 Nature: start battle with regen.
- 2 War: first attack applies mark.
- 2 Survival: gain shield when low HP.
- 2 Technology: shock deals bonus.

Synergies can trigger from party composition, cards played this turn, or deck tags.

### Upgrades

Card upgrades are deterministic:

- damage card: increase multiplier/base.
- status card: increase duration or potency.
- shield/heal card: increase amount.
- ultimate: lower cost/cooldown or increase effect.

Do not use LLM for upgrades in MVP.

## 5. Phase Roadmap

### Phase 0 — Project Foundation

Goal: create a stable workspace for AI-agent implementation.

Deliverables:

- Python package structure.
- React + Phaser app shell.
- Shared export schema.
- Config/env system.
- Basic test setup.
- `PROJECT_PLAN.md` distilled from `raw_plan.md`.
- `docs/plans/` for implementation plans.

Acceptance:

- Backend CLI can import `roguepedia`.
- Frontend app shell runs.
- Test commands run.

### Phase 1 — Wikidata/Wikipedia Ingestion

Goal: fetch source facts.

Deliverables:

- Wikidata search.
- Wikidata entity fetch by QID.
- Wikipedia summary/extract fetch.
- Raw JSON cache.
- `inspect_entity.py`.

Acceptance:

```bash
python scripts/inspect_entity.py "Nikola Tesla"
```

Prints QID, label, description, source links, occupations/fields or taxon hints, summary, and image URL.

### Phase 2 — Normalized Profile + Safety Precheck

Goal: convert raw source data into `EntityProfile`.

Deliverables:

- Pydantic profile schemas.
- Human normalizer.
- Organism normalizer.
- Entity type detection.
- Year extraction.
- Source text normalization.
- Living human exclusion.
- Normalized JSON saving.

Acceptance:

```bash
python scripts/generate_profile.py "Marie Curie"
```

Outputs valid normalized profile JSON and safety precheck result.

### Phase 3 — Deterministic Gameplay Metadata

Goal: infer non-LLM gameplay metadata.

Deliverables:

- Era engine.
- Class engine.
- Domain engine.
- Role engine.
- Rarity engine.
- Stat engine.
- Tag engine.
- Evidence output for each inference.

Acceptance:

```bash
python scripts/generate_character.py "Sun Tzu" --no-llm
```

Outputs metadata, rarity, stats, tags, and inference evidence.

### Phase 4 — Card Schema + Deterministic Templates

Goal: establish executable card contract before using LLM.

Deliverables:

- Card schema.
- Passive trait schema.
- Card mechanics schema.
- Allowed mechanics vocabulary.
- Deterministic template cards by class/domain.
- Card validator.

Acceptance:

```bash
python scripts/generate_character.py "Tardigrade" --no-llm --with-cards
```

Outputs playable card package that passes validation.

### Phase 5 — LLM Card/Lore Generation + Strict Validation

Goal: generate grounded flavorful cards while preserving mechanics.

Deliverables:

- LLM client.
- Prompt builder.
- JSON parsing and retry.
- LLM grounding judge.
- Repair/regenerate loop.
- Deterministic fallback.
- Rejection reports.

Acceptance:

```bash
python scripts/generate_character.py "Nikola Tesla"
```

Creates accepted character JSON with cards, passive, lore, grounding evidence, and validation report.

### Phase 6 — Minimal Deck Combat Engine

Goal: make generated card JSON playable.

Deliverables:

- Combat state model.
- Party/enemy model.
- Deck/hand/draw/discard/exhaust.
- Energy system.
- Card play resolver.
- Status system.
- Turn flow.
- Enemy AI intent.
- React/Phaser combat sandbox.

Acceptance:

- Load 5 seed characters from JSON.
- Start battle with 3-player party.
- Draw 5 cards and gain 3 energy.
- Play cards with targeting.
- Enemies act.
- Win/loss resolves.

### Phase 7 — Run Map + Recruit Loop

Goal: turn combat into a roguelike run.

Deliverables:

- Branching map generator.
- Node types: battle, elite, rest, event, boss.
- Reward screen.
- Recruit-after-battle.
- Active party + reserve roster.
- Card package added on recruit.
- Basic run summary.

Acceptance:

- Player can start a run.
- Clear multiple nodes.
- Recruit new character.
- Reach and defeat boss.
- Lose condition works.

### Phase 8 — Batch Generation for MVP Roster

Goal: generate 30-50 accepted playable characters.

Deliverables:

- Category SPARQL templates.
- Batch collector.
- Batch generation.
- Acceptance/rejection reports.
- Roster export.
- Balance report across roster.

Acceptance:

```bash
python scripts/generate_batch.py --category mixed --target-accepted 50
python scripts/export_game_data.py
```

Produces accepted playable characters, rejection report, and frontend-loadable export data.

### Phase 9 — Campaign Content + Artifacts + Synergies

Goal: make the run feel like a real game.

Deliverables:

- 20-30 hand-authored artifacts.
- 10-15 global tag synergy rules.
- Act difficulty scaling.
- Boss templates.
- Card upgrade system.
- Simple events.
- Source/lore panels.

Acceptance:

- Full run takes about 20-30 minutes.
- Player can build distinct deck archetypes.
- Artifacts and synergies influence decisions.

### Phase 10 — Polish, Balance, and Ship Candidate

Goal: make MVP presentable.

Deliverables:

- UI polish.
- Onboarding/tutorial.
- Tooltips.
- Settings.
- Local-storage save.
- Balance tuning.
- Test coverage.
- Deployment setup.

Acceptance:

- Public web build works.
- New player can understand and complete a first run.
- No obvious broken cards.
- No ungrounded/offensive playable characters.
- Export pipeline is reproducible.

## 6. Key Data Contracts

### EntityProfile

Fact-only normalized source object.

Fields:

- id
- name
- description
- entity_type
- source
- aliases
- birth_year
- death_year
- active_years
- occupations
- fields
- notable_works
- awards
- countries
- taxon_rank
- parent_taxa
- traits
- habitats
- wikipedia_summary
- wikipedia_extract
- sitelinks_count
- claims_count
- instance_of_labels
- claim_labels
- is_living_person_candidate
- raw_wikidata
- raw_wikipedia

### GameCharacter

Runtime character object.

Fields:

- id
- name
- entity_type
- source
- image_url
- era
- character_class
- role
- domain
- rarity
- rarity_score
- stats
- tags
- cards
- passive_trait
- lore
- short_lore
- validation
- generation_metadata

### Card

Fields:

- id
- owner_character_id
- name
- card_type
- card_rarity
- energy_cost
- description
- mechanics_text
- mechanics
- targeting
- exhaust
- upgraded
- grounding

Allowed card types:

- attack
- skill
- power
- ultimate
- utility

Allowed card rarities:

- basic
- common
- signature
- rare
- ultimate

### Mechanics

Allowed MVP mechanics:

- damage
- shield
- heal
- apply_status
- remove_status
- draw_cards
- gain_energy
- buff_stat
- debuff_stat
- mark
- move_position
- revive_once
- conditional

New mechanic kinds require schema, validator, resolver, tests, and prompt updates.

### Status Definitions

Fields:

- id
- name
- type
- stacking_rule
- duration_rule
- tick_timing
- effect

### Artifact

Fields:

- id
- name
- description
- rarity
- trigger
- condition
- mechanics
- tags_supported

### Synergy

Fields:

- id
- name
- required_tags
- threshold
- trigger
- effect
- description

### Export Data Pack

```json
{
  "version": "0.1.0",
  "generated_at": "YYYY-MM-DD",
  "characters": [],
  "artifacts": [],
  "synergies": [],
  "status_definitions": [],
  "balance_constants": {}
}
```

## 7. Risk Controls and Testing

### Main Risks

1. **Cards are flavorful but not playable**
   - Require structured mechanics.
   - Lock mechanics vocabulary.
   - Reject unsupported effects.

2. **Cards are playable but generic**
   - Require evidence and grounding.
   - Judge uniqueness/grounding.
   - Review seed characters before scaling.

3. **Unsafe or disrespectful content**
   - Exclude living humans by default.
   - Do not use protected traits for gameplay.
   - Validate safety before export.

4. **Roster scale breaks balance**
   - Use rarity stat budgets.
   - Use card power budgets.
   - Generate roster balance reports.

5. **Scope creep**
   - Keep phase gates.
   - No multiplayer/account/gacha/runtime LLM in MVP.
   - No scaling to 450 before the MVP works.

### Backend Tests

Unit tests:

- entity type detection
- year extraction
- era/class/domain/role inference
- rarity scoring
- stat budget
- tag normalization
- card schema validation
- mechanics validation
- grounding validation
- safety validation
- export schema validation

Integration tests with cached fixtures:

- Nikola Tesla
- Marie Curie
- Sun Tzu
- Tardigrade
- Octopus
- Cleopatra
- Leonardo da Vinci
- Electric eel
- Tyrannosaurus
- safe pathogen/entity candidate

### Combat Tests

Pure combat engine tests:

- draw/discard/reshuffle
- energy spending
- target validation
- damage/shield/heal
- status ticking
- stun/slow/weaken/vulnerable
- position targeting
- win/loss
- enemy intent
- dead character card handling

### Frontend Tests

Light MVP coverage:

- data pack loads
- card renders
- battle state updates
- run map navigation
- recruit screen works

### AI-Agent Guardrails

Every implementation phase must have:

- concrete acceptance commands
- tests before completion
- no hardcoded individual character outcomes
- no trusting raw LLM output
- no frontend parsing natural-language card text
- no new mechanic kind without schema, validator, resolver, tests, and prompt updates

### Manual Review Checkpoints

Review manually after:

1. Phase 3 metadata for seed characters.
2. Phase 5 generated cards/lore for seed characters.
3. Phase 6 combat feel with seed decks.
4. Phase 8 roster quality report.
5. Pre-ship safety/content review.

## 8. Final Direction

Use the vertical-slice approach:

1. Build source ingestion and normalized profiles.
2. Build deterministic metadata and card schemas.
3. Prove five seed characters generate distinct playable card packages.
4. Build combat sandbox using those generated cards.
5. Add run map and recruit loop.
6. Scale to 30-50 strict-gated characters.
7. Add campaign content, artifacts, synergies, polish, and ship.

Do not scale bad generation. If the seed characters do not feel distinct in combat, improve card schemas, templates, prompts, and validators before expanding the roster.
