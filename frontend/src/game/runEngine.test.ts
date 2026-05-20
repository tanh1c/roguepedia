import { describe, expect, it } from 'vitest';
import { applyMajorStatUpgrade, chooseNode, claimBattleReward, completeNonBattleNode, createInitialRunState, effectiveStats, progressForCharacter, resetRun, xpForNextLevel } from './runEngine';
import { seedCharacter } from './seedData';

describe('runEngine', () => {
  it('starts a run with a branching map, starter character, and level progress', () => {
    const run = createInitialRunState(seedCharacter);

    expect(run.phase).toBe('map');
    expect(run.party.map((character) => character.id)).toEqual([seedCharacter.id]);
    expect(run.deck).toHaveLength(seedCharacter.cards.length);
    expect(run.map[0]).toHaveLength(2);
    expect(run.map[run.map.length - 1][0].type).toBe('boss');
    expect(run.characterProgress[seedCharacter.id]).toEqual({ level: 1, xp: 0, statBonuses: {}, pendingMajorUpgrade: false });
  });

  it('starts battle when choosing an available node', () => {
    const run = createInitialRunState(seedCharacter);
    const node = run.map[0][0];

    const next = chooseNode(run, node.id);

    expect(next.phase).toBe('battle');
    expect(next.currentNodeId).toBe(node.id);
    expect(next.combat).not.toBeNull();
    expect(next.combat?.player.name).toBe(seedCharacter.name);
  });

  it('applies progression bonuses to effective stats without mutating base stats', () => {
    const progress = { level: 2, xp: 3, statBonuses: { hp: 8, attack: 2 }, pendingMajorUpgrade: false };

    const stats = effectiveStats(seedCharacter, progress);

    expect(stats.hp).toBe(seedCharacter.stats.hp + 8);
    expect(stats.attack).toBe(seedCharacter.stats.attack + 2);
    expect(seedCharacter.stats.hp).toBe(55);
  });

  it('starts combat using effective HP from progression bonuses', () => {
    const run = createInitialRunState(seedCharacter);
    const boosted = {
      ...run,
      characterProgress: {
        ...run.characterProgress,
        [seedCharacter.id]: { level: 2, xp: 0, statBonuses: { hp: 10 }, pendingMajorUpgrade: false },
      },
    };

    const next = chooseNode(boosted, boosted.map[0][0].id);

    expect(next.combat?.player.maxHp).toBe(seedCharacter.stats.hp + 10);
  });

  it('creates distinct elite and boss encounters from map node type', () => {
    const firstBattle = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-battle-b'), seedCharacter.id);
    const elite = chooseNode(firstBattle, 'act-2-elite');
    const afterElite = claimBattleReward(elite, seedCharacter.id);
    const secondBattle = claimBattleReward(chooseNode(afterElite, 'act-3-battle'), seedCharacter.id);
    const boss = chooseNode(secondBattle, 'act-4-boss');

    expect(elite.combat?.enemies[0]).toMatchObject({ id: 'enemy-peer-review-warden', name: 'Peer Review Warden' });
    expect(elite.combat?.enemies[0].maxHp).toBeGreaterThan(42);
    expect(boss.combat?.enemies[0]).toMatchObject({ id: 'enemy-canon-keeper', name: 'Canon Keeper' });
    expect(boss.combat?.enemies[0].maxHp).toBeGreaterThan(elite.combat?.enemies[0].maxHp ?? 0);
  });

  it('claims a battle reward, recruits a character, grants xp, and returns to map', () => {
    const run = chooseNode(createInitialRunState(seedCharacter), 'act-1-battle-a');

    const next = claimBattleReward(run, seedCharacter.id);

    expect(next.phase).toBe('map');
    expect(next.completedNodeIds).toContain('act-1-battle-a');
    expect(next.party).toHaveLength(2);
    expect(next.reserveRoster).toHaveLength(0);
    expect(next.deck).toHaveLength(seedCharacter.cards.length * 2);
    expect(progressForCharacter(next, seedCharacter.id).xp).toBeGreaterThan(0);
    expect(next.characterProgress[seedCharacter.id]).toBeDefined();
  });

  it('unlocks the next map row after clearing a node', () => {
    const run = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-battle-a'), seedCharacter.id);

    const next = chooseNode(run, 'act-2-rest');

    expect(next.phase).toBe('rest');
    expect(next.currentNodeId).toBe('act-2-rest');
  });

  it('levels up from battle xp and applies automatic stat growth', () => {
    const run = chooseNode({
      ...createInitialRunState(seedCharacter),
      characterProgress: {
        [seedCharacter.id]: { level: 1, xp: xpForNextLevel(1) - 1, statBonuses: {}, pendingMajorUpgrade: false },
      },
    }, 'act-1-battle-a');

    const next = claimBattleReward(run, seedCharacter.id);
    const progress = progressForCharacter(next, seedCharacter.id);

    expect(progress.level).toBeGreaterThan(1);
    expect(progress.statBonuses.hp).toBeGreaterThanOrEqual(2);
    expect(Object.values(progress.statBonuses).some((value) => (value ?? 0) > 0)).toBe(true);
    expect(next.summary[0]).toContain('reached Lv.');
  });

  it('marks every third level for a major stat upgrade', () => {
    const run = chooseNode({
      ...createInitialRunState(seedCharacter),
      characterProgress: {
        [seedCharacter.id]: { level: 2, xp: xpForNextLevel(2) - 1, statBonuses: {}, pendingMajorUpgrade: false },
      },
    }, 'act-1-battle-a');

    const next = claimBattleReward(run, seedCharacter.id);

    expect(progressForCharacter(next, seedCharacter.id).level).toBe(3);
    expect(progressForCharacter(next, seedCharacter.id).pendingMajorUpgrade).toBe(true);
  });

  it('applies a major stat upgrade and clears the pending choice', () => {
    const run = {
      ...createInitialRunState(seedCharacter),
      characterProgress: {
        [seedCharacter.id]: { level: 3, xp: 0, statBonuses: { hp: 4 }, pendingMajorUpgrade: true },
      },
    };

    const next = applyMajorStatUpgrade(run, seedCharacter.id, 'attack');

    expect(progressForCharacter(next, seedCharacter.id).statBonuses.attack).toBe(2);
    expect(progressForCharacter(next, seedCharacter.id).pendingMajorUpgrade).toBe(false);
  });

  it('clears several nodes, reaches the boss, and wins the run', () => {
    const firstBattle = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-battle-a'), seedCharacter.id);
    const rest = completeNonBattleNode(chooseNode(firstBattle, 'act-2-rest'));
    const secondBattle = claimBattleReward(chooseNode(rest, 'act-3-battle'), seedCharacter.id);
    const boss = chooseNode(secondBattle, 'act-4-boss');

    const won = claimBattleReward(boss, seedCharacter.id);

    expect(boss.phase).toBe('battle');
    expect(boss.currentNodeId).toBe('act-4-boss');
    expect(won.phase).toBe('won');
    expect(won.completedNodeIds).toEqual(['act-1-battle-a', 'act-2-rest', 'act-3-battle', 'act-4-boss']);
  });

  it('resets the run to a fresh map', () => {
    const run = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-battle-a'), seedCharacter.id);

    const next = resetRun(run);

    expect(next.phase).toBe('map');
    expect(next.completedNodeIds).toEqual([]);
    expect(next.party).toHaveLength(1);
  });
});
