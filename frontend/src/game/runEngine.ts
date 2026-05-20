import { createInitialCombatState, type CombatState, type EnemyTemplate } from './combatEngine';
import type { RuntimeCard, RuntimeCharacter } from './runtimeTypes';

export type RunNodeType = 'battle' | 'elite' | 'rest' | 'event' | 'boss';

type CharacterStats = RuntimeCharacter['stats'];
export type CharacterStatKey = keyof CharacterStats;

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
  currentNodeId: string | null;
  completedNodeIds: string[];
  party: RuntimeCharacter[];
  reserveRoster: RuntimeCharacter[];
  deck: RuntimeCard[];
  artifacts: RunArtifact[];
  activeSynergies: ActiveSynergy[];
  combat: CombatState | null;
  summary: string[];
  characterProgress: Record<string, CharacterProgress>;
};

export function createInitialRunState(starter: RuntimeCharacter): RunState {
  return {
    phase: 'map',
    map: createRunMap(),
    currentNodeId: null,
    completedNodeIds: [],
    party: [starter],
    reserveRoster: [starter],
    deck: [...starter.cards],
    artifacts: [],
    activeSynergies: [],
    combat: null,
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

export function chooseNode(run: RunState, nodeId: string): RunState {
  const node = allNodes(run).find((candidate) => candidate.id === nodeId);
  if (!node || !isNodeAvailable(run, node)) {
    return run;
  }

  if (node.type === 'rest' || node.type === 'event') {
    return {
      ...run,
      phase: node.type,
      currentNodeId: node.id,
      summary: [`Reached ${node.title}.`, ...run.summary],
    };
  }

  const leadCharacter = run.party[0];
  const leadProgress = progressForCharacter(run, leadCharacter.id);

  return {
    ...run,
    phase: 'battle',
    currentNodeId: node.id,
    combat: createInitialCombatState(effectiveCharacter(leadCharacter, leadProgress), enemiesForNode(node)),
    summary: [`Entered ${node.title}.`, ...run.summary],
  };
}

export function claimBattleReward(run: RunState, recruitCharacterId: string): RunState {
  const node = run.currentNodeId ? allNodes(run).find((candidate) => candidate.id === run.currentNodeId) : undefined;
  const recruit = run.reserveRoster.find((character) => character.id === recruitCharacterId);
  const recruited = recruit ? [recruit] : [];
  const completedNodeIds = run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId)
    ? [...run.completedNodeIds, run.currentNodeId]
    : run.completedNodeIds;
  const party = [...run.party, ...recruited];
  const progressWithRecruits = recruited.reduce<Record<string, CharacterProgress>>((progress, character) => ({
    ...progress,
    [character.id]: progress[character.id] ?? initialCharacterProgress(),
  }), run.characterProgress ?? {});
  const xpResult = gainPartyXp(party, progressWithRecruits, xpForNode(node?.type ?? 'battle'));

  return {
    ...run,
    phase: run.currentNodeId === 'act-4-boss' ? 'won' : 'map',
    completedNodeIds,
    party,
    reserveRoster: run.reserveRoster.filter((character) => character.id !== recruitCharacterId),
    deck: [...run.deck, ...recruited.flatMap((character) => character.cards)],
    combat: null,
    characterProgress: xpResult.characterProgress,
    summary: [...xpResult.summary, `Cleared ${run.currentNodeId ?? 'node'}.`, ...run.summary],
  };
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
  return createInitialRunState(run.party[0]);
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

function xpForNode(type: RunNodeType): number {
  if (type === 'boss') {
    return 48;
  }
  if (type === 'elite') {
    return 32;
  }
  return 18;
}

function enemiesForNode(node: RunNode): EnemyTemplate[] {
  if (node.type === 'boss') {
    return [{ id: 'enemy-canon-keeper', name: 'Canon Keeper', hp: 96, attack: 12 }];
  }
  if (node.type === 'elite') {
    return [{ id: 'enemy-peer-review-warden', name: 'Peer Review Warden', hp: 64, attack: 10 }];
  }
  if (node.id === 'act-3-battle') {
    return [
      { id: 'enemy-index-guardian', name: 'Index Guardian', hp: 36, attack: 7 },
      { id: 'enemy-margin-stalker', name: 'Margin Stalker', hp: 30, attack: 6 },
    ];
  }
  return [{ id: 'enemy-sentry', name: 'Archive Sentry', hp: 42, attack: 7 }];
}

function createRunMap(): RunNode[][] {
  return [
    [
      { id: 'act-1-battle-a', type: 'battle', title: 'Archive Patrol', row: 0, nextNodeIds: ['act-2-rest', 'act-2-event'] },
      { id: 'act-1-battle-b', type: 'battle', title: 'Footnote Ambush', row: 0, nextNodeIds: ['act-2-event', 'act-2-elite'] },
    ],
    [
      { id: 'act-2-rest', type: 'rest', title: 'Citation Camp', row: 1, nextNodeIds: ['act-3-battle'] },
      { id: 'act-2-event', type: 'event', title: 'Lost Reference', row: 1, nextNodeIds: ['act-3-battle'] },
      { id: 'act-2-elite', type: 'elite', title: 'Peer Review Warden', row: 1, nextNodeIds: ['act-3-battle'] },
    ],
    [
      { id: 'act-3-battle', type: 'battle', title: 'Index Guardians', row: 2, nextNodeIds: ['act-4-boss'] },
    ],
    [
      { id: 'act-4-boss', type: 'boss', title: 'Canon Keeper', row: 3, nextNodeIds: [] },
    ],
  ];
}

function allNodes(run: RunState): RunNode[] {
  return run.map.flat();
}
