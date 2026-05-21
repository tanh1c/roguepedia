import { applyCombatRewards } from './campaignContent';
import { createInitialCombatState, type CombatState, type EnemyTemplate } from './combatEngine';
import type { RuntimeCard, RuntimeCharacter } from './runtimeTypes';

export type RunNodeType = 'battle' | 'elite' | 'rest' | 'event' | 'treasure' | 'shop' | 'boss';

type CharacterStats = RuntimeCharacter['stats'];
export type CharacterStatKey = keyof CharacterStats;
export const MAX_PARTY_SIZE = 6;
export const MIN_DECK_SIZE = 8;
export const MAX_DECK_SIZE = 24;

export type CharacterProgress = {
  level: number;
  xp: number;
  statBonuses: Partial<CharacterStats>;
  pendingMajorUpgrade: boolean;
};

export type RunNode = {
  id: string;
  type: RunNodeType;
  title: string;
  row: number;
  nextNodeIds: string[];
};

export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'event' | 'won' | 'lost';

export type RunArtifact = {
  id: string;
  name: string;
  archetype: string;
  description: string;
};

export type ActiveSynergy = {
  archetype: string;
  description: string;
};

export type RunState = {
  phase: RunPhase;
  map: RunNode[][];
  act: number;
  depth: number;
  currentNodeId: string | null;
  completedNodeIds: string[];
  party: RuntimeCharacter[];
  reserveRoster: RuntimeCharacter[];
  deck: RuntimeCard[];
  skillCollection: RuntimeCard[];
  artifacts: RunArtifact[];
  activeSynergies: ActiveSynergy[];
  combat: CombatState | null;
  pendingCardRewards: RuntimeCard[];
  summary: string[];
  characterProgress: Record<string, CharacterProgress>;
  activeCharacterId: string;
};

export function createInitialRunState(starter: RuntimeCharacter): RunState {
  return {
    phase: 'map',
    map: createRunMap(1),
    act: 1,
    depth: 0,
    currentNodeId: null,
    completedNodeIds: [],
    party: [starter],
    reserveRoster: [starter],
    deck: [...starter.cards],
    skillCollection: [...starter.cards],
    activeCharacterId: starter.id,
    artifacts: [],
    activeSynergies: [],
    combat: null,
    pendingCardRewards: [],
    summary: ['Run started.'],
    characterProgress: { [starter.id]: initialCharacterProgress() },
  };
}

export function initialCharacterProgress(): CharacterProgress {
  return { level: 1, xp: 0, statBonuses: {}, pendingMajorUpgrade: false };
}

export function xpForNextLevel(level: number): number {
  return 20 + (level - 1) * 12;
}

export function progressForCharacter(run: RunState, characterId: string): CharacterProgress {
  return run.characterProgress?.[characterId] ?? initialCharacterProgress();
}

export function effectiveStats(character: RuntimeCharacter, progress: CharacterProgress): CharacterStats {
  return Object.fromEntries(
    Object.entries(character.stats).map(([key, value]) => [
      key,
      value + (progress.statBonuses[key as CharacterStatKey] ?? 0),
    ]),
  ) as CharacterStats;
}

export function effectiveCharacter(character: RuntimeCharacter, progress: CharacterProgress): RuntimeCharacter {
  return { ...character, stats: effectiveStats(character, progress) };
}

export function activeCharacter(run: RunState): RuntimeCharacter {
  return run.party.find((character) => character.id === run.activeCharacterId) ?? run.party[0];
}

export function switchActiveCharacter(run: RunState, characterId: string): RunState {
  const character = run.party.find((candidate) => candidate.id === characterId);
  if (!character || run.activeCharacterId === characterId) {
    return run;
  }

  const progress = progressForCharacter(run, character.id);
  const combat = run.combat && run.phase === 'battle'
    ? createRunCombat(run, character, enemiesFromCombat(run.combat))
    : run.combat;

  return {
    ...run,
    activeCharacterId: character.id,
    combat,
    summary: [`Switched lead to ${character.name}.`, ...run.summary],
  };
}

export function chooseNode(run: RunState, nodeId: string): RunState {
  const node = allNodes(run).find((candidate) => candidate.id === nodeId);
  if (!node || !isNodeAvailable(run, node)) {
    return run;
  }

  if (node.type === 'rest' || node.type === 'event' || node.type === 'treasure' || node.type === 'shop') {
    return {
      ...run,
      phase: node.type === 'shop' || node.type === 'treasure' ? 'event' : node.type,
      currentNodeId: node.id,
      summary: [`Reached ${node.title}.`, ...run.summary],
    };
  }

  const leadCharacter = activeCharacter(run);

  return {
    ...run,
    phase: 'battle',
    currentNodeId: node.id,
    combat: createRunCombat(run, leadCharacter, enemiesForNode(node)),
    summary: [`Entered ${node.title}.`, ...run.summary],
  };
}

export function claimBattleReward(run: RunState, recruitCharacterId: string): RunState {
  const node = run.currentNodeId ? allNodes(run).find((candidate) => candidate.id === run.currentNodeId) : undefined;
  const recruit = run.reserveRoster.find((character) => character.id === recruitCharacterId);
  const canRecruit = Boolean(recruit) && !run.party.some((character) => character.id === recruitCharacterId) && run.party.length < MAX_PARTY_SIZE;
  const recruited = recruit && canRecruit ? [recruit] : [];
  const completedNodeIds = run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId)
    ? [...run.completedNodeIds, run.currentNodeId]
    : run.completedNodeIds;
  const party = [...run.party, ...recruited];
  const progressWithRecruits = recruited.reduce<Record<string, CharacterProgress>>((progress, character) => ({
    ...progress,
    [character.id]: progress[character.id] ?? initialCharacterProgress(),
  }), run.characterProgress ?? {});
  const nodeType = node?.type ?? 'battle';
  const xpResult = gainPartyXp(party, progressWithRecruits, xpForNode(nodeType, run.depth));
  const baseNext: RunState = {
    ...run,
    phase: 'map',
    completedNodeIds,
    party,
    reserveRoster: recruited.length > 0 ? run.reserveRoster.filter((character) => character.id !== recruitCharacterId) : run.reserveRoster,
    deck: [...run.deck, ...recruited.flatMap((character) => character.cards)],
    skillCollection: [...(run.skillCollection ?? run.deck), ...recruited.flatMap((character) => character.cards)],
    combat: null,
    pendingCardRewards: [],
    characterProgress: xpResult.characterProgress,
    depth: run.depth + 1,
    summary: [...xpResult.summary, `Cleared ${run.currentNodeId ?? 'node'}.`, ...run.summary],
  };
  const next = nodeType === 'boss' ? advanceToNextAct(baseNext) : baseNext;

  return offerCardRewards(next, rewardCountForNode(nodeType));
}

export function applyMajorStatUpgrade(run: RunState, characterId: string, stat: CharacterStatKey): RunState {
  const progress = progressForCharacter(run, characterId);
  const amount = stat === 'hp' ? 6 : 2;

  return {
    ...run,
    characterProgress: {
      ...(run.characterProgress ?? {}),
      [characterId]: {
        ...progress,
        statBonuses: {
          ...progress.statBonuses,
          [stat]: (progress.statBonuses[stat] ?? 0) + amount,
        },
        pendingMajorUpgrade: false,
      },
    },
    summary: [`Major upgrade applied: +${amount} ${stat}.`, ...run.summary],
  };
}

export function offerCardRewards(run: RunState, count = 3): RunState {
  const ownedIds = new Set(run.deck.map((card) => card.id));
  const candidates = [...run.party, ...run.reserveRoster]
    .flatMap((character) => character.cards)
    .filter((card) => !ownedIds.has(card.id))
    .sort((first, second) => rewardCardScore(second) - rewardCardScore(first) || first.name.localeCompare(second.name));
  const fallbackCandidates = run.party.flatMap((character) => character.cards).sort((first, second) => rewardCardScore(second) - rewardCardScore(first) || first.name.localeCompare(second.name));
  const source = candidates.length >= count ? candidates : [...candidates, ...fallbackCandidates];
  const selected: RuntimeCard[] = [];
  const seenNames = new Set<string>();

  for (const card of source) {
    if (selected.length >= count) {
      break;
    }
    if (seenNames.has(card.name)) {
      continue;
    }
    seenNames.add(card.name);
    selected.push(cloneRewardCard(card, run, selected.length));
  }

  return {
    ...run,
    pendingCardRewards: selected,
    summary: selected.length ? ['Discovered new skill cards.', ...run.summary] : run.summary,
  };
}

export function claimCardReward(run: RunState, cardId: string): RunState {
  const reward = run.pendingCardRewards.find((card) => card.id === cardId);
  if (!reward) {
    return run;
  }

  return {
    ...run,
    skillCollection: [...(run.skillCollection ?? run.deck), reward],
    pendingCardRewards: [],
    summary: [`Added ${reward.name} to the deck.`, ...run.summary],
  };
}

export function skipCardReward(run: RunState): RunState {
  return {
    ...run,
    pendingCardRewards: [],
    summary: ['Skipped skill card reward.', ...run.summary],
  };
}

export function equipSkillCard(run: RunState, cardId: string): RunState {
  const collection = run.skillCollection ?? run.deck;
  const card = collection.find((candidate) => candidate.id === cardId);
  if (!card || run.deck.some((deckCard) => deckCard.id === card.id) || run.deck.length >= MAX_DECK_SIZE) {
    return run;
  }

  return {
    ...run,
    deck: [...run.deck, card],
    summary: [`Equipped ${card.name}.`, ...run.summary],
  };
}

export function unequipSkillCard(run: RunState, cardId: string): RunState {
  if (run.deck.length <= MIN_DECK_SIZE || !run.deck.some((card) => card.id === cardId)) {
    return run;
  }

  const card = run.deck.find((candidate) => candidate.id === cardId);
  return {
    ...run,
    deck: run.deck.filter((deckCard) => deckCard.id !== cardId),
    summary: card ? [`Unequipped ${card.name}.`, ...run.summary] : run.summary,
  };
}

export function completeNonBattleNode(run: RunState): RunState {
  const completedNodeIds = run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId)
    ? [...run.completedNodeIds, run.currentNodeId]
    : run.completedNodeIds;
  return {
    ...run,
    phase: 'map',
    completedNodeIds,
    currentNodeId: null,
    summary: ['Returned to the map.', ...run.summary],
  };
}

export function resetRun(run: RunState): RunState {
  return createInitialRunState(activeCharacter(run));
}

export function retireRun(run: RunState): RunState {
  return {
    ...run,
    phase: 'lost',
    combat: null,
    summary: ['Retired from the endless archive.', ...run.summary],
  };
}

export function isNodeAvailable(run: RunState, node: RunNode): boolean {
  if (run.completedNodeIds.includes(node.id)) {
    return false;
  }
  if (node.row === 0) {
    return run.completedNodeIds.length === 0;
  }
  return run.completedNodeIds.some((completedNodeId) => {
    const completedNode = allNodes(run).find((candidate) => candidate.id === completedNodeId);
    return completedNode?.nextNodeIds.includes(node.id) ?? false;
  });
}

function gainPartyXp(party: RuntimeCharacter[], characterProgress: Record<string, CharacterProgress>, amount: number): { characterProgress: Record<string, CharacterProgress>; summary: string[] } {
  const summary: string[] = [];
  const nextProgress = { ...characterProgress };

  for (const character of party) {
    let progress = { ...progressFromRecord(nextProgress, character.id), statBonuses: { ...progressFromRecord(nextProgress, character.id).statBonuses } };
    progress.xp += amount;

    while (progress.xp >= xpForNextLevel(progress.level)) {
      progress.xp -= xpForNextLevel(progress.level);
      progress = applyAutomaticGrowth(character, { ...progress, level: progress.level + 1 });
      summary.push(`${character.name} reached Lv. ${progress.level}.`);
    }

    nextProgress[character.id] = progress;
  }

  return { characterProgress: nextProgress, summary };
}

function applyAutomaticGrowth(character: RuntimeCharacter, progress: CharacterProgress): CharacterProgress {
  const [primaryStat, secondaryStat] = nonHpStatsByValue(character);
  const statBonuses = { ...progress.statBonuses };
  statBonuses.hp = (statBonuses.hp ?? 0) + 2;
  statBonuses[primaryStat] = (statBonuses[primaryStat] ?? 0) + 1;

  if (progress.level % 2 === 0) {
    statBonuses[secondaryStat] = (statBonuses[secondaryStat] ?? 0) + 1;
  }

  return {
    ...progress,
    statBonuses,
    pendingMajorUpgrade: progress.pendingMajorUpgrade || progress.level % 3 === 0,
  };
}

function nonHpStatsByValue(character: RuntimeCharacter): CharacterStatKey[] {
  return (Object.keys(character.stats) as CharacterStatKey[])
    .filter((stat) => stat !== 'hp')
    .sort((first, second) => character.stats[second] - character.stats[first]);
}

function progressFromRecord(characterProgress: Record<string, CharacterProgress>, characterId: string): CharacterProgress {
  return characterProgress[characterId] ?? initialCharacterProgress();
}

function xpForNode(type: RunNodeType, depth: number): number {
  const depthBonus = Math.floor(depth / 4) * 4;
  if (type === 'boss') {
    return 48 + depthBonus;
  }
  if (type === 'elite') {
    return 32 + depthBonus;
  }
  return 18 + depthBonus;
}

function rewardCountForNode(type: RunNodeType): number {
  if (type === 'boss') {
    return 4;
  }
  if (type === 'elite') {
    return 3;
  }
  return 3;
}

function advanceToNextAct(run: RunState): RunState {
  const nextAct = run.act + 1;
  return {
    ...run,
    act: nextAct,
    map: createRunMap(nextAct),
    currentNodeId: null,
    completedNodeIds: [],
    summary: [`Act ${nextAct} begins. The archive grows more dangerous.`, ...run.summary],
  };
}

function rewardCardScore(card: RuntimeCard): number {
  const rarityScore: Record<string, number> = { basic: 0, common: 2, signature: 5, rare: 7, ultimate: 10 };
  const mechanicScore = card.mechanics.reduce((score, mechanic) => score + (mechanic.kind === 'damage' ? 2 : mechanic.kind === 'draw_cards' || mechanic.kind === 'gain_energy' ? 3 : mechanic.kind === 'apply_status' || mechanic.kind === 'debuff_stat' || mechanic.kind === 'mark' ? 2 : 1), 0);
  return (rarityScore[card.card_rarity] ?? 1) + mechanicScore - card.energy_cost;
}

function cloneRewardCard(card: RuntimeCard, run: RunState, index: number): RuntimeCard {
  return {
    ...card,
    id: `${card.id}-reward-${run.completedNodeIds.length}-${index}`,
    upgraded: false,
    mechanics: card.mechanics.map((mechanic) => ({ ...mechanic, amount: mechanic.amount ? { ...mechanic.amount } : mechanic.amount })),
  };
}

function createRunCombat(run: RunState, character: RuntimeCharacter, enemies: EnemyTemplate[]): CombatState {
  const progress = progressForCharacter(run, character.id);
  const equippedDeck = run.deck.some((card) => card.owner_character_id === character.id) ? run.deck : character.cards;
  const deckCharacter = { ...effectiveCharacter(character, progress), cards: equippedDeck };
  return applyCombatRewards(run, createInitialCombatState(deckCharacter, enemies));
}

function enemiesFromCombat(combat: CombatState): EnemyTemplate[] {
  return combat.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => ({
    id: enemy.id,
    name: enemy.name,
    hp: enemy.hp,
    attack: combat.enemyIntent[enemy.id] ?? 7,
  }));
}

function enemiesForNode(node: RunNode): EnemyTemplate[] {
  const act = actFromNode(node);
  const scale = 1 + (act - 1) * 0.28 + node.row * 0.06;
  const hp = (base: number) => Math.round(base * scale);
  const attack = (base: number) => Math.round(base + (act - 1) * 2 + node.row * 0.5);

  if (node.type === 'boss') {
    return [{ id: `enemy-canon-keeper-a${act}`, name: `Canon Keeper ${act}`, hp: hp(96), attack: attack(12) }];
  }
  if (node.type === 'elite') {
    return [{ id: `enemy-peer-review-warden-a${act}`, name: 'Peer Review Warden', hp: hp(64), attack: attack(10) }];
  }
  if (node.row >= 4) {
    return [
      { id: `enemy-index-guardian-a${act}-${node.row}`, name: 'Index Guardian', hp: hp(36), attack: attack(7) },
      { id: `enemy-margin-stalker-a${act}-${node.row}`, name: 'Margin Stalker', hp: hp(30), attack: attack(6) },
    ];
  }
  return [{ id: `enemy-sentry-a${act}-${node.row}`, name: 'Archive Sentry', hp: hp(42), attack: attack(7) }];
}

function createRunMap(act: number): RunNode[][] {
  const rowTypes: RunNodeType[][] = [
    ['battle', 'battle', 'event'],
    ['battle', 'rest', 'elite'],
    ['battle', 'event', 'treasure'],
    ['elite', 'battle', 'shop'],
    ['battle', 'rest', 'battle'],
    ['event', 'elite', 'battle'],
    ['boss'],
  ];
  return rowTypes.map((types, rowIndex) => types.map((type, nodeIndex) => ({
    id: `act-${act}-floor-${rowIndex + 1}-${type}-${nodeIndex}`,
    type,
    title: nodeTitle(type, act, rowIndex + 1),
    row: rowIndex,
    nextNodeIds: rowIndex === rowTypes.length - 1 ? [] : nextNodeIdsForRow(act, rowIndex, nodeIndex, rowTypes[rowIndex + 1]),
  })));
}

function nextNodeIdsForRow(act: number, rowIndex: number, nodeIndex: number, nextRow: RunNodeType[]): string[] {
  if (nextRow.length === 1) {
    return [`act-${act}-floor-${rowIndex + 2}-${nextRow[0]}-0`];
  }
  const left = Math.max(0, nodeIndex - 1);
  const right = Math.min(nextRow.length - 1, nodeIndex + 1);
  return Array.from(new Set([left, nodeIndex, right]))
    .filter((index) => index < nextRow.length)
    .map((index) => `act-${act}-floor-${rowIndex + 2}-${nextRow[index]}-${index}`);
}

function nodeTitle(type: RunNodeType, act: number, floor: number): string {
  const titles: Record<RunNodeType, string[]> = {
    battle: ['Archive Patrol', 'Footnote Ambush', 'Index Guardians'],
    elite: ['Peer Review Warden', 'Citation Duelist', 'Errata Knight'],
    rest: ['Citation Camp', 'Quiet Archive', 'Margin Shelter'],
    event: ['Lost Reference', 'Strange Manuscript', 'Forked Timeline'],
    treasure: ['Sealed Booster Cache', 'Relic Cabinet', 'Rare Skill Vault'],
    shop: ['Black-Market Scriptorium', 'Traveling Curator', 'Ink Merchant'],
    boss: ['Canon Keeper'],
  };
  const options = titles[type];
  return `${options[(act + floor) % options.length]} ${act}-${floor}`;
}

function actFromNode(node: RunNode): number {
  return Number(node.id.match(/^act-(\d+)/)?.[1] ?? 1);
}

function allNodes(run: RunState): RunNode[] {
  return run.map.flat();
}
