import { describe, expect, it } from 'vitest';
import { applyArtifactReward, applySynergyRules } from './campaignContent';
import { activeCharacter, applyMajorStatUpgrade, chooseNode, claimBattleReward, claimCardReward, completeNonBattleNode, createInitialRunState, effectiveStats, equipSkillCard, MAX_DECK_SIZE, MAX_PARTY_SIZE, MAX_REWARD_PACK_SIZE, MIN_DECK_SIZE, offerCardRewards, progressForCharacter, resetRun, retireRun, skipCardReward, switchActiveCharacter, unequipSkillCard, xpForNextLevel, type RunNodeType } from './runEngine';
import { seedCharacter } from './seedData';
import type { RuntimeCharacter } from './runtimeTypes';

function characterFixture(id: string, name: string): RuntimeCharacter {
  return { ...seedCharacter, id, name, cards: seedCharacter.cards.map((card) => ({ ...card, id: `${id}-${card.id}`, owner_character_id: id })) };
}

function nodeId(run: ReturnType<typeof createInitialRunState>, type: RunNodeType, row?: number): string {
  const node = run.map.flat().find((candidate) => candidate.type === type && (row === undefined || candidate.row === row));
  if (!node) {
    throw new Error(`Missing ${type} node`);
  }
  return node.id;
}

describe('runEngine', () => {
  it('starts a run with a branching map, starter character, and level progress', () => {
    const run = createInitialRunState(seedCharacter);

    expect(run.phase).toBe('map');
    expect(run.party.map((character) => character.id)).toEqual([seedCharacter.id]);
    expect(run.activeCharacterId).toBe(seedCharacter.id);
    expect(activeCharacter(run).id).toBe(seedCharacter.id);
    expect(run.deck).toHaveLength(MIN_DECK_SIZE);
    expect(run.skillCollection).toHaveLength(MIN_DECK_SIZE);
    expect(run.act).toBe(1);
    expect(run.depth).toBe(0);
    expect(run.map[0]).toHaveLength(3);
    expect(run.map).toHaveLength(7);
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

  it('switches the active party member for the next battle', () => {
    const ada = characterFixture('Q-ada', 'Ada');
    const run = { ...createInitialRunState(seedCharacter), party: [seedCharacter, ada], reserveRoster: [] };

    const switched = switchActiveCharacter(run, ada.id);
    const battle = chooseNode(switched, switched.map[0][0].id);

    expect(switched.activeCharacterId).toBe(ada.id);
    expect(activeCharacter(switched).name).toBe('Ada');
    expect(battle.combat?.player.name).toBe('Ada');
  });

  it('rebuilds combat hand and draw pile when switching during battle', () => {
    const ada = characterFixture('Q-ada', 'Ada');
    const battle = chooseNode({ ...createInitialRunState(seedCharacter), party: [seedCharacter, ada], reserveRoster: [] }, 'act-1-floor-1-battle-0');

    const switched = switchActiveCharacter(battle, ada.id);

    expect(switched.activeCharacterId).toBe(ada.id);
    expect(switched.combat?.player.name).toBe('Ada');
    expect(switched.combat?.hand.every((card) => card.owner_character_id === ada.id)).toBe(true);
    expect(switched.combat?.drawPile.every((card) => card.owner_character_id === ada.id)).toBe(true);
  });

  it('ignores active character switches outside the party', () => {
    const run = createInitialRunState(seedCharacter);

    const switched = switchActiveCharacter(run, 'missing');

    expect(switched).toBe(run);
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
    const run = createInitialRunState(seedCharacter);
    const firstBattle = claimBattleReward(chooseNode(run, 'act-1-floor-1-battle-1'), seedCharacter.id);
    const elite = chooseNode(firstBattle, 'act-1-floor-2-elite-2');
    const bossReady = { ...firstBattle, completedNodeIds: ['act-1-floor-6-event-0'] };
    const boss = chooseNode(bossReady, nodeId(bossReady, 'boss'));

    expect(elite.combat?.enemies[0]).toMatchObject({ name: 'Peer Review Warden' });
    expect(elite.combat?.enemies[0].maxHp).toBeGreaterThan(42);
    expect(boss.combat?.enemies[0].name).toContain('Canon Keeper');
    expect(boss.combat?.enemies[0].maxHp).toBeGreaterThan(elite.combat?.enemies[0].maxHp ?? 0);
  });

  it('applies artifact and synergy effects when combat starts', () => {
    const run = applySynergyRules(applyArtifactReward(createInitialRunState(seedCharacter), 'spark-gap-relic'));

    const battle = chooseNode(run, 'act-1-floor-1-battle-0');

    expect(battle.combat?.maxEnergy).toBe(4);
    expect(battle.combat?.energy).toBe(4);
    expect(battle.combat?.hand.find((card) => card.id === 'magnifying_transmitter')?.mechanics[0].amount?.base).toBe(3);
  });

  it('preserves artifact and synergy effects when switching during battle', () => {
    const ada = characterFixture('Q-ada', 'Ada');
    const run = applySynergyRules(applyArtifactReward({ ...createInitialRunState(seedCharacter), party: [seedCharacter, ada], reserveRoster: [] }, 'shell-fragment'));
    const battle = chooseNode(run, 'act-1-floor-1-battle-0');

    const switched = switchActiveCharacter(battle, ada.id);

    expect(switched.combat?.player.block).toBeGreaterThanOrEqual(8);
  });

  it('claims a battle reward, recruits a new character, grants xp, offers cards, and returns to map', () => {
    const recruit = characterFixture('Q-recruit', 'Recruit');
    const run = chooseNode({ ...createInitialRunState(seedCharacter), reserveRoster: [recruit] }, 'act-1-floor-1-battle-0');

    const next = claimBattleReward(run, recruit.id);

    expect(next.phase).toBe('map');
    expect(next.completedNodeIds).toContain('act-1-floor-1-battle-0');
    expect(next.party).toHaveLength(2);
    expect(next.reserveRoster).toHaveLength(0);
    expect(next.deck).toHaveLength(MIN_DECK_SIZE + recruit.cards.length);
    expect(next.pendingCardRewards).toHaveLength(3);
    expect(progressForCharacter(next, seedCharacter.id).xp).toBeGreaterThan(0);
    expect(next.characterProgress[recruit.id]).toBeDefined();
  });

  it('offers unique limited card packs from roster decks', () => {
    const recruit = characterFixture('Q-recruit', 'Recruit');
    const run = { ...createInitialRunState(seedCharacter), reserveRoster: [recruit] };

    const rewarded = offerCardRewards(run);
    const packCards = rewarded.pendingCardRewards.flatMap((pack) => pack.cards);

    expect(rewarded.pendingCardRewards).toHaveLength(3);
    expect(rewarded.pendingCardRewards.every((pack) => pack.cards.length <= MAX_REWARD_PACK_SIZE)).toBe(true);
    expect(new Set(packCards.map((card) => card.id)).size).toBe(packCards.length);
    expect(packCards.every((card) => card.id.includes('-reward-'))).toBe(true);
  });

  it('claims or skips pending card packs', () => {
    const rewarded = offerCardRewards(createInitialRunState(seedCharacter));
    const pack = rewarded.pendingCardRewards[0];

    const claimed = claimCardReward(rewarded, pack.id);
    const skipped = skipCardReward(rewarded);

    expect(pack.cards.every((card) => claimed.skillCollection.some((deckCard) => deckCard.id === card.id))).toBe(true);
    expect(pack.cards.every((card) => !claimed.deck.some((deckCard) => deckCard.id === card.id))).toBe(true);
    expect(claimed.pendingCardRewards).toEqual([]);
    expect(skipped.deck).toHaveLength(rewarded.deck.length);
    expect(skipped.pendingCardRewards).toEqual([]);
  });

  it('equips reward pack skills into the active run deck for later battles', () => {
    const rewarded = offerCardRewards(createInitialRunState(seedCharacter));
    const pack = rewarded.pendingCardRewards[0];
    const reward = pack.cards[0];
    const collected = claimCardReward(rewarded, pack.id);

    const equipped = equipSkillCard(collected, reward.id);
    const battle = chooseNode(equipped, 'act-1-floor-1-battle-0');

    expect(equipped.deck.some((card) => card.id === reward.id)).toBe(true);
    expect(battle.combat?.hand.concat(battle.combat.drawPile, battle.combat.discardPile, battle.combat.exhaustPile).some((card) => card.name === reward.name)).toBe(true);
  });

  it('unequips skills from the active run deck without deleting collection copies', () => {
    const rewarded = offerCardRewards(createInitialRunState(seedCharacter));
    const pack = rewarded.pendingCardRewards[0];
    const reward = pack.cards[0];
    const collected = claimCardReward(rewarded, pack.id);
    const equipped = equipSkillCard({ ...collected, deck: [...collected.deck, ...collected.deck] }, reward.id);

    const unequipped = unequipSkillCard(equipped, reward.id);

    expect(unequipped.deck.some((card) => card.id === reward.id)).toBe(false);
    expect(unequipped.skillCollection.some((card) => card.id === reward.id)).toBe(true);
  });

  it('enforces minimum and maximum equipped deck size', () => {
    const baseRun = createInitialRunState(seedCharacter);
    const smallDeckRun = { ...baseRun, deck: baseRun.deck.slice(0, MIN_DECK_SIZE) };
    const fullDeckRun = { ...baseRun, deck: Array.from({ length: MAX_DECK_SIZE }, (_, index) => ({ ...baseRun.deck[index % baseRun.deck.length], id: `deck-${index}` })), skillCollection: [...baseRun.skillCollection, { ...baseRun.deck[0], id: 'extra-skill', name: 'Extra Skill' }] };

    expect(unequipSkillCard(smallDeckRun, smallDeckRun.deck[0].id)).toBe(smallDeckRun);
    expect(equipSkillCard(fullDeckRun, 'extra-skill')).toBe(fullDeckRun);
  });

  it('does not recruit beyond the max party size', () => {
    const fullParty = Array.from({ length: MAX_PARTY_SIZE }, (_, index) => characterFixture(`Q${index}`, `Hero ${index}`));
    const recruit = characterFixture('Q-extra', 'Extra');
    const run = chooseNode({ ...createInitialRunState(fullParty[0]), party: fullParty, reserveRoster: [recruit], activeCharacterId: fullParty[0].id }, 'act-1-floor-1-battle-0');

    const next = claimBattleReward(run, recruit.id);

    expect(next.party).toHaveLength(MAX_PARTY_SIZE);
    expect(next.party.some((character) => character.id === recruit.id)).toBe(false);
    expect(next.reserveRoster.some((character) => character.id === recruit.id)).toBe(true);
  });

  it('unlocks the next map row after clearing a node', () => {
    const run = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-floor-1-battle-0'), seedCharacter.id);
    const restNode = run.map[1].find((node) => node.type === 'rest') ?? run.map[1][0];

    const next = chooseNode(run, restNode.id);

    expect(next.phase).toBe(restNode.type === 'rest' ? 'rest' : 'battle');
    expect(next.currentNodeId).toBe(restNode.id);
  });

  it('levels up from battle xp and applies automatic stat growth', () => {
    const run = chooseNode({
      ...createInitialRunState(seedCharacter),
      characterProgress: {
        [seedCharacter.id]: { level: 1, xp: xpForNextLevel(1) - 1, statBonuses: {}, pendingMajorUpgrade: false },
      },
    }, 'act-1-floor-1-battle-0');

    const next = claimBattleReward(run, seedCharacter.id);
    const progress = progressForCharacter(next, seedCharacter.id);

    expect(progress.level).toBeGreaterThan(1);
    expect(progress.statBonuses.hp).toBeGreaterThanOrEqual(2);
    expect(Object.values(progress.statBonuses).some((value) => (value ?? 0) > 0)).toBe(true);
    expect(next.summary.some((entry) => entry.includes('reached Lv.'))).toBe(true);
  });

  it('marks every third level for a major stat upgrade', () => {
    const run = chooseNode({
      ...createInitialRunState(seedCharacter),
      characterProgress: {
        [seedCharacter.id]: { level: 2, xp: xpForNextLevel(2) - 1, statBonuses: {}, pendingMajorUpgrade: false },
      },
    }, 'act-1-floor-1-battle-0');

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

  it('clears a boss and advances to the next endless act', () => {
    let run = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-floor-1-battle-0'), seedCharacter.id);
    run = completeNonBattleNode(chooseNode(run, nodeId(run, 'rest')));
    run = claimBattleReward(chooseNode(run, nodeId(run, 'battle', 2)), seedCharacter.id);
    run = claimBattleReward(chooseNode(run, nodeId(run, 'elite', 3)), seedCharacter.id);
    run = claimBattleReward(chooseNode(run, nodeId(run, 'battle', 4)), seedCharacter.id);
    run = completeNonBattleNode(chooseNode(run, nodeId(run, 'event', 5)));
    const boss = chooseNode(run, nodeId(run, 'boss'));

    const nextAct = claimBattleReward(boss, seedCharacter.id);

    expect(boss.phase).toBe('battle');
    expect(nextAct.phase).toBe('map');
    expect(nextAct.act).toBe(2);
    expect(nextAct.completedNodeIds).toEqual([]);
    expect(nextAct.map[0][0].id).toContain('act-2-floor-1');
  });

  it('can retire an endless run', () => {
    const retired = retireRun(createInitialRunState(seedCharacter));

    expect(retired.phase).toBe('lost');
    expect(retired.summary[0]).toContain('Retired');
  });

  it('resets the run to a fresh map', () => {
    const run = claimBattleReward(chooseNode(createInitialRunState(seedCharacter), 'act-1-floor-1-battle-0'), seedCharacter.id);

    const next = resetRun(run);

    expect(next.phase).toBe('map');
    expect(next.completedNodeIds).toEqual([]);
    expect(next.party).toHaveLength(1);
  });
});
