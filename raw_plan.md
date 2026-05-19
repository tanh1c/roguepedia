# Roguepedia Character Generator - Full AI Agent Implementation Plan

## 0. Project Goal

Build a data-driven character generation pipeline for a roguelike collection battler.

The system should automatically generate playable game characters from Wikipedia/Wikidata entities.

Characters can be:
- Historical people
- Scientists
- Rulers
- Artists
- Military leaders
- Inventors
- Philosophers
- Animals
- Plants
- Microorganisms
- Extinct species
- Other real living organisms

The system must not require manually setting skills/stats for each character.

Instead, it should:
1. Search entities from Wikidata/Wikipedia.
2. Extract structured facts.
3. Normalize facts into a unified character profile.
4. Infer class, tags, era, rarity, stats, role, element/domain.
5. Generate skills/passives/synergies using LLM.
6. Validate that generated skills are grounded in Wikipedia/Wikidata facts.
7. Export complete character JSON files usable by a game frontend.

Project name: `Roguepedia`

---

## 1. Core Design Philosophy

Wikipedia/Wikidata should be treated as the source of facts.

The game system should generate derived gameplay data from those facts.

Do not manually define per-character stats like:

```txt
Tesla = Electric mage
Einstein = Time wizard
Tardigrade = Immortal tank
````

Instead, define global transformation rules:

```txt
If occupation includes "inventor" or "electrical engineer" → Technology/Engineer class.
If summary mentions "electricity" or "alternating current" → electric-themed skill allowed.
If organism has traits like "extreme survival" or "cryptobiosis" → Survival/Tank class.
If entity has many sitelinks, strong impact, and source richness → high rarity.
```

The final system should be automatic, but controlled.

---

## 2. MVP Scope

### MVP Target

Build a working pipeline that can generate full character cards from entity names.

Example commands:

```bash
python scripts/generate_character.py "Nikola Tesla"
python scripts/generate_character.py "Marie Curie"
python scripts/generate_character.py "Tardigrade"
python scripts/generate_character.py "Sun Tzu"
python scripts/generate_batch.py --category scientists --limit 100
python scripts/generate_batch.py --category animals --limit 100
```

### MVP Output

Each generated character should include:

* id
* name
* entity type
* source links
* image url if available
* era
* class
* role
* domain/element
* rarity
* rarity score
* stats
* tags
* active skills
* passive skill
* ultimate skill
* synergies
* lore
* grounding evidence
* validation status

### MVP Dataset Size

Start with:

* 100 scientists/inventors
* 100 rulers/military leaders
* 100 artists/philosophers/writers
* 100 animals/living organisms
* 50 special organisms/extinct species

Total MVP target: around 450 generated characters.

---

## 3. Recommended Tech Stack

### Backend / Pipeline

* Python 3.11+
* FastAPI for API server
* Pydantic for schemas
* Requests or httpx for API calls
* SPARQLWrapper or raw requests for Wikidata SPARQL
* SQLite for MVP local database
* PostgreSQL later if scaling
* JSON files for game export

### AI / LLM

Use one of:

* OpenAI API
* Gemini API
* OpenRouter
* Local LLM
* Ollama

The LLM should only generate gameplay interpretation, not facts.

### Frontend Preview

Use either:

* React + Vite
* Next.js
* Phaser for game prototype
* Simple React card viewer for MVP

### Optional Later

* Redis cache
* Background workers with Celery/RQ
* Vector database for grounding similarity
* pgvector
* Docker
* Kubernetes later

---

## 4. Project Folder Structure

```txt
roguepedia/
├── README.md
├── pyproject.toml
├── .env.example
├── data/
│   ├── raw/
│   │   ├── wikidata/
│   │   └── wikipedia/
│   ├── normalized/
│   ├── generated/
│   │   ├── characters/
│   │   ├── rejected/
│   │   └── reports/
│   └── exports/
│       └── game_characters.json
├── docs/
│   ├── character_schema.md
│   ├── rarity_formula.md
│   ├── stat_formula.md
│   ├── skill_generation_prompt.md
│   └── validation_rules.md
├── scripts/
│   ├── generate_character.py
│   ├── generate_batch.py
│   ├── validate_characters.py
│   ├── export_game_data.py
│   └── inspect_entity.py
├── src/
│   └── roguepedia/
│       ├── __init__.py
│       ├── config.py
│       ├── clients/
│       │   ├── wikidata_client.py
│       │   ├── wikipedia_client.py
│       │   └── llm_client.py
│       ├── collectors/
│       │   ├── entity_search.py
│       │   ├── human_collector.py
│       │   ├── organism_collector.py
│       │   └── batch_collector.py
│       ├── normalizers/
│       │   ├── entity_profile.py
│       │   ├── human_normalizer.py
│       │   ├── organism_normalizer.py
│       │   └── text_cleaner.py
│       ├── engines/
│       │   ├── era_engine.py
│       │   ├── class_engine.py
│       │   ├── tag_engine.py
│       │   ├── rarity_engine.py
│       │   ├── stat_engine.py
│       │   ├── role_engine.py
│       │   └── synergy_engine.py
│       ├── generation/
│       │   ├── skill_prompt_builder.py
│       │   ├── skill_generator.py
│       │   ├── lore_generator.py
│       │   └── character_assembler.py
│       ├── validation/
│       │   ├── schema_validator.py
│       │   ├── grounding_validator.py
│       │   ├── balance_validator.py
│       │   └── safety_validator.py
│       ├── storage/
│       │   ├── cache.py
│       │   ├── json_store.py
│       │   └── sqlite_store.py
│       ├── api/
│       │   ├── main.py
│       │   ├── routes_characters.py
│       │   └── routes_generation.py
│       └── schemas/
│           ├── source.py
│           ├── profile.py
│           ├── character.py
│           ├── skill.py
│           └── validation.py
└── frontend/
    ├── package.json
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── CharacterCard.tsx
    │   │   ├── CharacterGrid.tsx
    │   │   ├── SkillList.tsx
    │   │   └── SourcePanel.tsx
    │   └── pages/
    │       ├── CharacterViewer.tsx
    │       └── GenerateCharacter.tsx
    └── vite.config.ts
```

---

## 5. Data Sources

### 5.1 Wikidata

Use Wikidata for structured data.

Important fields to extract:

For humans:

* Wikidata QID
* label
* description
* aliases
* date of birth
* date of death
* occupation
* field of work
* country of citizenship
* place of birth
* notable work
* award received
* educated at
* member of
* image
* sitelinks count
* instance of
* sex/gender if available, but do not use it for gameplay stereotypes

For organisms:

* Wikidata QID
* label
* description
* taxon rank
* parent taxon
* habitat
* diet
* conservation status
* image
* subclass/taxon relationships
* instance of
* common name
* biological traits if available

### 5.2 Wikipedia

Use Wikipedia for:

* short summary
* article extract
* sections if needed
* image fallback
* source URL
* language-specific content

Default language: English.

Optional later:

* Vietnamese localization using Vietnamese Wikipedia if available.
* Fallback to English if Vietnamese page is missing.

---

## 6. Unified Entity Profile Schema

Create a normalized intermediate profile before generating gameplay data.

File: `src/roguepedia/schemas/profile.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SourceInfo(BaseModel):
    wikidata_id: str
    wikidata_url: str
    wikipedia_title: Optional[str] = None
    wikipedia_url: Optional[str] = None
    image_url: Optional[str] = None
    language: str = "en"

class EntityProfile(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    entity_type: str  # human, animal, plant, microorganism, extinct_species, unknown
    source: SourceInfo

    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    active_years: Optional[List[int]] = None

    occupations: List[str] = Field(default_factory=list)
    fields: List[str] = Field(default_factory=list)
    notable_works: List[str] = Field(default_factory=list)
    awards: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)

    taxon_rank: Optional[str] = None
    parent_taxa: List[str] = Field(default_factory=list)
    traits: List[str] = Field(default_factory=list)
    habitats: List[str] = Field(default_factory=list)

    wikipedia_summary: Optional[str] = None
    wikipedia_extract: Optional[str] = None

    sitelinks_count: int = 0
    claims_count: int = 0

    raw_wikidata: Dict[str, Any] = Field(default_factory=dict)
    raw_wikipedia: Dict[str, Any] = Field(default_factory=dict)
```

---

## 7. Final Character Schema

File: `src/roguepedia/schemas/character.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class CharacterStats(BaseModel):
    hp: int
    attack: int
    defense: int
    speed: int
    intelligence: int
    influence: int
    survival: int

class Skill(BaseModel):
    name: str
    type: str  # active, passive, ultimate
    description: str
    effect: str
    cooldown: int
    scaling: str
    target: str  # self, ally, enemy, all_enemies, all_allies
    status_effects: List[str] = Field(default_factory=list)
    inspired_by: str
    grounding_keywords: List[str] = Field(default_factory=list)

class Synergy(BaseModel):
    name: str
    tags_required: List[str]
    condition: str
    effect: str

class ValidationReport(BaseModel):
    schema_valid: bool
    grounded: bool
    balance_valid: bool
    safety_valid: bool
    warnings: List[str] = Field(default_factory=list)
    rejected_reasons: List[str] = Field(default_factory=list)

class GameCharacter(BaseModel):
    id: str
    name: str
    entity_type: str
    source: Dict

    era: str
    character_class: str
    role: str
    domain: str
    rarity: str
    rarity_score: float

    stats: CharacterStats
    tags: List[str]

    skills: List[Skill]
    synergies: List[Synergy]

    lore: str
    short_lore: str

    validation: ValidationReport
```

---

## 8. Entity Type Detection

Implement `infer_entity_type(profile)`.

Rules:

```txt
If instance_of includes "human" → human
If taxon rank exists → organism
If parent taxon exists → organism
If instance_of includes animal → animal
If instance_of includes plant → plant
If instance_of includes bacteria/fungus/virus → microorganism
If description contains "extinct" or taxon is extinct → extinct_species
Else unknown
```

Entity type values:

```txt
human
animal
plant
fungus
microorganism
extinct_species
unknown
```

---

## 9. Era Engine

File: `src/roguepedia/engines/era_engine.py`

Infer era from birth year, death year, or existence period.

Suggested era mapping:

```txt
Ancient: before 500
Medieval: 500 - 1499
Early Modern: 1500 - 1799
Industrial: 1800 - 1899
Modern: 1900 - 1999
Contemporary: 2000+
Prehistoric: extinct organisms before recorded history
Natural World: organisms without human historical period
Unknown: missing date
```

Pseudo-code:

```python
def infer_era(profile):
    if profile.entity_type in ["animal", "plant", "fungus", "microorganism"]:
        return "Natural World"

    if profile.entity_type == "extinct_species":
        return "Prehistoric"

    year = profile.birth_year or estimate_from_active_years(profile.active_years)

    if year is None:
        return "Unknown"

    if year < 500:
        return "Ancient"
    if year < 1500:
        return "Medieval"
    if year < 1800:
        return "Early Modern"
    if year < 1900:
        return "Industrial"
    if year < 2000:
        return "Modern"
    return "Contemporary"
```

---

## 10. Class Engine

File: `src/roguepedia/engines/class_engine.py`

### Human Classes

```txt
Scientist
Engineer
Inventor
Strategist
Warlord
Ruler
Artist
Writer
Philosopher
Explorer
Medic
Rebel
Diplomat
Athlete
Mystic
Scholar
Unknown
```

### Organism Classes

```txt
Beast
Predator
Survivor
Toxic
Swarm
Parasite
Plant
Fungus
Microbe
Aquatic
Avian
Ancient
Trickster
Nature
Unknown
```

### Class Inference Rules

```python
CLASS_RULES = {
    "Scientist": ["scientist", "physicist", "chemist", "biologist", "mathematician", "astronomer"],
    "Engineer": ["engineer", "electrical engineer", "mechanical engineer"],
    "Inventor": ["inventor"],
    "Strategist": ["strategist", "military theorist"],
    "Warlord": ["general", "military leader", "commander", "conqueror"],
    "Ruler": ["king", "queen", "emperor", "empress", "monarch", "ruler", "politician", "president"],
    "Artist": ["painter", "sculptor", "artist"],
    "Writer": ["writer", "poet", "novelist", "playwright"],
    "Philosopher": ["philosopher"],
    "Explorer": ["explorer", "navigator"],
    "Medic": ["physician", "doctor", "nurse", "surgeon"],
    "Diplomat": ["diplomat", "ambassador"],
    "Athlete": ["athlete", "footballer", "runner", "boxer"]
}
```

For organisms:

```python
ORGANISM_CLASS_RULES = {
    "Toxic": ["venomous", "poisonous", "toxin", "toxic"],
    "Survivor": ["extreme survival", "cryptobiosis", "extremophile", "resilient"],
    "Predator": ["predator", "carnivore", "apex predator"],
    "Trickster": ["camouflage", "mimicry", "intelligent", "problem-solving"],
    "Aquatic": ["marine", "freshwater", "aquatic"],
    "Avian": ["bird", "avian"],
    "Plant": ["plant", "tree", "flower"],
    "Fungus": ["fungus", "mushroom"],
    "Microbe": ["bacteria", "microorganism", "virus"],
    "Ancient": ["extinct", "dinosaur", "prehistoric"]
}
```

Tie-breaker:

* Choose the class with the highest matched score.
* If multiple classes tie, prefer more specific class.
* Save all matched classes as tags.

---

## 11. Domain / Element Engine

This is not fantasy element only. It should represent the main gameplay theme.

Allowed domains:

```txt
Knowledge
Technology
War
Influence
Nature
Survival
Poison
Disease
Art
Time
Electricity
Medicine
Exploration
Chaos
Strategy
Creation
Adaptation
```

Rules:

```txt
Scientist → Knowledge
Engineer/Inventor → Technology
Electrical engineer / electricity-related summary → Electricity
Military leader / strategist → War or Strategy
Ruler / diplomat → Influence
Artist / writer / composer → Art
Medic / physician → Medicine
Animal / plant → Nature
Tardigrade/extremophile → Survival
Venomous organism → Poison
Virus/bacteria/pathogen → Disease
```

---

## 12. Role Engine

Allowed roles:

```txt
Damage
Tank
Support
Control
Healer
Summoner
Trickster
Scaler
Debuffer
Buffer
Hybrid
```

Rules:

```txt
Warlord → Damage / Buffer
Strategist → Control / Support
Scientist → Control / Damage
Engineer → Damage / Utility
Ruler → Support / Buffer
Artist → Debuffer / Support
Medic → Healer
Predator → Damage
Survivor → Tank
Toxic → Debuffer / Damage
Microbe → Debuffer
Trickster → Control
```

---

## 13. Rarity Engine

File: `src/roguepedia/engines/rarity_engine.py`

Rarity should be deterministic and explainable.

### Rarity Score Formula

```txt
rarity_score =
  fame_score * 0.35
+ impact_score * 0.25
+ uniqueness_score * 0.20
+ source_richness_score * 0.10
+ gameplay_anomaly_score * 0.10
```

Each sub-score should be 0-100.

### Fame Score

Use:

* Wikidata sitelinks count
* Number of aliases
* Existence of Wikipedia page
* Article length if available

Pseudo-code:

```python
def fame_score(profile):
    score = 0

    if profile.sitelinks_count >= 150:
        score += 60
    elif profile.sitelinks_count >= 80:
        score += 45
    elif profile.sitelinks_count >= 30:
        score += 30
    elif profile.sitelinks_count >= 10:
        score += 15

    if profile.wikipedia_summary:
        score += 15

    if profile.source.image_url:
        score += 10

    if len(profile.aliases) >= 5:
        score += 5

    return min(score, 100)
```

### Impact Score

Use:

* occupations
* notable works
* awards
* historical role
* fields of work
* country/ruler/military status

Pseudo-code:

```python
HIGH_IMPACT_OCCUPATIONS = [
    "scientist", "inventor", "physicist", "chemist",
    "military leader", "general", "ruler", "king", "queen",
    "emperor", "philosopher", "writer", "artist"
]

def impact_score(profile):
    score = 0

    for occ in profile.occupations:
        if occ.lower() in HIGH_IMPACT_OCCUPATIONS:
            score += 12

    score += min(len(profile.notable_works) * 8, 24)
    score += min(len(profile.awards) * 5, 20)
    score += min(len(profile.fields) * 4, 16)

    return min(score, 100)
```

### Uniqueness Score

Use:

* rare traits
* rare occupations
* unusual entity type
* special biological traits
* strong domain identity

Examples:

* Tardigrade → very high
* Electric eel → high
* Octopus → high
* Common dog → medium
* Generic local politician → low/medium

### Source Richness Score

Use:

* claims count
* summary length
* article length
* number of structured facts

### Gameplay Anomaly Score

This measures how interesting the entity is as a game unit.

High anomaly examples:

* Tardigrade
* Immortal jellyfish
* Electric eel
* Octopus
* Marie Curie
* Tesla
* Sun Tzu
* Genghis Khan
* Plague bacterium

Rules:

* Electricity-related → +20
* Radiation-related → +20
* Extreme survival → +30
* Venom/toxin → +20
* Famous military strategy → +20
* Disease/pathogen → +25
* Camouflage/mimicry → +15

### Rarity Mapping

```python
def rarity_from_score(score):
    if score >= 90:
        return "Mythic"
    if score >= 75:
        return "Legendary"
    if score >= 60:
        return "Epic"
    if score >= 40:
        return "Rare"
    if score >= 20:
        return "Uncommon"
    return "Common"
```

---

## 14. Stat Engine

File: `src/roguepedia/engines/stat_engine.py`

### Base Stats

All characters start with:

```python
BASE_STATS = {
    "hp": 50,
    "attack": 50,
    "defense": 50,
    "speed": 50,
    "intelligence": 50,
    "influence": 50,
    "survival": 50
}
```

Stats should range from 20 to 100 in MVP.

### Human Stat Rules

```python
HUMAN_STAT_RULES = {
    "scientist": {"intelligence": 30},
    "physicist": {"intelligence": 30},
    "chemist": {"intelligence": 28},
    "mathematician": {"intelligence": 32},
    "inventor": {"intelligence": 22, "attack": 8},
    "engineer": {"intelligence": 20, "defense": 8},
    "military leader": {"attack": 25, "influence": 18, "defense": 8},
    "general": {"attack": 25, "influence": 15},
    "ruler": {"influence": 30, "defense": 10},
    "king": {"influence": 30, "defense": 10},
    "queen": {"influence": 30, "defense": 10},
    "emperor": {"influence": 35, "attack": 10},
    "philosopher": {"intelligence": 25, "influence": 10},
    "writer": {"intelligence": 12, "influence": 20},
    "artist": {"influence": 20, "speed": 5},
    "explorer": {"survival": 20, "speed": 15},
    "physician": {"intelligence": 18, "survival": 12},
    "athlete": {"speed": 25, "survival": 10}
}
```

### Organism Stat Rules

```python
ORGANISM_STAT_RULES = {
    "predator": {"attack": 30},
    "apex predator": {"attack": 35, "hp": 10},
    "venomous": {"attack": 20, "speed": 8},
    "poisonous": {"attack": 20, "defense": 8},
    "large": {"hp": 25, "defense": 15, "speed": -8},
    "small": {"speed": 12, "hp": -8},
    "camouflage": {"defense": 15, "speed": 10},
    "mimicry": {"defense": 12, "intelligence": 8},
    "intelligent": {"intelligence": 25},
    "social": {"influence": 15},
    "extreme survival": {"survival": 40, "defense": 15},
    "cryptobiosis": {"survival": 45},
    "parasite": {"attack": 10, "survival": 20},
    "pathogen": {"attack": 15, "survival": 20}
}
```

### Rarity Bonus

Apply small stat budget based on rarity.

```python
RARITY_BONUS = {
    "Common": 0,
    "Uncommon": 5,
    "Rare": 10,
    "Epic": 16,
    "Legendary": 24,
    "Mythic": 32
}
```

Do not add bonus equally to all stats.

Instead, add rarity bonus to the entity's top 2 most relevant stats.

Example:

* Scientist → intelligence, influence
* Warlord → attack, influence
* Survivor → survival, defense
* Toxic → attack, speed
* Ruler → influence, defense

### Clamp Stats

```python
def clamp_stat(value):
    return max(20, min(100, value))
```

---

## 15. Tag Engine

File: `src/roguepedia/engines/tag_engine.py`

Tags are important for synergy.

Generate tags from:

* entity type
* class
* occupation
* field
* era
* domain
* country/region
* organism taxon
* traits

Example tags:

```json
[
  "human",
  "modern",
  "scientist",
  "physicist",
  "knowledge",
  "technology",
  "nobel_prize",
  "electricity"
]
```

Normalize tags:

* lowercase
* snake_case
* remove special characters
* max 20 tags per character

---

## 16. Skill Generation

File: `src/roguepedia/generation/skill_generator.py`

### Skill Requirements

Each character should have:

* 2 active skills
* 1 passive skill
* 1 ultimate skill

MVP can generate:

```txt
skills = 4 total
```

Each skill must include:

* name
* type
* description
* effect
* cooldown
* scaling stat
* target
* status effects
* inspired_by
* grounding_keywords

### Allowed Status Effects

```txt
burn
shock
poison
bleed
stun
slow
weaken
vulnerable
shield
heal
regen
focus
research
morale
fear
confuse
charm
evade
stealth
mark
summon
adapt
revive
```

### Allowed Scaling Stats

```txt
attack
defense
speed
intelligence
influence
survival
none
```

### Skill Generation Prompt

File: `src/roguepedia/generation/skill_prompt_builder.py`

```txt
You are a game designer for a roguelike collection battler.

Generate gameplay skills for the character using ONLY the provided facts.

Rules:
- Do not invent unsupported biographical facts.
- You may stylize real facts into game mechanics.
- Each skill must include "inspired_by" using a specific fact from the input profile.
- Avoid offensive, defamatory, or disrespectful mechanics.
- For real humans, do not create skills based on sensitive personal attributes.
- Do not include graphic violence.
- Return valid JSON only.
- Cooldown must be between 0 and 6.
- The character must have exactly:
  - 2 active skills
  - 1 passive skill
  - 1 ultimate skill

Input profile:
{profile_json}

Computed gameplay metadata:
{metadata_json}

Allowed status effects:
{allowed_status_effects}

Output schema:
{
  "skills": [
    {
      "name": "...",
      "type": "active | passive | ultimate",
      "description": "...",
      "effect": "...",
      "cooldown": 0,
      "scaling": "attack | defense | speed | intelligence | influence | survival | none",
      "target": "self | ally | enemy | all_enemies | all_allies",
      "status_effects": ["..."],
      "inspired_by": "...",
      "grounding_keywords": ["..."]
    }
  ],
  "lore": "...",
  "short_lore": "..."
}
```

### Example LLM Output

```json
{
  "skills": [
    {
      "name": "Alternating Current",
      "type": "active",
      "description": "Release a controlled surge of technology damage that jumps between enemies.",
      "effect": "Deal 120% Intelligence damage to one enemy, then 50% damage to another random enemy.",
      "cooldown": 1,
      "scaling": "intelligence",
      "target": "enemy",
      "status_effects": ["shock"],
      "inspired_by": "The character is associated with alternating current electrical systems.",
      "grounding_keywords": ["alternating current", "electrical engineer", "inventor"]
    }
  ],
  "lore": "A visionary engineer whose work helped shape the electrical age.",
  "short_lore": "A technology-focused engineer who chains electric damage through enemy teams."
}
```

---

## 17. Skill Template Fallback

If LLM fails, use deterministic templates.

Examples:

### Scientist

```python
{
  "name": "Focused Hypothesis",
  "type": "active",
  "effect": "Apply Mark to one enemy and gain Research.",
  "scaling": "intelligence"
}
```

### Warlord

```python
{
  "name": "Commanding Charge",
  "type": "active",
  "effect": "Deal attack damage and give Morale to allies.",
  "scaling": "attack"
}
```

### Survivor Organism

```python
{
  "name": "Adaptive Survival",
  "type": "passive",
  "effect": "When HP drops below 30%, gain Shield and Regen once per battle.",
  "scaling": "survival"
}
```

### Toxic Organism

```python
{
  "name": "Venom Strike",
  "type": "active",
  "effect": "Deal damage and apply Poison.",
  "scaling": "attack"
}
```

---

## 18. Grounding Validator

File: `src/roguepedia/validation/grounding_validator.py`

Purpose:
Make sure every skill is based on facts from the entity profile.

### Validation Steps

For each skill:

1. Combine source text:

   * name
   * description
   * occupations
   * fields
   * notable works
   * traits
   * Wikipedia summary
   * Wikipedia extract

2. Check `inspired_by`.

3. Check `grounding_keywords`.

4. At least one grounding keyword must appear in source text.

5. If no keyword matches, mark warning.

6. If more than 2 skills are ungrounded, reject character.

Pseudo-code:

```python
def validate_grounding(character, profile):
    source_text = build_source_text(profile).lower()
    warnings = []

    for skill in character.skills:
        matched_keywords = [
            kw for kw in skill.grounding_keywords
            if kw.lower() in source_text
        ]

        inspired_match = any(
            token in source_text
            for token in tokenize(skill.inspired_by)
            if len(token) > 4
        )

        if not matched_keywords and not inspired_match:
            warnings.append(f"Skill may be ungrounded: {skill.name}")

    grounded = len(warnings) <= 1

    return grounded, warnings
```

Optional advanced validator:

* Use embedding similarity between skill inspiration and profile text.
* Use LLM judge with strict output: `grounded=true/false`.

---

## 19. Balance Validator

File: `src/roguepedia/validation/balance_validator.py`

Purpose:
Prevent broken generated characters.

### Rules

```txt
Stats must be between 20 and 100.
Total stat sum should not exceed rarity budget.
Cooldown must be 0-6.
Ultimate cooldown must be 3-6.
Passive cooldown must be 0.
Status effects per skill max 2.
Skill description max 240 characters.
Effect text max 300 characters.
No instant win.
No infinite loop.
No permanent stun.
No permanent invincibility.
No "kill all enemies".
No real-world hate or insult.
```

### Stat Budget

```python
RARITY_STAT_BUDGET = {
    "Common": 340,
    "Uncommon": 360,
    "Rare": 390,
    "Epic": 420,
    "Legendary": 455,
    "Mythic": 490
}
```

If total stats exceed budget:

* Normalize down proportionally.
* Preserve highest core stat.

---

## 20. Safety Validator

File: `src/roguepedia/validation/safety_validator.py`

Purpose:
Avoid disrespectful or risky generation for real people.

Rules:

* Do not create defamatory content.
* Avoid mocking real tragedies.
* Avoid skills based on race, religion, sexuality, disability, or protected identity.
* Avoid making living people into playable combat characters in MVP.
* Exclude living humans by default unless `ALLOW_LIVING_PEOPLE=true`.
* For controversial historical figures, use neutral mechanics based on documented role, not glorification.
* Avoid extremist symbols and propaganda terms.

MVP default:

```env
ALLOW_LIVING_PEOPLE=false
```

If a human has no death year and birth year suggests they may still be alive:

* reject
* or mark as `excluded_living_person`

---

## 21. Character Assembly Flow

File: `src/roguepedia/generation/character_assembler.py`

Full flow:

```python
def generate_character(entity_name: str) -> GameCharacter:
    # 1. Search entity
    search_result = wikidata_client.search_entity(entity_name)

    # 2. Fetch Wikidata entity
    raw_wikidata = wikidata_client.get_entity(search_result.qid)

    # 3. Fetch Wikipedia summary
    wiki_summary = wikipedia_client.get_summary(search_result.wikipedia_title)

    # 4. Normalize profile
    profile = normalize_entity(raw_wikidata, wiki_summary)

    # 5. Safety precheck
    safety_precheck(profile)

    # 6. Infer metadata
    era = era_engine.infer(profile)
    character_class = class_engine.infer(profile)
    domain = domain_engine.infer(profile)
    role = role_engine.infer(profile)
    tags = tag_engine.generate(profile)

    # 7. Calculate rarity
    rarity_score = rarity_engine.calculate(profile)
    rarity = rarity_engine.map_to_rarity(rarity_score)

    # 8. Calculate stats
    stats = stat_engine.calculate(profile, character_class, rarity)

    # 9. Generate skills/lore with LLM
    generated = skill_generator.generate(profile, metadata)

    # 10. Assemble character
    character = GameCharacter(...)

    # 11. Validate
    schema_report = schema_validator.validate(character)
    grounding_report = grounding_validator.validate(character, profile)
    balance_report = balance_validator.validate(character)
    safety_report = safety_validator.validate(character, profile)

    # 12. Repair if needed
    if not valid:
        character = repair_or_regenerate(character, reports)

    # 13. Save output
    json_store.save(character)

    return character
```

---

## 22. Batch Generation Flow

File: `scripts/generate_batch.py`

Supported categories:

```txt
scientists
inventors
rulers
military_leaders
artists
writers
philosophers
animals
plants
microorganisms
extinct_species
mixed
```

Example:

```bash
python scripts/generate_batch.py --category scientists --limit 100
```

Steps:

1. Run SPARQL query for category.
2. Get QIDs.
3. For each QID:

   * check cache
   * generate profile
   * generate character
   * validate
   * save accepted/rejected
4. Produce report.

Report:

```json
{
  "category": "scientists",
  "requested": 100,
  "generated": 92,
  "rejected": 8,
  "rejection_reasons": {
    "living_person": 3,
    "missing_summary": 2,
    "ungrounded_skills": 3
  }
}
```

---

## 23. Example SPARQL Query Concepts

The agent should implement SPARQL query templates for categories.

### Scientists

Query for humans with occupation scientist or field of work.

### Animals

Query for entities with taxon rank and animal parent taxon.

### Plants

Query for entities with plant taxon.

### Military Leaders

Query humans with occupation military leader/general/commander.

Important:

* Keep queries small.
* Add limit.
* Cache results.
* Avoid hammering public APIs.

---

## 24. API Server

Use FastAPI.

File: `src/roguepedia/api/main.py`

### Endpoints

```txt
GET /health
GET /characters
GET /characters/{id}
POST /generate
POST /generate/batch
POST /validate/{id}
GET /search?query=Tesla
GET /sources/{id}
```

### POST /generate

Request:

```json
{
  "name": "Nikola Tesla",
  "language": "en",
  "force_regenerate": false
}
```

Response:

```json
{
  "status": "success",
  "character": {}
}
```

### POST /generate/batch

Request:

```json
{
  "category": "scientists",
  "limit": 50,
  "language": "en"
}
```

Response:

```json
{
  "status": "started",
  "batch_id": "batch_001"
}
```

For MVP, batch can be synchronous.

---

## 25. Frontend Character Viewer

Build a simple frontend to inspect generated characters.

### Pages

#### Character Grid

Features:

* Search
* Filter by rarity
* Filter by class
* Filter by era
* Filter by entity type
* Filter by domain

#### Character Detail

Show:

* image
* name
* rarity
* class
* role
* stats
* skills
* synergies
* lore
* source links
* grounding evidence
* validation warnings

#### Generate Character Page

Input:

* entity name
* language
* generate button

Output:

* live loading state
* generated card
* validation result

---

## 26. Game Export Format

File: `data/exports/game_characters.json`

```json
{
  "version": "0.1.0",
  "generated_at": "YYYY-MM-DD",
  "characters": [
    {
      "id": "Q9036",
      "name": "Nikola Tesla",
      "entity_type": "human",
      "era": "Modern",
      "class": "Engineer",
      "role": "Damage / Control",
      "domain": "Technology",
      "rarity": "Legendary",
      "stats": {
        "hp": 72,
        "attack": 58,
        "defense": 44,
        "speed": 64,
        "intelligence": 96,
        "influence": 78,
        "survival": 40
      },
      "tags": ["human", "engineer", "inventor", "technology", "electricity"],
      "skills": [],
      "synergies": [],
      "source": {
        "wikidata_id": "Q9036",
        "wikipedia_url": "..."
      }
    }
  ]
}
```

---

## 27. Environment Variables

File: `.env.example`

```env
APP_ENV=development
DATA_DIR=./data

WIKIDATA_API_URL=https://www.wikidata.org/w/api.php
WIKIDATA_SPARQL_URL=https://query.wikidata.org/sparql
WIKIPEDIA_API_BASE=https://en.wikipedia.org/api/rest_v1

LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_API_KEY=your_key_here

ALLOW_LIVING_PEOPLE=false
MAX_BATCH_SIZE=100
CACHE_TTL_DAYS=30
```

---

## 28. Implementation Milestones

### Milestone 1 - Basic Data Fetching

Goal:
Generate raw entity data from Wikidata/Wikipedia.

Tasks:

* Implement Wikidata search by name.
* Implement Wikidata get entity by QID.
* Implement Wikipedia summary fetch.
* Save raw JSON to `data/raw`.
* Add CLI script `inspect_entity.py`.

Acceptance:

```bash
python scripts/inspect_entity.py "Nikola Tesla"
```

Should print:

* QID
* label
* description
* occupations
* fields
* summary
* image URL if available

---

### Milestone 2 - Normalized Profile

Goal:
Convert raw source data into `EntityProfile`.

Tasks:

* Implement human normalizer.
* Implement organism normalizer.
* Implement entity type detection.
* Extract birth/death year.
* Extract occupations/fields/notable works/awards.
* Extract taxon rank/parent taxa/traits where possible.
* Save normalized profile JSON.

Acceptance:

```bash
python scripts/generate_profile.py "Marie Curie"
```

Should output valid normalized profile.

---

### Milestone 3 - Rule Engines

Goal:
Generate deterministic metadata.

Tasks:

* Implement era engine.
* Implement class engine.
* Implement domain engine.
* Implement role engine.
* Implement tag engine.
* Implement rarity engine.
* Implement stat engine.

Acceptance:

```bash
python scripts/generate_character.py "Sun Tzu" --no-llm
```

Should output:

* class
* era
* role
* rarity
* stats
* tags

No skills required yet.

---

### Milestone 4 - LLM Skill Generation

Goal:
Generate grounded skills from profile.

Tasks:

* Implement LLM client.
* Implement prompt builder.
* Implement skill generator.
* Validate JSON output.
* Add retry if invalid JSON.
* Add fallback skill templates.

Acceptance:

```bash
python scripts/generate_character.py "Nikola Tesla"
```

Should output complete card with:

* 4 skills
* lore
* short lore

---

### Milestone 5 - Validators

Goal:
Prevent bad/unusable output.

Tasks:

* Schema validator.
* Grounding validator.
* Balance validator.
* Safety validator.
* Repair/regenerate function.

Acceptance:

* Ungrounded skills should be warned/rejected.
* Broken cooldowns should be fixed.
* Living people should be excluded by default.
* Character JSON should always match schema.

---

### Milestone 6 - Batch Generation

Goal:
Generate many characters.

Tasks:

* Implement category SPARQL templates.
* Implement batch collector.
* Implement batch generator.
* Implement cache.
* Implement report output.

Acceptance:

```bash
python scripts/generate_batch.py --category scientists --limit 20
```

Should generate accepted/rejected character files and a report.

---

### Milestone 7 - FastAPI Server

Goal:
Expose generator as API.

Tasks:

* Implement `/health`.
* Implement `/search`.
* Implement `/generate`.
* Implement `/characters`.
* Implement `/characters/{id}`.
* Add CORS for frontend.
* Add error responses.

Acceptance:

```bash
uvicorn roguepedia.api.main:app --reload
```

Then call:

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"name":"Tardigrade"}'
```

---

### Milestone 8 - Frontend Viewer

Goal:
Visualize generated characters.

Tasks:

* Create React app.
* Character grid.
* Character detail card.
* Generate character form.
* Filter/search UI.
* Source/validation panel.

Acceptance:
User can generate and inspect cards from browser.

---

### Milestone 9 - Game Export

Goal:
Export clean data for game usage.

Tasks:

* Implement export script.
* Remove internal raw data.
* Keep only game-needed fields.
* Validate export schema.
* Version output.

Acceptance:

```bash
python scripts/export_game_data.py
```

Should create:

```txt
data/exports/game_characters.json
```

---

## 29. Testing Plan

### Unit Tests

Test:

* entity type detection
* era inference
* class inference
* rarity calculation
* stat calculation
* tag normalization
* skill schema validation
* balance validation
* grounding validation

### Integration Tests

Test full generation for:

```txt
Nikola Tesla
Marie Curie
Sun Tzu
Cleopatra
Leonardo da Vinci
Tardigrade
Octopus
Electric eel
Axolotl
Tyrannosaurus
```

### Expected Behavior

Tesla:

* Engineer/Inventor
* Technology/Electricity
* high intelligence
* electric/technology skills

Marie Curie:

* Scientist
* Knowledge/Radiation
* high intelligence
* research/radiation-themed skills

Sun Tzu:

* Strategist
* War/Strategy
* high intelligence/influence
* enemy prediction/control skills

Tardigrade:

* Survivor
* Survival/Nature
* high survival/defense
* revive/shield/adaptation skills

Octopus:

* Trickster
* Nature/Adaptation
* intelligence/speed
* camouflage/confuse skills

---

## 30. Important Engineering Rules for AI Agent

When coding, follow these rules:

1. Do not hardcode individual character outcomes.
2. Only hardcode global rules, formulas, schemas, and templates.
3. Every generated skill must have `inspired_by`.
4. Every generated skill must have `grounding_keywords`.
5. Every character must include source links.
6. Never trust LLM output directly.
7. Always validate and repair.
8. Save raw data for debugging.
9. Save normalized profiles separately from generated game data.
10. Keep generation deterministic where possible.
11. Use cache to avoid repeated API calls.
12. Add clear error messages.
13. Keep MVP simple before adding combat/gameplay.
14. Exclude living humans by default.
15. Keep all output as valid JSON.

---

## 31. Definition of Done

The MVP is done when:

* User can input a Wikipedia/Wikidata entity name.
* System finds the correct entity.
* System extracts source facts.
* System creates a normalized profile.
* System calculates class, rarity, stats, role, domain, tags.
* System generates grounded skills.
* System validates the result.
* System exports a game-ready JSON card.
* User can view the generated card in a frontend.
* Batch generation works for at least 100 characters.
* Rejected characters have clear rejection reasons.

---

## 32. Future Features

After MVP:

### Gameplay

* Turn-based battle simulator.
* Team builder.
* Roguelike run map.
* Recruit after battle.
* Boss encounters.
* Relics/items.
* Era-based maps.

### Better AI

* RAG-based grounding.
* LLM judge for skill validation.
* Auto balance simulation.
* Skill mutation/evolution.
* Auto-generated event dialogue.

### Better Data

* Multi-language support.
* Vietnamese localization.
* Pageviews API for better fame score.
* Wikimedia Commons license filtering.
* More detailed biological trait extraction.

### Better Game Systems

* Character evolution.
* Synergy system.
* Rivalry system.
* Era bonuses.
* Research tree.
* Archive collection system.

---

## 33. Suggested First Command for AI Agent

Start by implementing the backend pipeline only.

Do not build the game yet.

First target:

```bash
python scripts/generate_character.py "Nikola Tesla"
```

Expected result:

```txt
data/generated/characters/Q9036.json
```

The JSON should contain a complete, validated character card.

```

Bạn có thể dùng nguyên file trên làm `PROJECT_PLAN.md`. Phần quan trọng nhất để agent code không bị loạn là câu này: **không hardcode từng nhân vật, chỉ hardcode rule/formula/schema/template toàn cục**.
::contentReference[oaicite:1]{index=1}
```

[1]: https://query.wikidata.org/?utm_source=chatgpt.com "Wikidata Query Service"
