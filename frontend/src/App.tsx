import { memo, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import frameA from './assets/frames/A-tier.png';
import frameB from './assets/frames/B-tier.png';
import frameC from './assets/frames/C-tier.png';
import frameD from './assets/frames/D-tier.png';
import frameS from './assets/frames/S-tier.png';
import {
  Archive,
  Book,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Crown,
  Feather,
  Fingerprint,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Library,
  Lock,
  Map as MapIcon,
  PenTool,
  Save,
  Search,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Sword,
} from 'lucide-react';
import { applyBattleReward, applyEventChoice, applyRestChoice, applySynergyRules, ARTIFACTS, EVENT_CHOICES } from './game/campaignContent';
import { endPlayerTurn, playCard, type CombatState } from './game/combatEngine';
import { activeCharacter, applyMajorStatUpgrade, claimBattleReward, claimCardReward, chooseNode, completeNonBattleNode, createInitialRunState, effectiveStats, equipSkillCard, isNodeAvailable, MAX_DECK_SIZE, MAX_PARTY_SIZE, MAX_REWARD_PACK_SIZE, MIN_DECK_SIZE, progressForCharacter, resetRun, retireRun, skipCardReward, switchActiveCharacter, unequipSkillCard, xpForNextLevel, type CharacterProgress, type CharacterStatKey, type RewardCardPack, type RunNodeType } from './game/runEngine';
import { runtimeRoster } from './game/roster';
import exportedSkillCodex from './game/skillCodex.json';
import { DEFAULT_SETTINGS, GALAXY_BACKGROUNDS, loadRunSnapshot, loadSettings, saveRunSnapshot, saveSettings, selectedGalaxyBackground, updateSettings, type GameSettings, type OverlayIntensity } from './game/settings';
import type { CharacterRarity, RuntimeCard, RuntimeCharacter, RuntimeDeckPreset } from './game/runtimeTypes';

const nodeIcons: Record<RunNodeType, ReactNode> = {
  battle: <Sword className="w-4 h-4" />,
  elite: <Skull className="w-4 h-4" />,
  rest: <Coffee className="w-4 h-4" />,
  event: <HelpCircle className="w-4 h-4" />,
  treasure: <Sparkles className="w-4 h-4" />,
  shop: <Archive className="w-4 h-4" />,
  boss: <Crown className="w-4 h-4" />,
};

const cardArt = [
  <BookOpen className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <Search className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <PenTool className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <BookMarked className="w-14 h-14 text-[#8A795D] stroke-[1.5]" />,
  <div className="flex gap-1"><Sword className="w-10 h-10 text-gray-500" /><Sword className="w-10 h-10 text-gray-500" /></div>,
];

const globalSkillCodex = exportedSkillCodex as RuntimeCard[];

type GameWindow = 'map' | 'commands' | 'log' | 'player' | 'enemy' | 'inventory' | 'deck' | 'synergies' | 'lore' | 'gallery' | null;

type CombatEffectKind = 'damage' | 'block' | 'heal' | 'attack' | 'defeat';

type CombatEffectEvent = {
  id: number;
  targetId: string;
  kind: CombatEffectKind;
  amount?: number;
};

export function App() {
  const starterCharacter = runtimeRoster[0];
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [selectedStarterId, setSelectedStarterId] = useState(starterCharacter.id);
  const [selectedDeckPresetId, setSelectedDeckPresetId] = useState(deckPresetsForCharacter(starterCharacter)[0].id);
  const [run, setRun] = useState(() => createRunWithRoster(starterCharacter, selectedDeckPresetId));
  const [selectedEnemyId, setSelectedEnemyId] = useState(run.combat?.enemies[0]?.id);
  const [intelEnemyId, setIntelEnemyId] = useState<string | null>(null);
  const [openWindow, setOpenWindow] = useState<GameWindow>(null);
  const [combatEffects, setCombatEffects] = useState<CombatEffectEvent[]>([]);
  const combatEffectIdRef = useRef(1);
  const combatEffectTimeoutRef = useRef<number | null>(null);
  const currentCharacter = activeCharacter(run);
  const pendingUpgradeCharacter = run.party.find((character) => progressForCharacter(run, character.id).pendingMajorUpgrade);
  const selectedStarter = runtimeRoster.find((character) => character.id === selectedStarterId) ?? starterCharacter;
  const selectedStarterDeckPresets = deckPresetsForCharacter(selectedStarter);
  const selectedDeckPreset = selectedStarterDeckPresets.find((preset) => preset.id === selectedDeckPresetId) ?? selectedStarterDeckPresets[0];
  const combat = run.combat;
  const livingEnemies = combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [];
  const selectedEnemy = combat?.enemies.find((enemy) => enemy.id === selectedEnemyId) ?? combat?.enemies[0];
  const hand = combat ? combat.hand : run.deck;
  const recruitChoices = run.reserveRoster.filter((character) => !run.party.some((partyMember) => partyMember.id === character.id)).slice(0, 3);
  const canEndTurn = Boolean(combat && combat.phase === 'player');

  const chooseCardReward = useCallback((cardId: string) => setRun((currentRun) => claimCardReward(currentRun, cardId)), []);
  const skipPendingCardReward = useCallback(() => setRun((currentRun) => skipCardReward(currentRun)), []);
  const save = () => setSavedSnapshot(saveRunSnapshot(run));
  const load = () => {
    const restored = savedSnapshot ? loadRunSnapshot(savedSnapshot) : null;
    if (restored) {
      setRun(restored);
      setSelectedEnemyId(restored.combat?.enemies[0]?.id);
    }
  };
  const selectedBackground = selectedGalaxyBackground(settings);
  const applySettings = (updates: Partial<GameSettings>) => {
    const nextSettings = updateSettings(settings, updates);
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };
  const showCombatEffects = (effects: Omit<CombatEffectEvent, 'id'>[]) => {
    if (!effects.length) {
      return;
    }
    const nextEffects = effects.map((effect) => ({ ...effect, id: combatEffectIdRef.current++ }));
    setCombatEffects(nextEffects);
    if (combatEffectTimeoutRef.current) {
      window.clearTimeout(combatEffectTimeoutRef.current);
    }
    combatEffectTimeoutRef.current = window.setTimeout(() => setCombatEffects([]), settings.reducedMotion ? 520 : 780);
  };
  const chooseMapNode = (nodeId: string) => {
    const next = chooseNode(run, nodeId);
    setRun(next);
    setSelectedEnemyId(next.combat?.enemies[0]?.id);
  };
  const playHandCard = (card: RuntimeCard) => {
    if (!combat) {
      return;
    }
    const result = playCard(combat, card.id, selectedEnemyId);
    const autoEndTurn = result.ok && shouldAutoEndTurn(result.state, settings.autoEndTurnOnEnergyEmpty);
    const nextCombat = autoEndTurn ? endPlayerTurn(result.state) : result.state;
    if (result.ok) {
      showCombatEffects([
        ...deriveCombatEffects(combat, result.state),
        ...(autoEndTurn ? deriveCombatEffects(result.state, nextCombat, { enemyAttack: true }) : []),
      ]);
    }
    setRun({ ...run, combat: nextCombat, phase: nextCombat.phase === 'lost' ? 'lost' : run.phase });
  };
  const primaryAction = () => {
    if (run.phase === 'rest') {
      setRun(applySynergyRules(completeNonBattleNode(applyRestChoice(run, 'upgrade'))));
      return;
    }
    if (run.phase === 'event') {
      setRun(completeNonBattleNode(run));
      return;
    }
    if (combat?.phase === 'won') {
      const recruitId = run.reserveRoster.find((character) => !run.party.some((partyMember) => partyMember.id === character.id))?.id ?? starterCharacter.id;
      const next = applySynergyRules(claimBattleReward(applyBattleReward(run), recruitId));
      setRun(next);
      setSelectedEnemyId(next.combat?.enemies[0]?.id);
      return;
    }
    if (combat?.phase === 'player') {
      const nextCombat = endPlayerTurn(combat);
      showCombatEffects(deriveCombatEffects(combat, nextCombat, { enemyAttack: true }));
      setRun({ ...run, combat: nextCombat });
    }
  };

  return (
    <main
      className={`rp-shell overlay-${settings.overlayIntensity} ${settings.animatedBackdrop && !settings.reducedMotion ? 'backdrop-animated' : ''}`}
      style={{ '--galaxy-background': `url(${selectedBackground.url})` } as React.CSSProperties}
    >
      <div className="rp-galaxy-backdrop"></div>
      <div className="rp-atmosphere"></div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-visible">
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_316px] gap-4 overflow-hidden">
          <CenterPanel
            combat={combat}
            currentCharacter={currentCharacter}
            currentProgress={progressForCharacter(run, currentCharacter.id)}
            combatEffects={combatEffects}
            hand={hand}
            livingEnemyCount={livingEnemies.length}
            onOpenEnemyIntel={(enemyId) => {
              setIntelEnemyId(enemyId);
              setOpenWindow('enemy');
            }}
            onOpenPlayerIntel={() => setOpenWindow('player')}
            onPrimaryAction={primaryAction}
            onRecruit={(characterId) => {
              const next = applySynergyRules(claimBattleReward(applyBattleReward(run), characterId));
              setRun(next);
              setSelectedEnemyId(next.combat?.enemies[0]?.id);
            }}
            onSelectEnemy={setSelectedEnemyId}
            onPlayCard={playHandCard}
            phase={combat?.phase ?? run.phase}
            primaryDisabled={run.phase === 'map' || (Boolean(combat) && !canEndTurn && combat?.phase !== 'won')}
            recruitChoices={recruitChoices}
            selectedEnemy={selectedEnemy}
            selectedEnemyId={selectedEnemyId}
            reducedMotion={settings.reducedMotion}
            settingsCompact={settings.compactCards}
          />
          {pendingUpgradeCharacter ? <LevelUpOverlay
            character={pendingUpgradeCharacter}
            progress={progressForCharacter(run, pendingUpgradeCharacter.id)}
            onChoose={(stat) => setRun(applyMajorStatUpgrade(run, pendingUpgradeCharacter.id, stat))}
          /> : null}
          {run.pendingCardRewards.length ? <CardRewardOverlay cards={run.pendingCardRewards} onChoose={chooseCardReward} onSkip={skipPendingCardReward} /> : null}
          <CommandDock
            artifactCount={run.artifacts.length}
            characterName={currentCharacter.name}
            combat={combat}
            deckCount={run.deck.length}
            nodeCount={`${run.completedNodeIds.length + 1} / ${run.map.length}`}
            phase={combat?.phase ?? run.phase}
            primaryDisabled={run.phase === 'map' || (Boolean(combat) && !canEndTurn && combat?.phase !== 'won')}
            run={run}
            savedSnapshot={savedSnapshot}
            settings={settings}
            showTutorial={settings.showTutorial}
            onEventChoice={(choiceId) => setRun(applySynergyRules(applyEventChoice(run, choiceId)))}
            onLoad={load}
            onOpenWindow={setOpenWindow}
            onPrimaryAction={primaryAction}
            onReset={() => {
              const next = createRunWithRoster(selectedStarter, selectedDeckPreset.id);
              setRun(next);
              setSelectedEnemyId(next.combat?.enemies[0]?.id);
            }}
            onSave={save}
            onSettings={() => setSettingsOpen(true)}
            onSwitchCharacter={(characterId) => setRun(switchActiveCharacter(run, characterId))}
            onUpdateSettings={applySettings}
          />
          <GameWindowOverlay
            activeWindow={openWindow}
            character={currentCharacter}
            combat={combat}
            intelEnemy={combat?.enemies.find((enemy) => enemy.id === intelEnemyId) ?? selectedEnemy}
            roster={runtimeRoster}
            run={run}
            selectedDeckPresetId={selectedDeckPreset.id}
            selectedStarterId={selectedStarter.id}
            onArtifact={() => setRun(applySynergyRules({ ...run, artifacts: [ARTIFACTS[0], ...run.artifacts] }))}
            onClose={() => setOpenWindow(null)}
            onChooseDeck={(characterId, presetId) => {
              const nextStarter = runtimeRoster.find((character) => character.id === characterId) ?? starterCharacter;
              setSelectedStarterId(nextStarter.id);
              setSelectedDeckPresetId(presetId);
              if (run.phase === 'map' && run.completedNodeIds.length === 0) {
                setRun(createRunWithRoster(nextStarter, presetId));
              }
            }}
            onChooseNode={(nodeId) => {
              chooseMapNode(nodeId);
              setOpenWindow(null);
            }}
            onEquipSkill={(cardId) => setRun(equipSkillCard(run, cardId))}
            onEventChoice={(choiceId) => setRun(applySynergyRules(applyEventChoice(run, choiceId)))}
            onPrimaryAction={primaryAction}
            onRetire={() => setRun(retireRun(run))}
            onScan={() => setRun(applySynergyRules(run))}
            onUnequipSkill={(cardId) => setRun(unequipSkillCard(run, cardId))}
          />
        </div>
      </div>
      {settingsOpen ? <SettingsCenter settings={settings} onClose={() => setSettingsOpen(false)} onUpdateSettings={applySettings} /> : null}
    </main>
  );
}

function createRunWithRoster(starterCharacter: RuntimeCharacter, presetId?: string) {
  const starterWithDeck = characterWithDeckPreset(starterCharacter, presetId ?? deckPresetsForCharacter(starterCharacter)[0].id);
  return {
    ...createInitialRunState(starterWithDeck),
    reserveRoster: runtimeRoster.filter((character) => character.id !== starterCharacter.id),
  };
}

function deckPresetsForCharacter(character: RuntimeCharacter): RuntimeDeckPreset[] {
  return character.deck_presets?.length
    ? character.deck_presets
    : [{ id: 'core', name: 'Core Codex', archetype: 'balanced', description: 'Default generated deck.', cards: character.cards }];
}

function characterWithDeckPreset(character: RuntimeCharacter, presetId: string): RuntimeCharacter {
  const preset = deckPresetsForCharacter(character).find((candidate) => candidate.id === presetId) ?? deckPresetsForCharacter(character)[0];
  return { ...character, cards: preset.cards };
}

function shouldAutoEndTurn(combat: NonNullable<ReturnType<typeof createInitialRunState>['combat']>, enabled: boolean): boolean {
  return enabled && combat.phase === 'player' && combat.energy === 0 && combat.enemies.some((enemy) => enemy.hp > 0);
}

function deriveCombatEffects(before: CombatState, after: CombatState, options: { enemyAttack?: boolean } = {}): Omit<CombatEffectEvent, 'id'>[] {
  const effects: Omit<CombatEffectEvent, 'id'>[] = [];
  const beforeCombatants = combatantsById(before);
  const afterCombatants = combatantsById(after);

  if (options.enemyAttack) {
    for (const enemy of before.enemies) {
      if (enemy.hp > 0) {
        effects.push({ targetId: enemy.id, kind: 'attack', amount: before.enemyIntent[enemy.id] ?? 7 });
      }
    }
  }

  for (const [targetId, previous] of beforeCombatants.entries()) {
    const current = afterCombatants.get(targetId);
    if (!current) {
      continue;
    }
    if (current.hp < previous.hp) {
      effects.push({ targetId, kind: 'damage', amount: previous.hp - current.hp });
    }
    if (current.hp > previous.hp) {
      effects.push({ targetId, kind: 'heal', amount: current.hp - previous.hp });
    }
    if (current.block > previous.block) {
      effects.push({ targetId, kind: 'block', amount: current.block - previous.block });
    }
    if (previous.hp > 0 && current.hp <= 0) {
      effects.push({ targetId, kind: 'defeat' });
    }
  }

  return effects;
}

function combatantsById(combat: CombatState) {
  return new Map([[combat.player.id, combat.player], ...combat.enemies.map((enemy) => [enemy.id, enemy] as const)]);
}


function HeaderStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[10px] border border-white/8 bg-white/[0.045] px-3 py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)]"><span className="block font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/38">{label}</span><span className="mt-0.5 block truncate font-mono text-base font-semibold leading-tight text-white tabular-nums">{value}</span></div>;
}

function HeaderButton({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button className="group flex items-center justify-between gap-2 rounded-[10px] border border-white/8 bg-white/[0.045] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/66 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:translate-y-0 disabled:opacity-35" disabled={disabled} onClick={onClick}><span className="truncate">{label}</span><span className="grid h-6 w-6 place-items-center rounded-[8px] bg-white/[0.08] text-white/72 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">{icon}</span></button>;
}

function MapPanel({ run, onChooseNode, onRetire }: { run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void; onRetire: () => void }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNode = run.map.flat().find((node) => node.id === hoveredNodeId) ?? null;

  return (
    <div className="relative flex h-full min-h-[68vh] w-full flex-col overflow-hidden bg-black/24 text-gray-200 shadow-none backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><MapIcon className="h-4 w-4 text-white/55" /><h2 className="font-serif text-lg text-white">Act {run.act} · Depth {run.depth}</h2></div><HelpCircle className="h-4 w-4 cursor-pointer text-white/35" /></div>
        <div className="mt-3 grid grid-cols-7 border border-white/10 text-center font-mono text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
          <Legend icon={<Sword className="h-3.5 w-3.5 text-gray-400" />} label="Battle" />
          <Legend icon={<Skull className="h-3.5 w-3.5 text-orange-300/70" />} label="Elite" />
          <Legend icon={<Coffee className="h-3.5 w-3.5 text-emerald-200/70" />} label="Rest" />
          <Legend icon={<HelpCircle className="h-3.5 w-3.5 text-purple-200/70" />} label="Event" />
          <Legend icon={<Sparkles className="h-3.5 w-3.5 text-yellow-200/70" />} label="Cache" />
          <Legend icon={<Archive className="h-3.5 w-3.5 text-sky-200/70" />} label="Shop" />
          <Legend icon={<Crown className="h-3.5 w-3.5 text-red-200/70" />} label="Boss" />
        </div>
      </div>
      <div className="relative flex-1 w-full overflow-hidden">
        <div className="absolute inset-x-8 top-3 bottom-20 rounded-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_55%)] blur-sm"></div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="map-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="map-path-active" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="map-path-idle" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          {run.map.slice(0, -1).flatMap((row, rowIndex) => row.flatMap((node, nodeIndex) => node.nextNodeIds.map((nextNodeId) => {
            const nextRow = run.map[rowIndex + 1];
            const nextNodeIndex = nextRow.findIndex((candidate) => candidate.id === nextNodeId);
            if (nextNodeIndex === -1) {
              return null;
            }
            const start = mapNodePosition(rowIndex, nodeIndex, row.length);
            const end = mapNodePosition(rowIndex + 1, nextNodeIndex, nextRow.length);
            const completed = run.completedNodeIds.includes(node.id);
            const available = completed || (run.phase === 'map' && isNodeAvailable(run, nextRow[nextNodeIndex]));
            const bend = Math.max(6, Math.abs(end.x - start.x) * 0.18);
            return (
              <path
                d={`M ${start.x} ${start.y + 3} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y - 3}`}
                filter={available ? 'url(#map-glow)' : undefined}
                key={`${node.id}-${nextNodeId}`}
                stroke={available ? 'url(#map-path-active)' : 'url(#map-path-idle)'}
                strokeDasharray={completed ? undefined : '1.6 2.2'}
                strokeLinecap="round"
                strokeWidth={available ? 0.95 : 0.58}
                fill="none"
              />
            );
          })))}
        </svg>
        {run.map.map((row, rowIndex) => row.map((node, nodeIndex) => {
          const available = run.phase === 'map' && isNodeAvailable(run, node);
          const completed = run.completedNodeIds.includes(node.id);
          const hovered = hoveredNodeId === node.id;
          const position = mapNodePosition(rowIndex, nodeIndex, row.length);
          const nodeClass = available
            ? 'h-10 w-10 cursor-pointer border border-white/35 bg-white/15 text-white shadow-[0_0_0_4px_rgba(255,255,255,0.06),0_0_20px_rgba(255,255,255,0.18)] backdrop-blur-md'
            : completed
              ? 'h-8 w-8 border border-white/25 bg-white/10 text-white/80 shadow-[0_0_14px_rgba(255,255,255,0.10)] backdrop-blur-md'
              : inactiveNodeClass(node.type);
          return (
            <button
              className={`group absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 transition hover:scale-110 ${nodeClass}`}
              disabled={!available}
              key={node.id}
              onBlur={() => setHoveredNodeId(null)}
              onClick={() => onChooseNode(node.id)}
              onFocus={() => setHoveredNodeId(node.id)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ top: `${position.y}%`, left: `${position.x}%` }}
              title={`${node.title} — ${node.type}`}
            >
              <span className="absolute inset-1 border-2 border-white/15"></span>
              <span className="relative z-10">{completed ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : nodeIcons[node.type]}</span>
              {hovered ? <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border border-white/15 bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 shadow-lg backdrop-blur-md">{node.title}</span> : null}
            </button>
          );
        }))}
      </div>
      <div className="absolute bottom-4 right-4 z-30 w-[158px] border border-white/15 bg-black/45 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        {hoveredNode ? <NodeInfo node={hoveredNode} run={run} /> : <div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Node Info</span><p className="mt-1 text-xs leading-snug text-gray-400">Hover a map node to preview its type and state.</p></div>}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-white/10 bg-black/28 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
        <span>Endless archive</span>
        <span className="text-sm font-semibold text-white tabular-nums">{run.completedNodeIds.length}/{run.map.length}</span>
        <button className="border border-red-200/20 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-red-100/70 transition hover:bg-red-500/18" onClick={onRetire} type="button">Retire</button>
      </div>
    </div>
  );
}

function mapNodePosition(rowIndex: number, nodeIndex: number, rowLength: number): { x: number; y: number } {
  const rowAnchors: Record<number, number[]> = {
    1: [42],
    2: [28, 56],
    3: [20, 42, 64],
  };
  const anchors = rowAnchors[rowLength] ?? Array.from({ length: rowLength }, (_, index) => 22 + index * (56 / Math.max(1, rowLength - 1)));
  return {
    x: anchors[nodeIndex] ?? 42,
    y: 9 + rowIndex * 17,
  };
}

function inactiveNodeClass(type: RunNodeType): string {
  if (type === 'elite') {
    return 'h-8 w-8 border border-white/15 bg-white/[0.06] text-orange-200/70 opacity-60 backdrop-blur-md';
  }
  if (type === 'rest') {
    return 'h-8 w-8 border border-white/15 bg-white/[0.06] text-emerald-100/70 opacity-60 backdrop-blur-md';
  }
  if (type === 'event') {
    return 'h-8 w-8 border border-white/15 bg-white/[0.06] text-purple-100/70 opacity-60 backdrop-blur-md';
  }
  if (type === 'boss') {
    return 'h-9 w-9 border border-white/20 bg-white/[0.07] text-red-100/75 opacity-70 backdrop-blur-md';
  }
  return 'h-8 w-8 border border-white/15 bg-white/[0.06] text-gray-200/70 opacity-60 backdrop-blur-md';
}

function Legend({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex flex-col items-center justify-center gap-1 border-r border-white/10 py-1.5 last:border-r-0">{icon}<span>{label}</span></div>;
}

function SettingsCenter({ settings, onClose, onUpdateSettings }: { settings: GameSettings; onClose: () => void; onUpdateSettings: (updates: Partial<GameSettings>) => void }) {
  const selectedBackground = selectedGalaxyBackground(settings);
  const overlayOptions: { value: OverlayIntensity; label: string; detail: string }[] = [
    { value: 'soft', label: 'Soft', detail: 'brighter backdrop' },
    { value: 'balanced', label: 'Balanced', detail: 'default clarity' },
    { value: 'dark', label: 'Dark', detail: 'maximum contrast' },
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Visual settings">
      <section className="flex h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-white/16 bg-black/58 text-white shadow-[0_28px_90px_rgba(0,0,0,0.46)]">
        <header className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 bg-white/[0.035] px-4 py-3">
          <div className="min-w-0">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/42">Workspace</span>
            <h2 className="truncate font-serif text-2xl font-black">Settings</h2>
          </div>
          <button className="border border-white/16 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12" onClick={onClose}>Close</button>
        </header>

        <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 grid gap-3 rounded-[18px] border border-white/10 bg-black/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="min-w-0">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Visual Archive</span>
                <h3 className="font-serif text-xl font-black text-white">Galaxy Backdrop</h3>
              </div>
              <span className="rounded-[10px] border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-white/52">{selectedBackground.name}</span>
            </div>
            <div className="galaxy-grid">
              {GALAXY_BACKGROUNDS.map((background) => (
                <button
                  className={`galaxy-option ${background.id === settings.galaxyBackgroundId ? 'is-active' : ''}`}
                  key={background.id}
                  onClick={() => onUpdateSettings({ galaxyBackgroundId: background.id })}
                >
                  <span className="galaxy-option__image" style={{ backgroundImage: `url(${background.previewUrl})` }}></span>
                  <span className="galaxy-option__copy">
                    <strong>{background.name}</strong>
                    <small>{background.mood}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[18px] border border-white/10 bg-black/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="mb-3 border-b border-white/10 pb-3">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Atmosphere</span>
                <h3 className="font-serif text-xl font-black text-white">Overlay Density</h3>
                <p className="mt-1 text-xs font-medium text-white/50">Control how strongly the table darkens the selected background.</p>
              </div>
              <div className="segmented-control">
                {overlayOptions.map((option) => (
                  <button className={option.value === settings.overlayIntensity ? 'is-active' : ''} key={option.value} onClick={() => onUpdateSettings({ overlayIntensity: option.value })}>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-black/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="mb-3 border-b border-white/10 pb-3">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Combat UX</span>
                <h3 className="font-serif text-xl font-black text-white">Table Preferences</h3>
                <p className="mt-1 text-xs font-medium text-white/50">Keep the run readable while preserving the cosmic mood.</p>
              </div>
              <div className="settings-toggles">
                <SettingsSwitch active={settings.animatedBackdrop} label="Animated backdrop" note="Subtle CSS shimmer behind the table." onClick={() => onUpdateSettings({ animatedBackdrop: !settings.animatedBackdrop })} />
                <SettingsSwitch active={settings.reducedMotion} label="Reduced motion" note="Shortens combat feedback and disables backdrop animation." onClick={() => onUpdateSettings({ reducedMotion: !settings.reducedMotion })} />
                <SettingsSwitch active={settings.compactCards} label="Compact cards" note="Condenses card presentation during combat." onClick={() => onUpdateSettings({ compactCards: !settings.compactCards })} />
                <SettingsSwitch active={settings.showSourceHints} label="Source hints" note="Keep fact/source cues visible when supported by the panel." onClick={() => onUpdateSettings({ showSourceHints: !settings.showSourceHints })} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsSwitch({ active, label, note, onClick }: { active: boolean; label: string; note: string; onClick: () => void }) {
  return <button className={`settings-switch ${active ? 'is-active' : ''}`} onClick={onClick}><span><strong>{label}</strong><small>{note}</small></span><i>{active ? 'On' : 'Off'}</i></button>;
}

function CommandDock({ artifactCount, characterName, combat, deckCount, nodeCount, phase, primaryDisabled, run, savedSnapshot, settings, showTutorial, onEventChoice, onLoad, onOpenWindow, onPrimaryAction, onReset, onSave, onSettings, onSwitchCharacter, onUpdateSettings }: {
  artifactCount: number;
  characterName: string;
  combat: ReturnType<typeof createInitialRunState>['combat'];
  deckCount: number;
  nodeCount: string;
  phase: string;
  primaryDisabled: boolean;
  run: ReturnType<typeof createInitialRunState>;
  savedSnapshot: string | null;
  settings: typeof DEFAULT_SETTINGS;
  showTutorial: boolean;
  onEventChoice: (choiceId: string) => void;
  onLoad: () => void;
  onOpenWindow: (window: Exclude<GameWindow, null>) => void;
  onPrimaryAction: () => void;
  onReset: () => void;
  onSave: () => void;
  onSettings: () => void;
  onSwitchCharacter: (characterId: string) => void;
  onUpdateSettings: (updates: Partial<typeof DEFAULT_SETTINGS>) => void;
}) {
  const energy = combat?.energy ?? 3;
  const maxEnergy = combat?.maxEnergy ?? 3;
  const primaryLabel = combat?.phase === 'won' ? 'Choose Reward' : phase === 'rest' ? 'Rest and Upgrade' : phase === 'event' ? 'Continue' : 'End Turn';
  const quickEventChoice = EVENT_CHOICES[0];

  return (
    <aside className="z-20 flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-black/36 p-1.5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_22px_70px_rgba(0,0,0,0.30)]">
      <div className="rounded-[16px] bg-black/34 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/12 bg-white/[0.07] text-white/82"><BookOpen className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl font-black tracking-tight text-white">Roguepedia</h1>
            <p className="truncate text-[10px] font-semibold text-white/46">{characterName}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-[12px] border border-white/8 bg-black/24 px-3 py-2">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/42">{showTutorial ? 'Hint active' : 'Run phase'}</span>
          <span className="truncate font-serif text-sm font-black text-white">{phase}</span>
        </div>
      </div>
      <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 py-3">
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-[16px] border border-white/10 bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <HeaderStat label="Act" value="1" />
          <HeaderStat label="Node" value={nodeCount} />
          <HeaderStat label="Deck" value={String(deckCount)} />
          <HeaderStat label="Relics" value={String(artifactCount)} />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-[16px] border border-white/10 bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <HeaderButton icon={<Save className="h-3.5 w-3.5" />} label="Save" onClick={onSave} />
          <HeaderButton disabled={!savedSnapshot} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load" onClick={onLoad} />
          <HeaderButton icon={<ChevronRight className="h-3.5 w-3.5" />} label="Reset" onClick={onReset} />
          <HeaderButton icon={<Settings className="h-3.5 w-3.5" />} label="Settings" onClick={onSettings} />
        </div>
        <PartySwitchPanel run={run} onSwitchCharacter={onSwitchCharacter} />
        <div className="mb-3 rounded-[16px] border border-white/10 bg-black/24 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center gap-2 px-1"><Settings className="h-3.5 w-3.5 text-white/46" /><span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Options</span></div>
          <OptionToggle active={settings.showTutorial} label="Tutorial" onClick={() => onUpdateSettings({ showTutorial: !settings.showTutorial })} />
          <OptionToggle active={settings.compactCards} label="Compact cards" onClick={() => onUpdateSettings({ compactCards: !settings.compactCards })} />
          <OptionToggle active={settings.autoEndTurnOnEnergyEmpty} label="Auto end" onClick={() => onUpdateSettings({ autoEndTurnOnEnergyEmpty: !settings.autoEndTurnOnEnergyEmpty })} />
        </div>
        <div className="overflow-hidden rounded-[16px] border border-white/10 bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <DockButton icon={<MapIcon className="h-4 w-4" />} label="Map" meta={`${run.completedNodeIds.length}/${run.map.length}`} onClick={() => onOpenWindow('map')} />
          <DockButton icon={<Archive className="h-4 w-4" />} label="Inventory" meta={`${run.artifacts.length} relics`} onClick={() => onOpenWindow('inventory')} />
          <DockButton icon={<Library className="h-4 w-4" />} label="Deck Lab" meta={`${run.deck.length} cards`} onClick={() => onOpenWindow('deck')} />
          <DockButton icon={<Sparkles className="h-4 w-4" />} label="Synergy" meta={`${run.activeSynergies.length} active`} onClick={() => onOpenWindow('synergies')} />
          <DockButton icon={<BookOpen className="h-4 w-4" />} label="Lore" meta={activeCharacter(run).name} onClick={() => onOpenWindow('lore')} />
          <DockButton icon={<Library className="h-4 w-4" />} label="Gallery" meta={`${run.reserveRoster.length + run.party.length} seen`} onClick={() => onOpenWindow('gallery')} />
          <DockButton icon={<Feather className="h-4 w-4" />} label="Log" meta={`${combat?.log.length ?? run.summary.length} notes`} onClick={() => onOpenWindow('log')} />
          <DockButton icon={<Settings className="h-4 w-4" />} label="Commands" meta={run.phase === 'event' ? 'event' : `${energy}/${maxEnergy} energy`} onClick={() => onOpenWindow('commands')} />
        </div>
        {run.phase === 'event' && quickEventChoice ? <button className="mt-3 w-full border border-white/12 bg-white/[0.055] px-3 py-3.5 text-left text-sm font-semibold text-white/78 transition hover:bg-white/10" onClick={() => onEventChoice(quickEventChoice.id)}>{quickEventChoice.title}</button> : null}
      </div>
      <div className="rounded-[16px] bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <EnergyMeter energy={energy} maxEnergy={maxEnergy} />
        <button className="mt-3 w-full bg-white px-5 py-3.5 font-serif text-lg font-black text-black transition hover:bg-white/88 active:bg-white/75 disabled:bg-white/20 disabled:text-white/35" disabled={primaryDisabled} onClick={onPrimaryAction}>{primaryLabel}</button>
      </div>
    </aside>
  );
}

function DockButton({ icon, label, meta, onClick }: { icon: ReactNode; label: string; meta: string; onClick: () => void }) {
  return <button className="group grid w-full grid-cols-[34px_1fr] items-center gap-3 rounded-[10px] px-3 py-3 text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-white/[0.09] active:scale-[0.98] active:bg-white/[0.13]" onClick={onClick}><span className="grid h-8 w-8 place-items-center rounded-[8px] bg-white/[0.07] text-white/76 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">{icon}</span><span className="min-w-0"><span className="block text-sm font-semibold leading-tight text-white">{label}</span><span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.13em] text-white/48">{meta}</span></span></button>;
}

function PartySwitchPanel({ run, onSwitchCharacter }: { run: ReturnType<typeof createInitialRunState>; onSwitchCharacter: (characterId: string) => void }) {
  const activeId = activeCharacter(run).id;

  return (
    <div className="mb-3 rounded-[16px] border border-white/10 bg-black/24 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Party</span>
        <span className="font-mono text-[9px] font-black text-white/42">{run.party.length}/{MAX_PARTY_SIZE}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {run.party.map((character) => {
          const progress = progressForCharacter(run, character.id);
          const active = character.id === activeId;
          return (
            <button
              className={`grid grid-cols-[28px_1fr] items-center gap-2 rounded-[10px] border p-1.5 text-left transition ${active ? 'border-white/34 bg-white/[0.13] shadow-[0_0_18px_rgba(255,255,255,0.10)]' : 'border-white/8 bg-black/20 hover:bg-white/[0.08]'}`}
              disabled={active}
              key={character.id}
              onClick={() => onSwitchCharacter(character.id)}
              type="button"
            >
              <span className={`grid h-7 w-7 place-items-center rounded-[8px] border font-serif text-xs font-black ${rarityTone(character.rarity)}`}>{character.rarity}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-white">{character.name}</span>
                <span className="block font-mono text-[8px] uppercase tracking-[0.12em] text-white/42">Lv {progress.level} · HP {effectiveStats(character, progress).hp}</span>
              </span>
            </button>
          );
        })}
      </div>
      {run.party.length <= 1 ? <p className="mt-2 px-1 text-[10px] font-semibold text-white/38">Recruit more heroes to switch like PokéRogue.</p> : null}
      {run.combat ? <p className="mt-2 px-1 text-[10px] font-semibold text-amber-100/48">Switch affects the next battle, not the current combat.</p> : null}
    </div>
  );
}

function OptionToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`mb-1 grid w-full grid-cols-[1fr_auto] items-center rounded-[10px] border px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] transition last:mb-0 ${active ? 'border-white/22 bg-white/[0.11] text-white' : 'border-white/8 bg-black/20 text-white/42 hover:text-white/70'}`} onClick={onClick} type="button"><span>{label}</span><span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-200 shadow-[0_0_12px_rgba(167,243,208,0.55)]' : 'bg-white/18'}`}></span></button>;
}

function EnergyMeter({ energy, maxEnergy }: { energy: number; maxEnergy: number }) {
  return <div className="flex items-center gap-1.5 px-1">{Array.from({ length: maxEnergy }).map((_, index) => <div key={index} className={`h-8 w-3 border border-white/20 ${index < energy ? 'bg-white/80 shadow-[0_0_16px_rgba(255,255,255,0.28)]' : 'bg-white/10'}`}></div>)}<span className="ml-1 font-mono text-xs font-black text-white">{energy}/{maxEnergy}</span></div>;
}

function WindowButton({ icon, label, meta, onClick }: { icon: ReactNode; label: string; meta: string; onClick: () => void }) {
  return <button className="grid w-full grid-cols-[24px_1fr] items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[0.09] active:bg-white/[0.12]" onClick={onClick}>{icon}<span className="min-w-0"><span className="block text-xs font-semibold text-white">{label}</span><span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/42">{meta}</span></span></button>;
}

function GameWindowOverlay({ activeWindow, character, combat, intelEnemy, roster, run, selectedDeckPresetId, selectedStarterId, onArtifact, onChooseDeck, onChooseNode, onClose, onEquipSkill, onEventChoice, onPrimaryAction, onRetire, onScan, onUnequipSkill }: {
  activeWindow: GameWindow;
  character: typeof runtimeRoster[number];
  combat: ReturnType<typeof createInitialRunState>['combat'];
  intelEnemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] | undefined;
  roster: typeof runtimeRoster;
  run: ReturnType<typeof createInitialRunState>;
  selectedDeckPresetId: string;
  selectedStarterId: string;
  onArtifact: () => void;
  onChooseDeck: (characterId: string, presetId: string) => void;
  onChooseNode: (nodeId: string) => void;
  onClose: () => void;
  onEquipSkill: (cardId: string) => void;
  onEventChoice: (choiceId: string) => void;
  onPrimaryAction: () => void;
  onRetire: () => void;
  onScan: () => void;
  onUnequipSkill: (cardId: string) => void;
}) {
  if (!activeWindow) {
    return null;
  }

  const title = windowTitle(activeWindow);
  const compactWindow = activeWindow === 'player' || activeWindow === 'lore';

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-md">
      <div className={`flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[22px] border border-white/16 bg-black/58 text-white shadow-[0_28px_90px_rgba(0,0,0,0.46)] ${compactWindow ? 'max-w-4xl' : 'max-w-7xl'}`}>
        <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 bg-white/[0.035] px-4 py-3">
          <div className="min-w-0">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/42">Workspace</span>
            <h2 className="truncate font-serif text-2xl font-black">{title}</h2>
          </div>
          <button className="border border-white/16 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12" onClick={onClose}>Close</button>
        </div>
        <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {activeWindow === 'map' ? <MapWindow run={run} onChooseNode={onChooseNode} onRetire={onRetire} /> : null}
          {activeWindow === 'commands' ? <CommandsWindow combat={combat} phase={combat?.phase ?? run.phase} run={run} onEventChoice={onEventChoice} onPrimaryAction={onPrimaryAction} /> : null}
          {activeWindow === 'log' ? <LogWindow combat={combat} run={run} /> : null}
          {activeWindow === 'player' ? <PlayerIntelWindow character={character} player={combat?.player} progress={progressForCharacter(run, character.id)} /> : null}
          {activeWindow === 'enemy' && intelEnemy ? <EnemyIntelWindow enemy={intelEnemy} intent={combat?.enemyIntent[intelEnemy.id] ?? 7} /> : null}
          {activeWindow === 'inventory' ? <InventoryWindow run={run} onArtifact={onArtifact} /> : null}
          {activeWindow === 'deck' ? <DeckLabWindow roster={roster} run={run} onEquipSkill={onEquipSkill} onUnequipSkill={onUnequipSkill} /> : null}
          {activeWindow === 'synergies' ? <SynergyWindow run={run} onScan={onScan} /> : null}
          {activeWindow === 'lore' ? <div className="mx-auto w-full max-w-3xl"><CharacterSheet character={character} compact progress={progressForCharacter(run, character.id)} /></div> : null}
          {activeWindow === 'gallery' ? <GalleryPanel roster={roster} run={run} selectedDeckPresetId={selectedDeckPresetId} selectedStarterId={selectedStarterId} onChooseDeck={onChooseDeck} /> : null}
        </div>
      </div>
    </div>
  );
}

function windowTitle(activeWindow: Exclude<GameWindow, null>): string {
  const titles: Record<Exclude<GameWindow, null>, string> = {
    map: 'Route Map',
    commands: 'Command Console',
    log: 'Battle Log',
    player: 'Hero Intel',
    enemy: 'Enemy Intel',
    inventory: 'Inventory',
    deck: 'Deck Lab',
    synergies: 'Synergies',
    lore: 'Character Lore',
    gallery: 'Wiki Gallery',
  };
  return titles[activeWindow];
}

function MapWindow({ run, onChooseNode, onRetire }: { run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void; onRetire: () => void }) {
  return (
    <div className="grid min-h-[68vh] grid-cols-[minmax(0,1fr)_280px] gap-4">
      <div className="min-h-0 border border-white/12 bg-white/[0.035]">
        <MapPanel run={run} onChooseNode={onChooseNode} onRetire={onRetire} />
      </div>
      <Panel title="Route Brief">
        <div className="space-y-3 text-sm text-white/62">
          <p>Choose an available glowing node to push deeper through Act {run.act}. Bosses open the next endless act instead of ending the run.</p>
          <div className="border border-white/10">{run.map.flat().map((node) => <NodeRow key={node.id} node={node} run={run} onChooseNode={onChooseNode} />)}</div>
        </div>
      </Panel>
    </div>
  );
}

function NodeRow({ node, run, onChooseNode }: { node: ReturnType<typeof createInitialRunState>['map'][number][number]; run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void }) {
  const completed = run.completedNodeIds.includes(node.id);
  const available = run.phase === 'map' && isNodeAvailable(run, node);
  return <button className="grid w-full grid-cols-[32px_1fr_76px] items-center gap-2 border-b border-white/10 bg-white/[0.04] px-2 py-2 text-left last:border-b-0 disabled:opacity-45 enabled:hover:bg-white/[0.09]" disabled={!available} onClick={() => onChooseNode(node.id)}><span className="text-white/70">{nodeIcons[node.type]}</span><strong className="truncate text-sm text-white">{node.title}</strong><span className="font-mono text-[8px] uppercase tracking-widest text-white/45">{completed ? 'cleared' : available ? 'open' : 'locked'}</span></button>;
}

function CommandsWindow({ combat, phase, run, onEventChoice, onPrimaryAction }: {
  combat: ReturnType<typeof createInitialRunState>['combat'];
  phase: string;
  run: ReturnType<typeof createInitialRunState>;
  onEventChoice: (choiceId: string) => void;
  onPrimaryAction: () => void;
}) {
  const energy = combat?.energy ?? 3;
  const maxEnergy = combat?.maxEnergy ?? 3;
  const primaryLabel = combat?.phase === 'won' ? 'Choose Reward' : phase === 'rest' ? 'Rest and Upgrade' : phase === 'event' ? 'Continue' : 'End Turn';
  const primaryDisabled = run.phase === 'map' || (Boolean(combat) && combat?.phase !== 'player' && combat?.phase !== 'won');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
      <Panel title="Action Queue">
        <div className="border border-white/10">
          {run.phase === 'event' ? EVENT_CHOICES.map((choice) => <button className="grid w-full grid-cols-[1fr_90px] items-center border-b border-white/10 bg-white/[0.04] p-3 text-left transition last:border-b-0 hover:bg-white/[0.09]" key={choice.id} onClick={() => onEventChoice(choice.id)}><span><strong className="block text-sm text-white">{choice.title}</strong><span className="text-xs text-white/50">Resolve this archive event.</span></span><span className="font-mono text-[9px] uppercase tracking-widest text-white/45">{choice.effect}</span></button>) : <p className="p-3 text-sm text-white/58">No event choices are waiting. Use the primary action to advance the current phase.</p>}
        </div>
      </Panel>
      <Panel title="Primary Control">
        <div className="space-y-4">
          <div className="flex items-center justify-between border border-white/10 bg-white/[0.04] p-3"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Energy</span><EnergyMeter energy={energy} maxEnergy={maxEnergy} /></div>
          <button className="w-full bg-white px-5 py-4 font-serif text-xl font-black text-black transition hover:bg-white/88 active:bg-white/75 disabled:bg-white/20 disabled:text-white/35" disabled={primaryDisabled} onClick={onPrimaryAction}>{primaryLabel}</button>
        </div>
      </Panel>
    </div>
  );
}

function LogWindow({ combat, run }: { combat: ReturnType<typeof createInitialRunState>['combat']; run: ReturnType<typeof createInitialRunState> }) {
  const logs = combat?.log.map((entry) => entry.text) ?? run.summary;
  return <Panel title="Recent Run Notes"><div className="border border-white/10">{(logs.length ? logs : ['Choose a glowing map node to begin.']).map((entry, index) => <div className="grid grid-cols-[36px_1fr] gap-3 border-b border-white/10 bg-white/[0.04] p-3 text-sm text-white/68 last:border-b-0" key={`${entry}-${index}`}><span className="font-mono text-[10px] text-white/38 tabular-nums">{String(index + 1).padStart(2, '0')}</span><span>{entry}</span></div>)}</div></Panel>;
}

function PlayerIntelWindow({ character, player, progress }: { character: typeof runtimeRoster[number]; player: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['player'] | undefined; progress: CharacterProgress }) {
  return (
    <div className="grid min-h-0 grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)] gap-4">
      <PlayerIntelCard character={character} player={player} progress={progress} />
      <Panel title={`Cards (${character.cards.length})`}>
        <div className="glass-scrollbar max-h-[62vh] overflow-y-auto border border-white/10">{character.cards.map((card) => <CardSummary card={card} key={card.id} />)}</div>
      </Panel>
    </div>
  );
}

function EnemyIntelWindow({ enemy, intent }: { enemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number]; intent: number }) {
  return <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4"><EnemyIntelCard enemy={enemy} intent={intent} /><Panel title="Enemy Read"><p className="text-sm leading-relaxed text-white/62">This enemy is currently selected as the combat target. Play attack or status cards while enough energy remains, then end the turn from the dock or command window.</p></Panel></div>;
}

function InventoryWindow({ run, onArtifact }: { run: ReturnType<typeof createInitialRunState>; onArtifact: () => void }) {
  const visibleArtifacts = run.artifacts.length ? run.artifacts : ARTIFACTS.slice(0, 6);
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4">
      <Panel title={`Artifacts (${run.artifacts.length})`} action={run.artifacts.length >= 1 ? undefined : onArtifact} actionLabel="Take">
        <div className="border border-white/10">{visibleArtifacts.map((artifact, index) => <ArtifactDetail artifact={artifact} acquired={run.artifacts.some((owned) => owned.id === artifact.id)} key={`${artifact.id}-${index}`} />)}</div>
      </Panel>
      <Panel title={`Deck (${run.deck.length})`}>
        <div className="border border-white/10">{run.deck.map((card) => <CardSummary card={card} key={`${card.id}-${card.name}-${card.upgraded}`} />)}</div>
      </Panel>
    </div>
  );
}

function DeckLabWindow({ roster, run, onEquipSkill, onUnequipSkill }: { roster: typeof runtimeRoster; run: ReturnType<typeof createInitialRunState>; onEquipSkill: (cardId: string) => void; onUnequipSkill: (cardId: string) => void }) {
  const collection = run.skillCollection ?? run.deck;
  const skillCodex = useMemo(() => collectSkillCodex(roster, collection, globalSkillCodex, run.deck), [collection, roster, run.deck]);
  const [selectedCardId, setSelectedCardId] = useState(skillCodex[0]?.card.id ?? '');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'locked'>('all');
  const cardsByType = useMemo(() => {
    const groups: Record<string, SkillCodexEntry[]> = {};
    for (const entry of skillCodex) {
      (groups[entry.card.card_type] ??= []).push(entry);
    }
    return groups;
  }, [skillCodex]);
  const duplicateCount = useMemo(() => run.deck.length - new Set(run.deck.map((card) => card.name)).size, [run.deck]);
  const equippedIds = useMemo(() => new Set(run.deck.map((card) => card.id)), [run.deck]);
  const lockedCount = useMemo(() => skillCodex.filter((entry) => !entry.owned).length, [skillCodex]);
  const canEquipMore = run.deck.length < MAX_DECK_SIZE;
  const canUnequipMore = run.deck.length > MIN_DECK_SIZE;
  const visibleCards = useMemo(() => skillCodex
    .filter((entry) => typeFilter === 'all' || entry.card.card_type === typeFilter)
    .filter((entry) => ownershipFilter === 'all' || (ownershipFilter === 'owned' ? entry.owned : !entry.owned)), [ownershipFilter, skillCodex, typeFilter]);
  const selectedEntry = useMemo(() => skillCodex.find((entry) => entry.card.id === selectedCardId) ?? visibleCards[0] ?? skillCodex[0], [selectedCardId, skillCodex, visibleCards]);
  const selectCard = useCallback((cardId: string) => setSelectedCardId(cardId), []);

  return (
    <div className="grid min-h-[68vh] grid-cols-[260px_minmax(0,1fr)_320px] gap-4">
      <Panel title="Deck Stats">
        <div className="space-y-3 text-sm text-white/62">
          <div className="grid grid-cols-2 gap-2">
            <HeaderStat label="Equipped" value={`${run.deck.length}/${MAX_DECK_SIZE}`} />
            <HeaderStat label="Minimum" value={String(MIN_DECK_SIZE)} />
            <HeaderStat label="Copies" value={String(duplicateCount)} />
            <HeaderStat label="Locked" value={String(lockedCount)} />
          </div>
          <p className="leading-relaxed">Equip {MIN_DECK_SIZE}-{MAX_DECK_SIZE} skills. You can tune the active deck before the next battle, while locked skills remain global codex previews.</p>
          <div className="grid grid-cols-3 gap-1 rounded-[12px] border border-white/10 bg-black/24 p-1">
            {(['all', 'owned', 'locked'] as const).map((filter) => <button className={`rounded-[8px] px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.12em] transition ${ownershipFilter === filter ? 'bg-white/14 text-white' : 'text-white/48 hover:bg-white/[0.07] hover:text-white'}`} key={filter} onClick={() => setOwnershipFilter(filter)} type="button">{filter}</button>)}
          </div>
          <div className="space-y-1 rounded-[12px] border border-white/10 bg-black/24 p-2">
            <button className={`flex w-full items-center justify-between rounded-[8px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${typeFilter === 'all' ? 'bg-white/14 text-white' : 'text-white/48 hover:bg-white/[0.07] hover:text-white'}`} onClick={() => setTypeFilter('all')} type="button"><span>all</span><span>{skillCodex.length}</span></button>
            {Object.entries(cardsByType).map(([type, entries]) => <button className={`flex w-full items-center justify-between rounded-[8px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${typeFilter === type ? 'bg-white/14 text-white' : 'text-white/48 hover:bg-white/[0.07] hover:text-white'}`} key={type} onClick={() => setTypeFilter(type)} type="button"><span>{type}</span><span>{entries.length}</span></button>)}
          </div>
        </div>
      </Panel>
      <Panel title={`Skill Codex (${visibleCards.length})`}>
        <div className="glass-scrollbar grid max-h-[62vh] grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 overflow-y-auto pr-1">
          {visibleCards.map((entry) => <SkillCodexCardButton entry={entry} key={entry.card.id} selected={selectedEntry?.card.id === entry.card.id} onSelect={selectCard} />)}
        </div>
      </Panel>
      {selectedEntry ? <SkillInspectPanel card={selectedEntry.card} copies={run.deck.filter((card) => card.name === selectedEntry.card.name).length} equipped={equippedIds.has(selectedEntry.card.id)} canEquip={canEquipMore} canUnequip={canUnequipMore} owned={selectedEntry.owned} source={selectedEntry.source} onEquip={() => onEquipSkill(selectedEntry.card.id)} onUnequip={() => onUnequipSkill(selectedEntry.card.id)} /> : null}
    </div>
  );
}

 type SkillCodexEntry = {
  card: RuntimeCard;
  owned: boolean;
  source: string;
};

const SkillCodexCardButton = memo(function SkillCodexCardButton({ entry, selected, onSelect }: { entry: SkillCodexEntry; selected: boolean; onSelect: (cardId: string) => void }) {
  const handleSelect = useCallback(() => onSelect(entry.card.id), [entry.card.id, onSelect]);

  return (
    <button className={`relative overflow-hidden rounded-[14px] border text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] ${selected ? 'border-white/35 bg-white/[0.10]' : 'border-white/10 bg-black/18'} ${entry.owned ? 'shadow-[0_0_22px_rgba(255,255,255,0.08)]' : 'opacity-58 grayscale'}`} onClick={handleSelect} type="button">
      <CardSummary card={entry.card} />
      {entry.owned ? null : <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45"><div className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/52 text-white/66 shadow-[0_0_24px_rgba(0,0,0,0.45)]"><Lock className="h-5 w-5" /></div></div>}
    </button>
  );
});

function collectSkillCodex(roster: typeof runtimeRoster, collection: RuntimeCard[], fullPool: RuntimeCard[], deck: RuntimeCard[]): SkillCodexEntry[] {
  const byName = new Map<string, SkillCodexEntry>();
  const ownedNames = new Set(collection.map((card) => card.name));

  for (const card of fullPool) {
    byName.set(card.name, { card, owned: ownedNames.has(card.name), source: 'Global skill pool' });
  }
  for (const card of collection) {
    byName.set(card.name, { card, owned: true, source: deck.some((deckCard) => deckCard.id === card.id) ? 'Equipped deck' : 'Owned collection' });
  }
  for (const character of roster) {
    for (const preset of deckPresetsForCharacter(character)) {
      for (const card of preset.cards) {
        if (!byName.has(card.name)) {
          byName.set(card.name, { card, owned: ownedNames.has(card.name), source: `${character.name} · ${preset.name}` });
        }
      }
    }
  }
  return [...byName.values()].sort((first, second) => Number(second.owned) - Number(first.owned) || first.card.card_type.localeCompare(second.card.card_type) || first.card.name.localeCompare(second.card.name));
}

function SkillInspectPanel({ card, copies, equipped, canEquip, canUnequip, owned, source, onEquip, onUnequip }: { card: RuntimeCard; copies: number; equipped: boolean; canEquip: boolean; canUnequip: boolean; owned: boolean; source: string; onEquip: () => void; onUnequip: () => void }) {
  const theme = cardTypeTheme(card.card_type);
  const actionDisabled = !owned || (equipped ? !canUnequip : !canEquip);
  const actionLabel = !owned ? 'Locked Skill' : equipped ? canUnequip ? 'Unequip from Deck' : `Minimum ${MIN_DECK_SIZE} Required` : canEquip ? 'Equip to Deck' : `Maximum ${MAX_DECK_SIZE} Reached`;
  return <Panel title="Skill Inspect">
    <div className="space-y-3 text-white">
      <div className={`rounded-[16px] border ${theme.border} bg-gradient-to-br ${theme.wash} p-3 ${theme.glow}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-2xl font-black leading-tight">{card.name}</h3>
            <p className={`mt-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] ${theme.text}`}>{theme.label} · {card.card_rarity} · {copies} owned</p>
          </div>
          <span className={`grid h-10 w-10 place-items-center rounded-full border ${theme.border} ${theme.badge} font-mono text-lg font-black ${theme.text}`}>{card.energy_cost}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] ${owned ? 'border-emerald-200/30 bg-emerald-400/18 text-emerald-100' : 'border-white/12 bg-black/34 text-white/55'}`}>{owned ? 'Owned' : 'Not collected'}</span>
          <span className="rounded-full border border-white/12 bg-black/24 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-white/45">{source}</span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-white/70">{card.description || card.mechanics_text}</p>
        <button className={`mt-3 w-full rounded-[12px] border px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] transition ${actionDisabled ? 'cursor-not-allowed border-white/10 bg-black/28 text-white/32' : equipped ? 'border-amber-200/30 bg-amber-400/16 text-amber-100 hover:bg-amber-400/24' : 'border-emerald-200/30 bg-emerald-400/16 text-emerald-100 hover:bg-emerald-400/24'}`} disabled={actionDisabled} onClick={equipped ? onUnequip : onEquip} type="button">{actionLabel}</button>
      </div>
      <div className="rounded-[14px] border border-white/10 bg-black/24 p-3">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Mechanics text</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white/72">{card.mechanics_text}</p>
      </div>
      <div className="space-y-2">
        {card.mechanics.map((mechanic, index) => <div className="rounded-[12px] border border-white/10 bg-white/[0.045] p-2" key={`${mechanic.kind}-${index}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/72">{mechanic.kind.replace('_', ' ')}</span><span className="rounded-full bg-black/28 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/42">{mechanic.target}</span></div>
          <p className="mt-1 text-xs font-semibold text-white/55">{mechanicDetail(mechanic)}</p>
        </div>)}
      </div>
    </div>
  </Panel>;
}

function mechanicDetail(mechanic: RuntimeCard['mechanics'][number]): string {
  const parts = [];
  if (mechanic.amount) {
    parts.push(`base ${mechanic.amount.base}`);
    if (mechanic.amount.scaling_stat !== 'none') {
      parts.push(`scales with ${mechanic.amount.scaling_stat}`);
    }
  }
  if (mechanic.status) {
    parts.push(`status ${mechanic.status}`);
  }
  if (mechanic.duration) {
    parts.push(`${mechanic.duration} turn(s)`);
  }
  if (mechanic.condition) {
    parts.push(`condition ${mechanic.condition}`);
  }
  return parts.length ? parts.join(' · ') : 'No numeric modifier.';
}

function SynergyWindow({ run, onScan }: { run: ReturnType<typeof createInitialRunState>; onScan: () => void }) {
  return (
    <Panel title="Active Synergies" action={onScan} actionLabel="Scan">
      <div className="border border-white/10">{run.activeSynergies.length ? run.activeSynergies.map((synergy) => <SynergyItem key={synergy.archetype} title={synergy.archetype} body={synergy.description} />) : <p className="p-3 text-sm font-bold text-white/55">No active synergy yet. Recruit heroes or collect artifacts to activate one.</p>}</div>
    </Panel>
  );
}

function CombatControlPanel({ energy, logs, maxEnergy, onPrimaryAction, primaryDisabled, primaryLabel }: {
  energy: number;
  logs: string[];
  maxEnergy: number;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  primaryLabel: string;
}) {
  return (
    <div className="border-t border-white/10 bg-black/35 p-4 backdrop-blur-xl">
      <div className="border border-white/15 bg-white/[0.06] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Battle Log</span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxEnergy }).map((_, index) => <div key={index} className={`h-5 w-3 border border-white/20 ${index < energy ? 'bg-white/80 shadow-[0_0_16px_rgba(255,255,255,0.28)]' : 'bg-white/10'}`}></div>)}
            <span className="border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-xs font-black text-white">{energy}/{maxEnergy}</span>
          </div>
        </div>
        <div className="mt-3 flex min-h-[72px] flex-col gap-1 text-xs leading-relaxed text-white/70">
          {logs.map((entry, index) => <div className="flex items-start gap-1.5" key={`${entry}-${index}`}><ChevronRight className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-white/45" /><span className="line-clamp-2">{entry}</span></div>)}
        </div>
        <button className="glass-button mt-3 flex h-11 w-full items-center justify-center gap-2 font-serif text-lg font-black text-white transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-40" disabled={primaryDisabled} onClick={onPrimaryAction}>{primaryLabel} <ChevronRight className="w-5 h-5" /></button>
      </div>
    </div>
  );
}

function Tab({ active, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`relative flex flex-1 flex-col items-center justify-center gap-1 border-r border-white/10 transition ${active ? 'bg-white/12 text-white' : 'bg-black/25 text-white/55 hover:bg-white/10 hover:text-white'}`} onClick={onClick}>{icon}<span className="text-xs font-black">{label}</span></button>;
}

function Panel({ title, children, action, actionLabel }: { title: string; children: ReactNode; action?: () => void; actionLabel?: string }) {
  return <section className="flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"><div className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 bg-black/18 px-3 py-2"><h3 className="truncate font-serif text-base font-black text-white">{title}</h3>{action ? <button className="border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12" onClick={action}>{actionLabel}</button> : null}</div><div className="min-h-0 p-3">{children}</div></section>;
}

function InfoCard({ title, icon, body }: { title: string; icon: ReactNode; body: string }) {
  return <section className="border border-white/12 bg-white/[0.035]"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">{icon}<h3 className="font-serif text-base font-black text-white">{title}</h3></div><div className="p-3"><p className="text-sm leading-relaxed text-white/60">{body}</p><div className="mt-4 flex items-center justify-between text-white/45"><span className="font-mono text-xs">1 / 7</span><div className="flex gap-1"><button className="border border-white/12 bg-white/[0.05] p-1 opacity-30"><ChevronLeft className="w-4 h-4" /></button><button className="border border-white/12 bg-white/[0.05] p-1"><ChevronRight className="w-4 h-4" /></button></div></div></div></section>;
}

type GallerySortMode = 'rarity-desc' | 'rarity-asc' | 'name' | 'hp' | 'attack' | 'intelligence' | 'level';

type GalleryStatusFilter = 'all' | 'party' | 'reserve' | 'seen';

function GalleryPanel({ roster, run, selectedDeckPresetId, selectedStarterId, onChooseDeck }: { roster: typeof runtimeRoster; run: ReturnType<typeof createInitialRunState>; selectedDeckPresetId: string; selectedStarterId: string; onChooseDeck: (characterId: string, presetId: string) => void }) {
  const [selectedId, setSelectedId] = useState(selectedStarterId || roster[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<GallerySortMode>('rarity-desc');
  const [rarityFilter, setRarityFilter] = useState<CharacterRarity | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<GalleryStatusFilter>('all');
  const partyIds = new Set(run.party.map((character) => character.id));
  const reserveIds = new Set(run.reserveRoster.map((character) => character.id));
  const availableTags = [...new Set(roster.flatMap((character) => character.tags))].sort((a, b) => a.localeCompare(b));
  const visibleRoster = [...roster]
    .filter((character) => matchesGallerySearch(character, searchTerm))
    .filter((character) => rarityFilter === 'all' || character.rarity === rarityFilter)
    .filter((character) => tagFilter === 'all' || character.tags.includes(tagFilter))
    .filter((character) => statusFilter === 'all' || galleryCharacterStatusKey(character, partyIds, reserveIds) === statusFilter)
    .sort((a, b) => compareGalleryCharacters(a, b, sortMode, run.characterProgress));
  const selected = roster.find((character) => character.id === selectedId) ?? visibleRoster[0] ?? roster[0];
  const selectedPresets = selected ? deckPresetsForCharacter(selected) : [];
  const activePresetId = selected?.id === selectedStarterId ? selectedDeckPresetId : selectedPresets[0]?.id;
  const hasActiveFilters = searchTerm.trim() || rarityFilter !== 'all' || tagFilter !== 'all' || statusFilter !== 'all' || sortMode !== 'rarity-desc';
  const resetGalleryControls = () => {
    setSearchTerm('');
    setSortMode('rarity-desc');
    setRarityFilter('all');
    setTagFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-4">
      <Panel title={`Gallery (${roster.length})`}>
        <div className="mb-3 space-y-3 rounded-[18px] border border-white/10 bg-black/18 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
          <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_170px_150px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input className="w-full rounded-[12px] border border-white/10 bg-black/28 py-2 pl-9 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-white/25 focus:bg-white/[0.07]" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, lore, type..." />
            </label>
            <select className="rounded-[12px] border border-white/10 bg-black/36 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/72 outline-none focus:border-white/25" value={sortMode} onChange={(event) => setSortMode(event.target.value as GallerySortMode)}>
              <option value="rarity-desc">Rarity S → D</option>
              <option value="rarity-asc">Rarity D → S</option>
              <option value="name">Name A → Z</option>
              <option value="hp">HP</option>
              <option value="attack">Attack</option>
              <option value="intelligence">Intelligence</option>
              <option value="level">Level</option>
            </select>
            <select className="rounded-[12px] border border-white/10 bg-black/36 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/72 outline-none focus:border-white/25" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">All types</option>
              {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={`rounded-[10px] border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${rarityFilter === 'all' ? 'border-white/28 bg-white/14 text-white' : 'border-white/10 bg-black/24 text-white/48 hover:text-white'}`} onClick={() => setRarityFilter('all')} type="button">All</button>
            {(['S', 'A', 'B', 'C', 'D'] as CharacterRarity[]).map((rarity) => <button className={`rounded-[10px] transition ${rarityFilter === rarity ? 'scale-105 ring-1 ring-white/35' : 'opacity-72 hover:opacity-100'}`} key={rarity} onClick={() => setRarityFilter(rarity)} type="button"><RarityBadge rarity={rarity} /></button>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['party', 'Party'],
                ['reserve', 'Recruitable'],
                ['seen', 'Seen'],
              ] as const).map(([value, label]) => <button className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] transition ${statusFilter === value ? 'border-white/28 bg-white/14 text-white' : 'border-white/10 bg-black/24 text-white/48 hover:text-white'}`} key={value} onClick={() => setStatusFilter(value)} type="button">{label}</button>)}
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              <span>Showing {visibleRoster.length} / {roster.length}</span>
              {hasActiveFilters ? <button className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-white/65 transition hover:border-white/24 hover:text-white" onClick={resetGalleryControls} type="button">Reset</button> : null}
            </div>
          </div>
        </div>
        <div className="glass-scrollbar max-h-[58vh] overflow-y-auto pr-1">
          {visibleRoster.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-3">
              {visibleRoster.map((character, index) => {
                const status = galleryCharacterStatusLabel(character, partyIds, reserveIds);
                return <GalleryCharacterCard character={character} eager={index < 6} key={character.id} onSelect={() => setSelectedId(character.id)} selected={selected?.id === character.id} status={status} />;
              })}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-[18px] border border-dashed border-white/12 bg-black/20 p-6 text-center">
              <div>
                <Search className="mx-auto mb-3 h-9 w-9 text-white/32" />
                <p className="font-serif text-xl font-black text-white">No heroes found</p>
                <p className="mt-1 text-sm font-semibold text-white/48">Try another rarity, type, status, or search term.</p>
                <button className="glass-button mt-4 px-4 py-2 text-xs font-black" onClick={resetGalleryControls} type="button">Clear filters</button>
              </div>
            </div>
          )}
        </div>
      </Panel>
      {selected ? <div className="flex min-h-0 flex-col gap-3">
        <DeckPresetSelector character={selected} presets={selectedPresets} selectedPresetId={activePresetId ?? 'core'} activeStarter={selected.id === selectedStarterId} onChoose={(presetId) => onChooseDeck(selected.id, presetId)} />
        <CharacterSheet character={characterWithDeckPreset(selected, activePresetId ?? 'core')} progress={run.characterProgress[selected.id]} />
      </div> : null}
    </div>
  );
}

function DeckPresetSelector({ character, presets, selectedPresetId, activeStarter, onChoose }: { character: RuntimeCharacter; presets: RuntimeDeckPreset[]; selectedPresetId: string; activeStarter: boolean; onChoose: (presetId: string) => void }) {
  return <Panel title="Deck Arsenal">
    <div className="space-y-2">
      <div className="rounded-[12px] border border-white/10 bg-black/24 p-2">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/42">{activeStarter ? 'Selected starter deck' : 'Preview deck build'}</p>
        <p className="mt-1 text-xs font-semibold text-white/62">Pick a themed deck for {character.name}. Reset starts a fresh run with this deck.</p>
      </div>
      <div className="grid gap-2">
        {presets.map((preset) => <button className={`rounded-[12px] border p-2 text-left transition ${selectedPresetId === preset.id ? 'border-white/32 bg-white/14 text-white' : 'border-white/10 bg-white/[0.045] text-white/66 hover:bg-white/[0.08]'}`} key={preset.id} onClick={() => onChoose(preset.id)} type="button">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-serif text-base font-black leading-tight">{preset.name}</h4>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-white/42">{preset.archetype} · {preset.cards.length} cards</p>
            </div>
            {selectedPresetId === preset.id ? <span className="rounded-full border border-white/18 bg-white/12 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]">Equipped</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-white/52">{preset.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {preset.cards.slice(0, 4).map((card) => <span className="rounded-full border border-white/10 bg-black/24 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white/45" key={card.id}>{card.name}</span>)}
          </div>
        </button>)}
      </div>
    </div>
  </Panel>;
}

function GalleryCharacterCard({ character, eager, onSelect, selected, status }: { character: typeof runtimeRoster[number]; eager: boolean; onSelect: () => void; selected: boolean; status: string }) {
  return (
    <button className={`gallery-card group text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 active:scale-[0.98] ${selected ? 'scale-[1.01]' : ''}`} onClick={onSelect} type="button">
      <CharacterCardFrame compact rarity={character.rarity}>
        <div className={`relative min-h-[314px] bg-black/34 p-2.5 ${selected ? 'bg-white/[0.07]' : ''}`}>
          <div className="relative h-44 overflow-hidden rounded-[11px] border border-white/12 bg-white/[0.045] shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)]">
            {character.source.image_url ? <img className="h-full w-full object-cover object-top transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.045]" src={character.source.image_url} alt={character.name} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "auto" : "low"} referrerPolicy="no-referrer" /> : <div className="grid h-full place-items-center"><BookMarked className="h-16 w-16 text-white/70" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-transparent to-black/8"></div>
            <div className="absolute left-2 top-2"><RarityBadge rarity={character.rarity} /></div>
            <span className="absolute bottom-2 right-2 rounded-[8px] border border-white/14 bg-black/58 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-white/66 backdrop-blur-md">{status}</span>
          </div>
          <div className="px-1 pt-2">
            <h4 className="truncate font-serif text-lg font-black leading-tight text-white">{character.name}</h4>
            <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-semibold leading-snug text-white/55">{character.short_lore || character.lore}</p>
            <div className="mt-2 flex min-h-5 flex-wrap gap-1">
              {character.tags.slice(0, 3).map((tag) => <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/48" key={tag}>{tag}</span>)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <MiniStat label="HP" value={character.stats.hp} />
              <MiniStat label="ATK" value={character.stats.attack} />
              <MiniStat label="INT" value={character.stats.intelligence} />
            </div>
          </div>
        </div>
      </CharacterCardFrame>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-[8px] border border-white/10 bg-black/28 px-1.5 py-1 text-center"><span className="block font-mono text-[7px] font-black uppercase tracking-[0.14em] text-white/42">{label}</span><span className="block font-mono text-xs font-black text-white tabular-nums">{value}</span></div>;
}

function CharacterSheet({ character, compact = false, progress }: { character: typeof runtimeRoster[number]; compact?: boolean; progress?: CharacterProgress }) {
  const stats = progress ? effectiveStats(character, progress) : character.stats;

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${compact ? 'text-[0.95em]' : 'gap-4'}`}>
      <Panel title={`${character.name} Sheet`}>
        <CharacterCardFrame compact={compact} rarity={character.rarity}>
          <div className="p-3">
            <div className="mb-3 flex items-start gap-3">
              {character.source.image_url ? <img className={`${compact ? 'h-12 w-12' : 'h-16 w-16'} rounded-[10px] border border-white/15 object-cover object-top`} src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <BookMarked className="w-8 h-8 text-white flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-2"><RarityBadge rarity={character.rarity} />{progress ? <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/48">Lv. {progress.level}</span> : null}</div>
                {progress ? <ProgressRail progress={progress} /> : null}
                <p className="mt-2 text-xs text-white/60 leading-relaxed">{character.short_lore || character.lore}</p>
                <div className="mt-2 flex flex-wrap gap-1">{character.tags.slice(0, 4).map((tag) => <span className="border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60" key={tag}>{tag}</span>)}</div>
              </div>
            </div>
            <a className="text-xs font-semibold text-white/75 hover:text-white hover:underline" href={character.source.wikidata_url} rel="noreferrer" target="_blank">Read source</a>
          </div>
        </CharacterCardFrame>
      </Panel>
      <Panel title="Stats">
        <div className="space-y-1.5">{Object.entries(stats).map(([stat, value], index) => <StatRune key={stat} label={stat} value={String(value)} tone={statTone(index)} />)}</div>
      </Panel>
      <Panel title={`Cards (${character.cards.length})`}>
        <div className={`glass-scrollbar border border-white/10 ${compact ? 'max-h-[28vh] overflow-y-auto' : ''}`}>{character.cards.map((card) => <CardSummary card={card} key={card.id} />)}</div>
      </Panel>
    </div>
  );
}

function ProgressRail({ progress }: { progress: CharacterProgress }) {
  const nextLevelXp = xpForNextLevel(progress.level);
  const pct = Math.max(0, Math.min(100, (progress.xp / nextLevelXp) * 100));

  return (
    <div className="rounded-[12px] border border-white/10 bg-black/22 p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between gap-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/58"><span>Lv. {progress.level}</span><span>{progress.xp}/{nextLevelXp} XP</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-gradient-to-r from-[#F2D27E]/90 via-white/70 to-transparent shadow-[0_0_16px_rgba(242,210,126,0.34)]" style={{ width: `${pct}%` }}></div></div>
    </div>
  );
}

type RarityTheme = {
  label: string;
  text: string;
  ring: string;
  glow: string;
  wash: string;
  badge: string;
};

const rarityThemes: Record<CharacterRarity, RarityTheme> = {
  D: { label: 'D', text: 'text-stone-100', ring: 'border-stone-400/65', glow: 'shadow-[0_0_26px_rgba(168,162,158,0.30)]', wash: 'from-stone-400/34', badge: 'bg-stone-500/42' },
  C: { label: 'C', text: 'text-emerald-100', ring: 'border-emerald-300/70', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.34)]', wash: 'from-emerald-300/34', badge: 'bg-emerald-500/42' },
  B: { label: 'B', text: 'text-sky-100', ring: 'border-sky-300/75', glow: 'shadow-[0_0_34px_rgba(56,189,248,0.40)]', wash: 'from-sky-300/38', badge: 'bg-sky-500/42' },
  A: { label: 'A', text: 'text-violet-100', ring: 'border-violet-300/78', glow: 'shadow-[0_0_38px_rgba(167,139,250,0.44)]', wash: 'from-violet-300/40', badge: 'bg-violet-500/44' },
  S: { label: 'S', text: 'text-[#FFF5C7]', ring: 'border-[#F2D27E]/85', glow: 'shadow-[0_0_46px_rgba(242,210,126,0.52),0_0_86px_rgba(255,255,255,0.14)]', wash: 'from-[#F2D27E]/46', badge: 'bg-[#B68A2D]/52' },
};

const rarityFrameImages: Record<CharacterRarity, string> = {
  A: frameA,
  B: frameB,
  C: frameC,
  D: frameD,
  S: frameS,
};

const rarityRank: Record<CharacterRarity, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };

function rarityTheme(rarity: CharacterRarity): RarityTheme {
  return rarityThemes[rarity];
}

function rarityTone(rarity: CharacterRarity): string {
  const theme = rarityTheme(rarity);
  return `${theme.ring} ${theme.badge} ${theme.text}`;
}

function matchesGallerySearch(character: typeof runtimeRoster[number], searchTerm: string): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;
  return [character.name, character.short_lore, character.lore, ...character.tags].some((value) => value.toLowerCase().includes(query));
}

function galleryCharacterStatusKey(character: typeof runtimeRoster[number], partyIds: Set<string>, reserveIds: Set<string>): GalleryStatusFilter {
  if (partyIds.has(character.id)) return 'party';
  if (reserveIds.has(character.id)) return 'reserve';
  return 'seen';
}

function galleryCharacterStatusLabel(character: typeof runtimeRoster[number], partyIds: Set<string>, reserveIds: Set<string>): string {
  const status = galleryCharacterStatusKey(character, partyIds, reserveIds);
  return status === 'party' ? 'Party' : status === 'reserve' ? 'Recruitable' : 'Seen';
}

function compareGalleryCharacters(a: typeof runtimeRoster[number], b: typeof runtimeRoster[number], sortMode: GallerySortMode, progress: ReturnType<typeof createInitialRunState>['characterProgress']): number {
  if (sortMode === 'rarity-desc') return rarityRank[b.rarity] - rarityRank[a.rarity] || a.name.localeCompare(b.name);
  if (sortMode === 'rarity-asc') return rarityRank[a.rarity] - rarityRank[b.rarity] || a.name.localeCompare(b.name);
  if (sortMode === 'name') return a.name.localeCompare(b.name);
  if (sortMode === 'level') return (progress[b.id]?.level ?? 1) - (progress[a.id]?.level ?? 1) || a.name.localeCompare(b.name);
  return b.stats[sortMode] - a.stats[sortMode] || a.name.localeCompare(b.name);
}

function RarityBadge({ rarity }: { rarity: CharacterRarity }) {
  const theme = rarityTheme(rarity);
  return <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-[8px] border ${theme.ring} ${theme.badge} px-2 font-mono text-sm font-black uppercase tracking-[0.06em] ${theme.text} ${theme.glow}`}>{theme.label}</span>;
}

function CharacterCardFrame({ children, compact = false, imageFrame = false, rarity }: { children: ReactNode; compact?: boolean; imageFrame?: boolean; rarity: CharacterRarity }) {
  const theme = rarityTheme(rarity);

  if (!imageFrame) {
    return (
      <div className={`relative overflow-hidden rounded-[16px] border ${theme.ring} bg-black/22 ${theme.glow} ${compact ? 'p-px' : 'p-0.5'}`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.wash} via-transparent to-black/10 opacity-80`}></div>
        <div className="relative z-10 overflow-hidden rounded-[14px] border border-white/[0.045]">{children}</div>
      </div>
    );
  }

  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-[18px] bg-black/20 ${theme.glow}`}>
      <div className={`pointer-events-none absolute inset-[11%] rounded-[14px] bg-gradient-to-br ${theme.wash} via-black/18 to-black/18 opacity-80`}></div>
      <img src={rarityFrameImages[rarity]} alt="" className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain" loading="lazy" decoding="async" />
      <div className="absolute inset-[13%] z-10 overflow-hidden rounded-[13px] border border-white/[0.05]">{children}</div>
    </div>
  );
}

function statTone(index: number): 'red' | 'blue' | 'gold' | 'green' {
  return (['gold', 'red', 'blue', 'green'] as const)[index % 4];
}

function statLabel(label: string): string {
  const labels: Record<string, string> = {
    attack: 'ATK',
    block: 'BLK',
    defense: 'DEF',
    cards: 'CRD',
    hp: 'HP',
    influence: 'INF',
    intelligence: 'INT',
    speed: 'SPD',
    survival: 'SUR',
  };
  return labels[label.toLowerCase()] ?? label.slice(0, 3).toUpperCase();
}

function StatRune({ label, value, tone }: { label: string; value: string; tone: 'red' | 'blue' | 'gold' | 'green' }) {
  const toneClass = tone === 'red'
    ? 'from-rose-300/80 via-rose-100/55 to-transparent shadow-[0_0_14px_rgba(253,164,175,0.34)]'
    : tone === 'blue'
      ? 'from-sky-200/76 via-slate-100/48 to-transparent shadow-[0_0_14px_rgba(186,230,253,0.28)]'
      : tone === 'green'
        ? 'from-emerald-300/78 via-emerald-100/48 to-transparent shadow-[0_0_14px_rgba(110,231,183,0.30)]'
        : 'from-[#F2D27E]/84 via-[#FFE9A8]/52 to-transparent shadow-[0_0_14px_rgba(242,210,126,0.34)]';
  return (
    <div className="group grid min-h-9 grid-cols-[46px_1fr_auto] items-center gap-2 rounded-full border border-white/12 bg-black/20 px-2 py-1 text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-md" title={label}>
      <span className="rounded-full bg-white/[0.07] px-2 py-1 text-center font-mono text-[8px] font-black uppercase tracking-[0.14em] text-white/58">{statLabel(label)}</span>
      <span className={`h-2 overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.38)]`}><span className={`block h-full w-3/4 rounded-full bg-gradient-to-r ${toneClass}`}></span></span>
      <span className="min-w-8 text-right font-mono text-sm font-black text-white tabular-nums">{value}</span>
    </div>
  );
}

type CardTypeTheme = {
  label: string;
  short: string;
  text: string;
  border: string;
  glow: string;
  wash: string;
  badge: string;
  primary: string;
  secondary: string;
  dark: string;
};

function cardTypeTheme(type: string): CardTypeTheme {
  const themes: Record<string, CardTypeTheme> = {
    attack: { label: 'Attack', short: 'ATK', text: 'text-rose-100', border: 'border-rose-300/60', glow: 'shadow-[0_0_34px_rgba(251,113,133,0.30)]', wash: 'from-rose-500/28 via-orange-300/12 to-black/30', badge: 'bg-rose-500/24', primary: '#FB7185', secondary: '#FDBA74', dark: '#3B0A12' },
    skill: { label: 'Skill', short: 'SKL', text: 'text-cyan-100', border: 'border-cyan-300/60', glow: 'shadow-[0_0_34px_rgba(103,232,249,0.28)]', wash: 'from-cyan-400/26 via-sky-300/12 to-black/30', badge: 'bg-cyan-500/22', primary: '#67E8F9', secondary: '#7DD3FC', dark: '#082F49' },
    utility: { label: 'Utility', short: 'UTL', text: 'text-emerald-100', border: 'border-emerald-300/60', glow: 'shadow-[0_0_34px_rgba(110,231,183,0.28)]', wash: 'from-emerald-400/26 via-teal-300/12 to-black/30', badge: 'bg-emerald-500/22', primary: '#6EE7B7', secondary: '#5EEAD4', dark: '#052E26' },
    power: { label: 'Power', short: 'PWR', text: 'text-violet-100', border: 'border-violet-300/60', glow: 'shadow-[0_0_34px_rgba(196,181,253,0.30)]', wash: 'from-violet-400/28 via-fuchsia-300/12 to-black/30', badge: 'bg-violet-500/24', primary: '#C4B5FD', secondary: '#F0ABFC', dark: '#2E1065' },
    ultimate: { label: 'Ultimate', short: 'ULT', text: 'text-amber-100', border: 'border-amber-200/70', glow: 'shadow-[0_0_42px_rgba(252,211,77,0.38)]', wash: 'from-amber-300/34 via-yellow-100/14 to-black/30', badge: 'bg-amber-400/24', primary: '#FCD34D', secondary: '#FEF3C7', dark: '#422006' },
  };

  return themes[type.toLowerCase()] ?? { label: type || 'Card', short: 'CRD', text: 'text-slate-100', border: 'border-slate-300/50', glow: 'shadow-[0_0_28px_rgba(203,213,225,0.22)]', wash: 'from-slate-300/22 via-white/8 to-black/30', badge: 'bg-slate-500/20', primary: '#CBD5E1', secondary: '#F8FAFC', dark: '#0F172A' };
}

function CardSummary({ card }: { card: RuntimeCard }) {
  const theme = cardTypeTheme(card.card_type);
  return <div className={`border-b border-white/10 bg-gradient-to-r ${theme.wash} p-2 last:border-b-0`}><div className="grid grid-cols-[1fr_28px] items-center gap-2"><strong className="truncate font-serif text-sm text-white">{card.name}</strong><span className={`border ${theme.border} ${theme.badge} px-2 py-0.5 text-center text-[10px] font-bold ${theme.text}`}>{card.energy_cost}</span></div><p className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${theme.text}`}>{theme.label} · {card.card_rarity}</p><p className="mt-1 text-xs leading-relaxed text-white/62">{card.mechanics_text}</p></div>;
}

function PlayerIntelCard({ character, player, progress }: { character: typeof runtimeRoster[number]; player: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['player'] | undefined; progress: CharacterProgress }) {
  const effective = effectiveStats(character, progress);
  const stats = Object.entries(effective).filter(([stat]) => stat !== 'hp');
  const hp = player ? `${player.hp}/${player.maxHp}` : String(effective.hp);
  const block = player?.block ?? 0;

  return (
    <div className="glass-panel w-full p-2 text-white">
      <CharacterCardFrame compact rarity={character.rarity}>
        <div className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">Hero Intel</span>
            <div className="flex items-center gap-2"><RarityBadge rarity={character.rarity} /><span className="border border-white/15 bg-white/[0.07] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/65">Lv. {progress.level}</span></div>
          </div>
          <div className="mt-2.5 flex gap-3">
            {character.source.image_url ? <img className="h-24 w-20 flex-shrink-0 rounded-[12px] border border-white/15 object-cover object-top shadow-[0_18px_50px_rgba(0,0,0,0.34)]" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <div className="grid h-24 w-20 flex-shrink-0 place-items-center rounded-[12px] border border-white/15 bg-white/[0.06]"><BookMarked className="h-8 w-8 text-white/70" /></div>}
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-xl font-black leading-tight text-white">{character.name}</h3>
              <p className="mt-1 line-clamp-3 text-[11px] italic leading-relaxed text-white/60">{character.short_lore || character.lore}</p>
            </div>
          </div>
          <div className="mt-3"><ProgressRail progress={progress} /></div>
          <div className="mt-2.5 flex flex-wrap gap-1">{character.tags.slice(0, 6).map((tag) => <span className="rounded-full border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/58" key={tag}>{tag}</span>)}</div>
          <a className="mt-2.5 inline-flex text-[11px] font-semibold text-white/75 hover:text-white hover:underline" href={character.source.wikidata_url} rel="noreferrer" target="_blank">Read source</a>
        </div>
      </CharacterCardFrame>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <StatRune label="HP" value={hp} tone="red" />
        <StatRune label="BLK" value={String(block)} tone="blue" />
        {stats.map(([stat, value], index) => <StatRune key={stat} label={stat} value={String(value)} tone={statTone(index)} />)}
      </div>
    </div>
  );
}

function EnemyIntelCard({ enemy, intent }: { enemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number]; intent: number }) {
  const statuses = Object.entries(enemy.statuses);

  return (
    <div className="glass-panel w-full p-5 text-white">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Enemy Intel</span>
        <div className="flex items-center gap-1 text-white/80"><Sword className="w-4 h-4" /><span className="font-mono text-sm font-black">{intent}</span></div>
      </div>
      <h3 className="mt-2 font-serif text-xl font-black leading-tight text-white">{enemy.name}</h3>
      <div className="mt-4 space-y-1.5">
        <EnemyRune label="HP" value={`${enemy.hp}/${enemy.maxHp}`} tone="red" />
        <EnemyRune label="BLK" value={String(enemy.block)} tone="blue" />
        <EnemyRune label="ATK" value={String(intent)} tone="gold" />
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/45"><Skull className="w-3.5 h-3.5" /> Status</div>
        {statuses.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">{statuses.map(([status, value]) => <span className="border border-white/15 bg-white/[0.07] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/65" key={status}>{status} {value}</span>)}</div>
        ) : <p className="mt-2 text-xs italic leading-relaxed text-white/55">No active statuses. Apply debuffs or marks to change this fight.</p>}
      </div>
    </div>
  );
}

function EnemyRune({ label, value, tone }: { label: string; value: string; tone: 'red' | 'blue' | 'gold' }) {
  return <StatRune label={label} value={value} tone={tone} />;
}

function NodeInfo({ node, run }: { node: ReturnType<typeof createInitialRunState>['map'][number][number]; run: ReturnType<typeof createInitialRunState> }) {
  const completed = run.completedNodeIds.includes(node.id);
  const available = run.phase === 'map' && isNodeAvailable(run, node);
  const status = completed ? 'Cleared' : available ? 'Available' : 'Locked';
  const description = node.type === 'battle'
    ? 'Enter combat and earn a recruit reward.'
    : node.type === 'elite'
      ? 'A harder fight with better payoff.'
      : node.type === 'rest'
        ? 'Recover momentum and upgrade a card.'
        : node.type === 'event'
          ? 'Choose a story event outcome.'
          : 'Final boss encounter for this act.';

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{node.type}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-300">{status}</span>
      </div>
      <strong className="mt-1 block font-serif text-sm leading-tight text-white">{node.title}</strong>
      <p className="mt-1 text-xs leading-snug text-gray-400">{description}</p>
    </div>
  );
}

function ArtifactItem({ artifact, icon, onSelect, selected }: { artifact: ReturnType<typeof createInitialRunState>['artifacts'][number]; icon: ReactNode; onSelect: () => void; selected: boolean }) {
  return (
    <button className="group flex flex-col items-center gap-2 text-center" onClick={onSelect} onFocus={onSelect} onMouseEnter={onSelect} title={`${artifact.name}: ${artifact.description}`}>
      <div className={`relative flex h-14 w-14 items-center justify-center overflow-hidden border bg-white/[0.06] shadow-inner backdrop-blur-md transition ${selected ? 'border-white/35 shadow-[0_0_18px_rgba(255,255,255,0.18)]' : 'border-white/12 group-hover:border-white/30'}`}>
        <div className="pointer-events-none absolute inset-1 border border-white/10"></div>{icon}
      </div>
      <span className="text-[10px] font-semibold text-center text-white leading-tight">{artifact.name}</span>
    </button>
  );
}

function ArtifactDetail({ artifact, acquired }: { artifact: ReturnType<typeof createInitialRunState>['artifacts'][number]; acquired: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_76px] gap-2 border-b border-white/10 bg-white/[0.04] p-2 text-left last:border-b-0">
      <div className="min-w-0">
        <strong className="block truncate font-serif text-sm text-white">{artifact.name}</strong>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/45">{artifact.archetype}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">{artifact.description}</p>
      </div>
      <span className="self-start border border-white/15 bg-black/35 px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/70">{acquired ? 'Owned' : 'Preview'}</span>
    </div>
  );
}

function SynergyItem({ title, body }: { title: string; body: string }) {
  return <div className="grid grid-cols-[32px_1fr] items-start gap-3 border-b border-white/10 bg-white/[0.04] p-3 last:border-b-0"><div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border border-white/15 bg-white/[0.08]"><BookOpen className="w-4 h-4 text-white/70" /></div><div className="flex flex-col"><span className="text-sm font-bold text-white">{title}</span><span className="text-xs text-white/55 mt-0.5">{body}</span></div></div>;
}

function CenterPanel({ combat, combatEffects, currentCharacter, currentProgress, hand, livingEnemyCount, recruitChoices, reducedMotion, selectedEnemy, selectedEnemyId, settingsCompact, phase, primaryDisabled, onOpenEnemyIntel, onOpenPlayerIntel, onPrimaryAction, onRecruit, onSelectEnemy, onPlayCard }: {
  combat: ReturnType<typeof createInitialRunState>['combat'];
  combatEffects: CombatEffectEvent[];
  currentCharacter: typeof runtimeRoster[number];
  currentProgress: CharacterProgress;
  hand: RuntimeCard[];
  livingEnemyCount: number;
  recruitChoices: typeof runtimeRoster;
  selectedEnemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] | undefined;
  selectedEnemyId: string | undefined;
  reducedMotion: boolean;
  settingsCompact: boolean;
  phase: string;
  primaryDisabled: boolean;
  onOpenEnemyIntel: (enemyId: string) => void;
  onOpenPlayerIntel: () => void;
  onPrimaryAction: () => void;
  onRecruit: (characterId: string) => void;
  onSelectEnemy: (enemyId: string) => void;
  onPlayCard: (card: RuntimeCard) => void;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const player = combat?.player;
  const playerHp = player ? `${player.hp} / ${player.maxHp}` : 'Ready';
  const enemyHp = selectedEnemy ? `${selectedEnemy.hp} / ${selectedEnemy.maxHp}` : 'Awaiting battle';
  const visibleHand = useMemo(() => hand.slice(0, 5), [hand]);
  const overflowHand = useMemo(() => hand.slice(5), [hand]);
  const canPlayCard = useCallback((card: RuntimeCard) => Boolean(combat && combat.phase === 'player' && combat.energy >= card.energy_cost && livingEnemyCount > 0), [combat, livingEnemyCount]);
  const playCardAndCloseOverflow = useCallback((card: RuntimeCard) => {
    if (!canPlayCard(card)) {
      return;
    }
    onPlayCard(card);
    setOverflowOpen(false);
  }, [canPlayCard, onPlayCard]);
  const closeOverflow = useCallback(() => setOverflowOpen(false), []);
  const openOverflow = useCallback(() => setOverflowOpen(true), []);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-black/36 p-1.5 font-sans shadow-[inset_0_1px_1px_rgba(255,244,214,0.14),0_24px_80px_rgba(0,0,0,0.42),0_0_46px_rgba(218,199,150,0.12)]">
      <div className="absolute inset-x-6 top-4 z-20 flex justify-center"><div className="rounded-full bg-black/20 px-4 py-1.5 shadow-[inset_0_1px_0_rgba(255,244,214,0.14)]"><div className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-[#DAC796]/75" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/78">{phase}</span><Sparkles className="h-3 w-3 text-[#DAC796]/75" /></div></div></div>
      <GameplayBackdrop />
      <div className="absolute bottom-1.5 left-1.5 right-1.5 h-[356px] rounded-b-[18px] bg-gradient-to-t from-[rgba(32,35,39,0.97)] via-[rgba(32,35,39,0.82)] to-transparent z-10 pointer-events-none"></div>
      <div className="relative z-20 grid h-full min-h-0 grid-rows-[minmax(300px,1fr)_330px] gap-3 px-6 pb-4 pt-10 overflow-hidden">
        <div className="min-h-0 flex items-start justify-center gap-64 px-8 pt-4 overflow-visible">
          <div className="relative flex">
            <CombatantPanel
              align="left"
              block={player?.block ?? 0}
              currentHp={player?.hp ?? 1}
              effects={player ? combatEffects.filter((effect) => effect.targetId === player.id) : []}
              hpLabel={playerHp}
              imageUrl={currentCharacter.source.image_url}
              inspectable
              maxHp={player?.maxHp ?? 1}
              level={currentProgress.level}
              name={currentCharacter.name}
              onInspect={onOpenPlayerIntel}
              reducedMotion={reducedMotion}
            />
          </div>
          <div className="relative flex">
            <CombatantPanel
              align="right"
              block={selectedEnemy?.block ?? 0}
              currentHp={selectedEnemy?.hp ?? 1}
              effects={selectedEnemy ? combatEffects.filter((effect) => effect.targetId === selectedEnemy.id) : []}
              hpLabel={enemyHp}
              inspectable={Boolean(selectedEnemy)}
              intent={selectedEnemy ? combat?.enemyIntent[selectedEnemy.id] : undefined}
              maxHp={selectedEnemy?.maxHp ?? 1}
              name={selectedEnemy?.name ?? 'Archive Sentry'}
              onInspect={() => selectedEnemy && onOpenEnemyIntel(selectedEnemy.id)}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
        <div className="min-h-0 w-full z-30 flex flex-col justify-end items-center pb-1 relative overflow-visible">
          <div className="flex w-full items-end justify-center gap-2 overflow-visible px-2 pb-8">
            {visibleHand.map((card, index) => <HandCardButton card={card} compact={settingsCompact || hand.length > 5} disabled={!canPlayCard(card)} image={cardArt[index % cardArt.length]} key={`${card.id}-${card.name}`} onPlayCard={playCardAndCloseOverflow} />)}
            {overflowHand.length ? <button className="min-w-0 flex-shrink" onClick={openOverflow} type="button"><HandOverflowTile count={overflowHand.length} /></button> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 w-full text-center pointer-events-none z-10"><p className="text-gray-400 text-sm tracking-widest uppercase">Play cards to use their effects.</p></div>
        </div>
      </div>
      {combat?.enemies.length ? <div className="absolute right-8 top-16 z-30 flex justify-end gap-2">{combat.enemies.map((enemy) => <button className={`border px-3 py-1 text-xs backdrop-blur-md transition ${enemy.id === selectedEnemyId ? 'border-white/35 bg-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.16)]' : 'border-white/15 bg-black/35 text-white/65 hover:bg-white/10'}`} disabled={enemy.hp <= 0} key={enemy.id} onClick={() => onSelectEnemy(enemy.id)}>{enemy.name}</button>)}</div> : null}
      {overflowOpen ? <HandOverflowOverlay cards={overflowHand} canPlayCard={canPlayCard} onClose={closeOverflow} onPlayCard={playCardAndCloseOverflow} /> : null}
      {combat?.phase === 'won' ? <RewardOverlay recruits={recruitChoices} onRecruit={onRecruit} onSkip={onPrimaryAction} /> : null}
    </div>
  );
}

function LevelUpOverlay({ character, progress, onChoose }: { character: typeof runtimeRoster[number]; progress: CharacterProgress; onChoose: (stat: CharacterStatKey) => void }) {
  const options = majorUpgradeOptions(character);

  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/66 px-8 backdrop-blur-sm">
      <div className="glass-panel max-w-3xl p-5 text-white">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Level up</span>
            <h3 className="font-serif text-3xl font-black">{character.name} reached Lv. {progress.level}</h3>
            <p className="mt-1 text-sm text-white/58">Choose one major stat boost before continuing the run.</p>
          </div>
          <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 font-mono text-xs font-black text-white/70">{progress.xp}/{xpForNextLevel(progress.level)} XP</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {options.map((option) => <button className="group border border-white/14 bg-white/[0.065] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:bg-white/12 active:scale-[0.98]" key={option.stat} onClick={() => onChoose(option.stat)}>
            <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/45">Major upgrade</span>
            <strong className="mt-2 block font-serif text-2xl text-white">+{option.amount} {statLabel(option.stat)}</strong>
            <span className="mt-2 block text-xs font-semibold leading-relaxed text-white/58">Improve {character.name}'s run-local growth for this attempt.</span>
          </button>)}
        </div>
      </div>
    </div>
  );
}

const CardRewardOverlay = memo(function CardRewardOverlay({ cards, onChoose, onSkip }: { cards: RewardCardPack[]; onChoose: (packId: string) => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/68 px-8 backdrop-blur-md">
      <div className="glass-panel w-full max-w-5xl p-5 text-white">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Limited Skill Packs</span>
            <h3 className="font-serif text-3xl font-black">Choose a Skill Pack</h3>
            <p className="mt-1 text-sm font-semibold text-white/55">Pick one pack. Cards go to your collection first; equip only {MIN_DECK_SIZE}-{MAX_DECK_SIZE} in Deck Lab.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/12 bg-black/28 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/50">max {MAX_REWARD_PACK_SIZE} cards</span>
            <button className="glass-button px-3 py-1 text-xs font-black" onClick={onSkip}>Skip</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {cards.map((pack) => <CardRewardButton key={pack.id} pack={pack} onChoose={onChoose} />)}
        </div>
      </div>
    </div>
  );
});

const CardRewardButton = memo(function CardRewardButton({ pack, onChoose }: { pack: RewardCardPack; onChoose: (packId: string) => void }) {
  const choose = useCallback(() => onChoose(pack.id), [pack.id, onChoose]);
  const theme = cardTypeTheme(pack.archetype);

  return (
    <button className={`group overflow-hidden rounded-[20px] border ${theme.border} bg-black/42 p-0 text-left shadow-[0_18px_60px_rgba(0,0,0,0.30)] transition hover:-translate-y-0.5 hover:bg-white/[0.07] active:translate-y-0`} onClick={choose} type="button">
      <div className={`relative border-b border-white/10 bg-gradient-to-br ${theme.wash} p-4`}>
        <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/35 px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-white/58">{pack.cards.length} cards</div>
        <span className={`font-mono text-[9px] font-black uppercase tracking-[0.2em] ${theme.text}`}>{theme.label} pack</span>
        <h4 className="mt-2 font-serif text-2xl font-black leading-tight text-white">{pack.name}</h4>
        <p className="mt-1 min-h-[36px] text-xs font-semibold leading-relaxed text-white/58">{pack.description}</p>
      </div>
      <div className="space-y-2 p-3">
        {pack.cards.map((card) => <PackCardPreview card={card} key={card.id} />)}
        <div className="rounded-[12px] border border-white/10 bg-white/[0.07] px-3 py-2 text-center font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white/70 transition group-hover:border-white/22 group-hover:text-white">Add Pack to Collection</div>
      </div>
    </button>
  );
});

const PackCardPreview = memo(function PackCardPreview({ card }: { card: RuntimeCard }) {
  const theme = cardTypeTheme(card.card_type);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-[12px] border border-white/10 bg-black/24 p-2">
      <div className="min-w-0">
        <div className="truncate font-serif text-sm font-black text-white">{card.name}</div>
        <div className={`font-mono text-[8px] font-black uppercase tracking-[0.14em] ${theme.text}`}>{theme.label} · {card.card_rarity}</div>
      </div>
      <span className={`grid h-8 w-8 place-items-center rounded-[9px] border ${theme.border} ${theme.badge} font-serif text-lg font-black ${theme.text}`}>{card.energy_cost}</span>
    </div>
  );
});

function majorUpgradeOptions(character: typeof runtimeRoster[number]): { stat: CharacterStatKey; amount: number }[] {
  const sortedStats = (Object.keys(character.stats) as CharacterStatKey[])
    .filter((stat) => stat !== 'hp')
    .sort((first, second) => character.stats[second] - character.stats[first]);

  return [
    { stat: 'hp', amount: 6 },
    { stat: sortedStats[0] ?? 'attack', amount: 2 },
    { stat: sortedStats.find((stat) => stat === 'defense' || stat === 'survival') ?? sortedStats[1] ?? 'defense', amount: 2 },
  ];
}

function RewardOverlay({ recruits, onRecruit, onSkip }: { recruits: typeof runtimeRoster; onRecruit: (characterId: string) => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/58 px-8 backdrop-blur-sm">
      <div className="glass-panel max-w-4xl p-5 text-white">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Battle Reward</span>
            <h3 className="font-serif text-3xl font-black">Recruit a Wiki hero</h3>
          </div>
          <button className="glass-button px-3 py-1 text-xs font-black" onClick={onSkip}>Skip</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {recruits.length ? recruits.map((character) => <RecruitCard character={character} key={character.id} onRecruit={() => onRecruit(character.id)} />) : <p className="col-span-3 text-sm font-bold text-white/55">No reserve characters left. Take the artifact and card upgrade.</p>}
        </div>
      </div>
    </div>
  );
}

function RecruitCard({ character, onRecruit }: { character: typeof runtimeRoster[number]; onRecruit: () => void }) {
  return (
    <button className="text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 active:scale-[0.98]" onClick={onRecruit}>
      <CharacterCardFrame imageFrame rarity={character.rarity}>
        <div className="flex h-full flex-col bg-white/[0.045] p-3 backdrop-blur-xl">
          <div className="relative mb-3 h-[48%] overflow-hidden rounded-[10px] border border-white/15 bg-black/28">
            {character.source.image_url ? <img className="h-full w-full object-cover object-top" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <div className="grid h-full place-items-center"><BookMarked className="h-12 w-12 text-white" /></div>}
            <div className="absolute left-2 top-2"><RarityBadge rarity={character.rarity} /></div>
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2"><span className="font-mono text-[9px] font-black uppercase tracking-widest text-white/45">+{character.cards.length} cards</span></div>
            <h4 className="truncate font-serif text-lg font-black text-white">{character.name}</h4>
          </div>
          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-relaxed text-white/60">{character.short_lore || character.lore}</p>
          <div className="mt-auto grid grid-cols-3 gap-1 pt-3">
            <MiniStat label="HP" value={character.stats.hp} />
            <MiniStat label="ATK" value={character.stats.attack} />
            <MiniStat label="DEF" value={character.stats.defense} />
          </div>
        </div>
      </CharacterCardFrame>
    </button>
  );
}

function GameplayBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[18px] bg-black/18">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,244,214,0.13),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(218,199,150,0.10),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.10),rgba(0,0,0,0.28))]"></div>
      <div className="absolute inset-x-14 bottom-8 h-40 rounded-[999px] bg-[#DAC796]/[0.05] blur-3xl"></div>
    </div>
  );
}

function CombatantPanel({ align, block, currentHp, effects = [], hpLabel, imageUrl, inspectable, intent, level, maxHp, name, onInspect, reducedMotion = false }: {
  align: 'left' | 'right';
  block: number;
  currentHp: number;
  effects?: CombatEffectEvent[];
  hpLabel: string;
  imageUrl?: string | null;
  inspectable?: boolean;
  intent?: number;
  level?: number;
  maxHp: number;
  name: string;
  onInspect?: () => void;
  reducedMotion?: boolean;
}) {
  const right = align === 'right';
  const hasAttack = effects.some((effect) => effect.kind === 'attack');
  const hasDefeat = effects.some((effect) => effect.kind === 'defeat');
  const motionClass = reducedMotion ? '' : hasAttack ? (right ? '-translate-x-5 scale-[1.04]' : 'translate-x-5 scale-[1.04]') : hasDefeat ? 'translate-y-2 scale-95 opacity-65 grayscale' : '';
  return (
    <button
      className={`relative flex flex-col items-center w-64 min-w-0 text-left transition duration-300 ${motionClass} ${right ? 'items-end' : 'items-start'} ${inspectable ? 'cursor-help hover:scale-[1.02]' : 'cursor-default'}`}
      disabled={!inspectable}
      onClick={onInspect}
      type="button"
    >
      <CombatEffectLayer align={align} effects={effects} reducedMotion={reducedMotion} />
      <div className="w-56 h-64 relative mb-3 flex justify-center self-center">
        {imageUrl ? (
          <div className="absolute bottom-0 h-60 w-52 overflow-hidden border border-white/15 bg-white/[0.055] shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <img className="h-full w-full object-cover object-top" src={imageUrl} alt={name} referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"></div>
          </div>
        ) : (
          <FallbackEnemyFigure />
        )}
      </div>
      <div className="w-full text-center relative">
        <h2 className={`font-serif font-bold text-lg text-[#FDFBF8] drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] mb-2 truncate ${right ? 'text-right pr-2' : 'text-left pl-2'}`}>{name}{level ? <span className="ml-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-white/58">Lv. {level}</span> : null}</h2>
        <HealthBar current={currentHp} max={maxHp} label={hpLabel} />
        <BlockBadge value={block} align={align} />
      </div>
      <div className={`mt-3 flex ${right ? 'justify-end' : 'justify-start'}`}><GlassInfoBadge label={inspectable ? 'CLICK INTEL' : 'INTEL'} tone={right ? 'red' : 'blue'} value={right ? String(intent ?? 7) : '?'} /></div>
    </button>
  );
}

function CombatEffectLayer({ align, effects, reducedMotion }: { align: 'left' | 'right'; effects: CombatEffectEvent[]; reducedMotion: boolean }) {
  if (!effects.length) {
    return null;
  }
  const hasDamage = effects.some((effect) => effect.kind === 'damage');
  const hasBlock = effects.some((effect) => effect.kind === 'block');
  const hasHeal = effects.some((effect) => effect.kind === 'heal');
  const hasAttack = effects.some((effect) => effect.kind === 'attack');
  const hasDefeat = effects.some((effect) => effect.kind === 'defeat');

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
      {hasDamage ? <DamageBurst reducedMotion={reducedMotion} /> : null}
      {hasBlock ? <ShieldPulse reducedMotion={reducedMotion} /> : null}
      {hasHeal ? <HealPulse reducedMotion={reducedMotion} /> : null}
      {hasAttack ? <AttackSlash align={align} reducedMotion={reducedMotion} /> : null}
      {hasDefeat ? <DefeatVeil /> : null}
      <div className={`absolute top-8 flex flex-col gap-1 ${align === 'right' ? 'right-2 items-end' : 'left-2 items-start'}`}>
        {effects.filter((effect) => effect.kind !== 'attack').map((effect) => <FloatingCombatText effect={effect} key={effect.id} reducedMotion={reducedMotion} />)}
      </div>
    </div>
  );
}

function FloatingCombatText({ effect, reducedMotion }: { effect: CombatEffectEvent; reducedMotion: boolean }) {
  const text = effect.kind === 'damage' ? `-${effect.amount}` : effect.kind === 'block' ? `+${effect.amount} BLK` : effect.kind === 'heal' ? `+${effect.amount} HP` : 'DOWN';
  const tone = effect.kind === 'damage' || effect.kind === 'defeat' ? 'border-red-200/45 bg-red-500/22 text-red-50 shadow-[0_0_22px_rgba(248,113,113,0.42)]' : effect.kind === 'block' ? 'border-cyan-200/45 bg-cyan-400/20 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)]' : 'border-emerald-200/45 bg-emerald-400/20 text-emerald-50 shadow-[0_0_22px_rgba(52,211,153,0.35)]';
  return <span className={`rounded-full border px-3 py-1 font-mono text-sm font-black tracking-wide ${tone} ${reducedMotion ? '' : 'animate-bounce'}`}>{text}</span>;
}

function DamageBurst({ reducedMotion }: { reducedMotion: boolean }) {
  return <div className={`absolute left-1/2 top-12 h-36 w-36 -translate-x-1/2 rounded-full border border-red-200/35 bg-red-500/20 blur-[1px] ${reducedMotion ? 'opacity-70' : 'animate-ping'}`}></div>;
}

function ShieldPulse({ reducedMotion }: { reducedMotion: boolean }) {
  return <div className={`absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-[28px] border-2 border-cyan-200/55 bg-cyan-300/10 shadow-[0_0_36px_rgba(103,232,249,0.42)] ${reducedMotion ? 'opacity-80' : 'animate-pulse'}`}></div>;
}

function HealPulse({ reducedMotion }: { reducedMotion: boolean }) {
  return <div className={`absolute left-1/2 top-14 h-32 w-32 -translate-x-1/2 rounded-full border border-emerald-100/45 bg-emerald-400/16 shadow-[0_0_40px_rgba(52,211,153,0.38)] ${reducedMotion ? 'opacity-75' : 'animate-pulse'}`}></div>;
}

function AttackSlash({ align, reducedMotion }: { align: 'left' | 'right'; reducedMotion: boolean }) {
  return <div className={`absolute top-10 h-32 w-2 rounded-full bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.72)] ${align === 'right' ? 'left-6 -rotate-45' : 'right-6 rotate-45'} ${reducedMotion ? 'opacity-70' : 'animate-pulse'}`}></div>;
}

function DefeatVeil() {
  return <div className="absolute left-1/2 top-8 h-44 w-44 -translate-x-1/2 rounded-full bg-black/42 backdrop-grayscale"></div>;
}

function FallbackEnemyFigure() {
  return (
    <div className="absolute bottom-0 grid h-60 w-52 place-items-center border border-white/15 bg-white/[0.055] shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="absolute inset-3 border border-white/10"></div>
      <div className="relative h-20 w-20 border border-white/20 bg-white/10 shadow-[0_0_42px_rgba(255,255,255,0.16)]">
        <div className="absolute left-5 top-7 h-2 w-2 bg-white/80 shadow-[18px_0_0_rgba(255,255,255,0.8)]"></div>
        <div className="absolute bottom-5 left-1/2 h-px w-9 -translate-x-1/2 bg-white/40"></div>
      </div>
    </div>
  );
}

function BlockBadge({ value, align }: { value: number; align: 'left' | 'right' }) {
  return (
    <div className={`mt-2 flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <GlassInfoBadge label="BLK" tone="blue" value={String(value)} />
    </div>
  );
}

function HealthBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="relative h-5 w-full overflow-hidden border border-white/15 bg-white/10 backdrop-blur-md">
      <div className="h-full bg-white/65" style={{ width: `${pct}%` }}></div>
      <div className="absolute inset-0 grid place-items-center font-mono text-[10px] font-black tracking-wide text-white mix-blend-difference">{label}</div>
    </div>
  );
}

function GlassInfoBadge({ label, tone, value }: { label: string; tone: 'blue' | 'red'; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center overflow-hidden border border-white/15 bg-white/[0.08] text-white backdrop-blur-md">
      <span className="grid h-7 min-w-8 place-items-center bg-white/14 px-2 font-mono text-sm font-black">{value}</span>
      <span className="px-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/65">{label}</span>
    </div>
  );
}

const HandCardButton = memo(function HandCardButton({ card, compact, disabled, image, onPlayCard }: { card: RuntimeCard; compact?: boolean; disabled: boolean; image: ReactNode; onPlayCard: (card: RuntimeCard) => void }) {
  const play = useCallback(() => onPlayCard(card), [card, onPlayCard]);

  return (
    <button className="disabled:cursor-not-allowed min-w-0 flex-shrink" disabled={disabled} onClick={play} type="button">
      <HandCardItem card={card} compact={compact} disabled={disabled} image={image} />
    </button>
  );
});

const HandOverflowTile = memo(function HandOverflowTile({ count }: { count: number }) {
  return (
    <div className="relative flex h-[232px] w-[164px] items-center justify-center overflow-hidden rounded-[16px] border border-white/20 bg-black/68 shadow-[0_18px_44px_rgba(0,0,0,0.32),inset_0_1px_1px_rgba(255,255,255,0.12)] transition duration-150 hover:z-20 hover:-translate-y-1 hover:bg-white/[0.09]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,0,0,0.24))]"></div>
      <div className="relative z-10 text-center">
        <span className="block font-serif text-5xl font-black text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.55)]">+{count}</span>
        <span className="mt-2 block font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/62">cards</span>
        <span className="mt-4 block rounded-full border border-white/14 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/72">Open hand</span>
      </div>
    </div>
  );
});

const HandOverflowOverlay = memo(function HandOverflowOverlay({ cards, canPlayCard, onClose, onPlayCard }: { cards: RuntimeCard[]; canPlayCard: (card: RuntimeCard) => boolean; onClose: () => void; onPlayCard: (card: RuntimeCard) => void }) {
  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-black/68 p-6 backdrop-blur-sm">
      <section className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-white/16 bg-black/72 text-white shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
        <header className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 bg-white/[0.045] px-4 py-3">
          <div>
            <span className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-white/42">Overflow hand</span>
            <h3 className="font-serif text-2xl font-black text-white">Choose a card</h3>
          </div>
          <button className="rounded-full border border-white/14 bg-white/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/12 hover:text-white" onClick={onClose} type="button">Close</button>
        </header>
        <div className="glass-scrollbar min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(154px,154px))] justify-center gap-3">
            {cards.map((card, index) => <HandCardButton card={card} compact disabled={!canPlayCard(card)} image={cardArt[(index + 5) % cardArt.length]} key={`${card.id}-${card.name}`} onPlayCard={onPlayCard} />)}
          </div>
        </div>
      </section>
    </div>
  );
});

function HandCardItem({ card, compact, image, disabled }: { card: RuntimeCard; compact?: boolean; image: ReactNode; disabled?: boolean }) {
  const theme = cardTypeTheme(card.card_type);
  const sizeClass = compact ? 'h-[232px] w-[164px]' : 'h-[252px] w-[180px]';

  return (
    <div className={`relative ${sizeClass} transition-transform duration-150 ${disabled ? 'translate-y-1 opacity-65' : 'z-10 cursor-pointer opacity-100 hover:z-20 hover:-translate-y-1'}`}>
      <div className={`absolute inset-0 overflow-hidden rounded-[16px] border ${theme.border} bg-black/72 shadow-[0_14px_36px_rgba(0,0,0,0.30)]`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.wash}`}></div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 180 252" fill="none" preserveAspectRatio="none">
          <rect x="6" y="6" width="168" height="240" rx="16" stroke={theme.primary} strokeOpacity="0.42" strokeWidth="1.2" />
          <path d="M26 20H58M122 20H154M26 232H58M122 232H154" stroke={theme.secondary} strokeOpacity="0.48" strokeWidth="2" strokeLinecap="round" />
          <path d="M90 8L105 18H75L90 8Z" fill={theme.dark} fillOpacity="0.72" stroke={theme.primary} strokeOpacity="0.52" />
        </svg>
        <div className="relative z-10 flex h-full flex-col p-3">
          <div className={`mb-2 rounded-[10px] border ${theme.border} ${theme.badge} px-2 py-2 text-center`}>
            <h3 className="truncate font-serif text-[15px] font-black leading-tight text-white">{card.name}</h3>
            <span className={`font-mono text-[9px] font-black uppercase tracking-[0.18em] ${theme.text}`}>{theme.label}</span>
          </div>
          <div className={`relative mb-2 flex h-[66px] w-full flex-col items-center justify-center overflow-hidden rounded-[12px] border ${theme.border} bg-black/26`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.wash} opacity-70`}></div>
            <div className={`relative z-10 ${theme.text}`}>{image}</div>
            <span className="absolute bottom-1 right-1 rounded-full border border-white/10 bg-black/42 px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-[0.12em] text-white/45">{theme.short}</span>
          </div>
          <div className="relative z-10 flex flex-1 items-center justify-center rounded-[12px] border border-white/10 bg-black/24 px-2 text-center">
            <p className="line-clamp-4 text-[13px] font-bold leading-snug text-white/82">{card.mechanics_text}</p>
          </div>
        </div>
      </div>
      <div className={`absolute -left-1 -top-1 z-30 flex h-9 w-9 items-center justify-center rounded-[10px] border ${theme.border} ${theme.badge} shadow-[0_8px_20px_rgba(0,0,0,0.28)]`}><span className={`font-serif text-xl font-black ${theme.text}`}>{card.energy_cost}</span></div>
      {disabled ? <div className="absolute inset-0 z-40 flex items-end justify-center rounded-[16px] bg-black/56 pb-4"><div className="pointer-events-none rounded-full border border-white/12 bg-black/78 px-3 py-1 text-xs font-semibold text-gray-200"><span>Not enough Energy</span></div></div> : null}
    </div>
  );
}

function CardItem({ card, compact, image, disabled }: { card: RuntimeCard; compact?: boolean; image: ReactNode; disabled?: boolean }) {
  const theme = cardTypeTheme(card.card_type);
  const sizeClass = compact ? 'h-[218px] w-[154px]' : 'h-[236px] w-[168px]';

  return (
    <div className={`relative ${sizeClass} transition-transform duration-200 ${disabled ? 'translate-y-2 opacity-70' : 'z-10 cursor-pointer opacity-100 hover:z-20 hover:-translate-y-4'}`}>
      <div className={`absolute inset-0 overflow-hidden rounded-[16px] border ${theme.border} bg-black/72 ${theme.glow} backdrop-blur-xl`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.wash}`}></div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 168 236" fill="none" preserveAspectRatio="none">
          <rect x="5" y="5" width="158" height="226" rx="15" stroke={theme.primary} strokeOpacity="0.62" strokeWidth="1.4" />
          <rect x="13" y="13" width="142" height="210" rx="10" stroke={theme.secondary} strokeOpacity="0.24" strokeWidth="1" />
          <path d="M34 5H16C10 5 5 10 5 16V34M134 5H152C158 5 163 10 163 16V34M34 231H16C10 231 5 226 5 220V202M134 231H152C158 231 163 226 163 220V202" stroke={theme.secondary} strokeOpacity="0.72" strokeWidth="2" strokeLinecap="round" />
          <path d="M61 16L84 8L107 16L99 25H69L61 16Z" fill={theme.dark} fillOpacity="0.88" stroke={theme.primary} strokeOpacity="0.78" />
          <path d="M23 55H145M23 159H145" stroke={theme.primary} strokeOpacity="0.20" strokeWidth="1" />
          <circle cx="24" cy="24" r="2.5" fill={theme.secondary} fillOpacity="0.65" />
          <circle cx="144" cy="24" r="2.5" fill={theme.secondary} fillOpacity="0.65" />
          <circle cx="24" cy="212" r="2.5" fill={theme.secondary} fillOpacity="0.42" />
          <circle cx="144" cy="212" r="2.5" fill={theme.secondary} fillOpacity="0.42" />
        </svg>
        <div className="relative z-10 flex h-full flex-col p-3">
          <div className={`mb-2 rounded-[10px] border ${theme.border} ${theme.badge} px-2 py-2 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)]`}>
            <h3 className="truncate font-serif text-[15px] font-black leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">{card.name}</h3>
            <span className={`font-mono text-[9px] font-black uppercase tracking-[0.18em] ${theme.text}`}>{theme.label}</span>
          </div>
          <div className={`relative mb-2 flex h-[74px] w-full flex-col items-center justify-center overflow-hidden rounded-[12px] border ${theme.border} bg-black/26 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.wash} opacity-80`}></div>
            <div className={`relative z-10 ${theme.text} drop-shadow-[0_0_16px_rgba(255,255,255,0.16)]`}>{image}</div>
            <span className="absolute bottom-1 right-1 rounded-full border border-white/10 bg-black/42 px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-[0.12em] text-white/45">{theme.short}</span>
          </div>
          <div className="relative z-10 flex flex-1 items-center justify-center rounded-[12px] border border-white/10 bg-black/24 px-2 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <p className="line-clamp-4 text-[13px] font-bold leading-snug text-white/82">{card.mechanics_text}</p>
          </div>
        </div>
      </div>
      <div className={`absolute -left-1 -top-1 z-30 flex h-9 w-9 items-center justify-center rounded-[10px] border ${theme.border} ${theme.badge} shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md`}><span className={`font-serif text-xl font-black ${theme.text}`}>{card.energy_cost}</span></div>
      {disabled ? <div className="absolute inset-0 z-40 flex items-end justify-center rounded-[16px] bg-black/60 pb-4 backdrop-blur-[2px]"><div className="pointer-events-none rounded-full border border-white/12 bg-black/78 px-3 py-1 text-xs font-semibold text-gray-200"><span>Not enough Energy</span></div></div> : null}
    </div>
  );
}

export default App;
