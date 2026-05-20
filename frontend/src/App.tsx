import { type ReactNode, useRef, useState } from 'react';
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
import { endPlayerTurn, playCard } from './game/combatEngine';
import { claimBattleReward, chooseNode, completeNonBattleNode, createInitialRunState, isNodeAvailable, resetRun, type RunNodeType } from './game/runEngine';
import { runtimeRoster } from './game/roster';
import { DEFAULT_SETTINGS, loadRunSnapshot, saveRunSnapshot, updateSettings } from './game/settings';
import type { RuntimeCard } from './game/runtimeTypes';

const nodeIcons: Record<RunNodeType, ReactNode> = {
  battle: <Sword className="w-4 h-4" />,
  elite: <Skull className="w-4 h-4" />,
  rest: <Coffee className="w-4 h-4" />,
  event: <HelpCircle className="w-4 h-4" />,
  boss: <Crown className="w-4 h-4" />,
};

const cardArt = [
  <BookOpen className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <Search className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <PenTool className="w-14 h-14 text-[#8A795D] stroke-1" />,
  <BookMarked className="w-14 h-14 text-[#8A795D] stroke-[1.5]" />,
  <div className="flex gap-1"><Sword className="w-10 h-10 text-gray-500" /><Sword className="w-10 h-10 text-gray-500" /></div>,
];

type GameWindow = 'map' | 'commands' | 'log' | 'player' | 'enemy' | 'inventory' | 'synergies' | 'lore' | 'gallery' | null;

export function App() {
  const starterCharacter = runtimeRoster[0];
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [run, setRun] = useState(() => createRunWithRoster(starterCharacter));
  const [selectedEnemyId, setSelectedEnemyId] = useState(run.combat?.enemies[0]?.id);
  const [intelEnemyId, setIntelEnemyId] = useState<string | null>(null);
  const [openWindow, setOpenWindow] = useState<GameWindow>(null);
  const currentCharacter = run.party[0];
  const combat = run.combat;
  const livingEnemies = combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [];
  const selectedEnemy = combat?.enemies.find((enemy) => enemy.id === selectedEnemyId) ?? combat?.enemies[0];
  const hand = combat?.hand ?? run.deck.slice(0, 5);
  const recruitChoices = run.reserveRoster.filter((character) => !run.party.some((partyMember) => partyMember.id === character.id)).slice(0, 3);
  const canEndTurn = Boolean(combat && combat.phase === 'player');

  const save = () => setSavedSnapshot(saveRunSnapshot(run));
  const load = () => {
    const restored = savedSnapshot ? loadRunSnapshot(savedSnapshot) : null;
    if (restored) {
      setRun(restored);
      setSelectedEnemyId(restored.combat?.enemies[0]?.id);
    }
  };
  const toggleSettings = () => setSettings(updateSettings(settings, { showTutorial: !settings.showTutorial, compactCards: !settings.compactCards }));
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
    setRun({ ...run, combat: result.state, phase: result.state.phase === 'lost' ? 'lost' : run.phase });
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
      setRun({ ...run, combat: endPlayerTurn(combat) });
    }
  };

  return (
    <main className="relative flex h-screen w-screen max-w-full flex-col overflow-hidden bg-[#0B1020] p-4 font-sans selection:bg-white/20 box-border">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.14),transparent_24%),radial-gradient(circle_at_78%_4%,rgba(148,163,184,0.13),transparent_22%),radial-gradient(circle_at_52%_92%,rgba(255,255,255,0.085),transparent_34%)]"></div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <Header
          characterName={currentCharacter.name}
          deckCount={run.deck.length}
          artifactCount={run.artifacts.length}
          nodeCount={`${run.completedNodeIds.length + 1} / ${run.map.length}`}
          onLoad={load}
          onReset={() => {
            const next = resetRunWithRoster(run);
            setRun(next);
            setSelectedEnemyId(next.combat?.enemies[0]?.id);
          }}
          onSave={save}
          onSettings={toggleSettings}
          savedSnapshot={savedSnapshot}
        />
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_292px] gap-4 overflow-hidden">
          <CenterPanel
            combat={combat}
            currentCharacter={currentCharacter}
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
            settingsCompact={settings.compactCards}
          />
          <CommandDock
            combat={combat}
            phase={combat?.phase ?? run.phase}
            primaryDisabled={run.phase === 'map' || (Boolean(combat) && !canEndTurn && combat?.phase !== 'won')}
            run={run}
            showTutorial={settings.showTutorial}
            onEventChoice={(choiceId) => setRun(applySynergyRules(applyEventChoice(run, choiceId)))}
            onOpenWindow={setOpenWindow}
            onPrimaryAction={primaryAction}
          />
          <GameWindowOverlay
            activeWindow={openWindow}
            character={currentCharacter}
            combat={combat}
            intelEnemy={combat?.enemies.find((enemy) => enemy.id === intelEnemyId) ?? selectedEnemy}
            roster={runtimeRoster}
            run={run}
            onArtifact={() => setRun(applySynergyRules({ ...run, artifacts: [ARTIFACTS[0], ...run.artifacts] }))}
            onClose={() => setOpenWindow(null)}
            onChooseNode={(nodeId) => {
              chooseMapNode(nodeId);
              setOpenWindow(null);
            }}
            onEventChoice={(choiceId) => setRun(applySynergyRules(applyEventChoice(run, choiceId)))}
            onPrimaryAction={primaryAction}
            onScan={() => setRun(applySynergyRules(run))}
          />
        </div>
      </div>
    </main>
  );
}

function createRunWithRoster(starterCharacter: typeof runtimeRoster[number]) {
  return {
    ...createInitialRunState(starterCharacter),
    reserveRoster: runtimeRoster.filter((character) => character.id !== starterCharacter.id),
  };
}

function resetRunWithRoster(run: ReturnType<typeof createInitialRunState>) {
  return {
    ...resetRun(run),
    reserveRoster: runtimeRoster.filter((character) => character.id !== run.party[0].id),
  };
}

function Header({ characterName, deckCount, artifactCount, nodeCount, savedSnapshot, onSave, onLoad, onSettings, onReset }: {
  characterName: string;
  deckCount: number;
  artifactCount: number;
  nodeCount: string;
  savedSnapshot: string | null;
  onSave: () => void;
  onLoad: () => void;
  onSettings: () => void;
  onReset: () => void;
}) {
  return (
    <header className="relative z-40 flex h-[88px] w-full flex-shrink-0 items-center justify-center overflow-visible bg-transparent px-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.10),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(148,163,184,0.08),transparent_22%)]"></div>
      <div className="relative grid w-full max-w-7xl grid-cols-[minmax(220px,0.85fr)_minmax(360px,1.25fr)_minmax(320px,0.95fr)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3 rounded-[13px] bg-black/34 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] border border-white/12 bg-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]">
            <BookOpen className="h-5 w-5 text-white/88 stroke-[1.35]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/72 shadow-[0_0_18px_rgba(255,255,255,0.55)]"></span>
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.22em] text-white/38">Archive run</span>
            </div>
            <h1 className="truncate font-serif text-2xl font-black tracking-tight text-white">Roguepedia</h1>
            <p className="truncate text-[11px] font-medium text-white/48">{characterName}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 rounded-[13px] bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <HeaderStat label="Act" value="1" />
          <HeaderStat label="Node" value={nodeCount} />
          <HeaderStat label="Deck" value={String(deckCount)} />
          <HeaderStat label="Relics" value={String(artifactCount)} />
        </div>

        <div className="grid grid-cols-4 gap-1.5 rounded-[13px] bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <HeaderButton icon={<Save className="h-3.5 w-3.5" />} label="Save" onClick={onSave} />
          <HeaderButton disabled={!savedSnapshot} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load" onClick={onLoad} />
          <HeaderButton icon={<Settings className="h-3.5 w-3.5" />} label="Tune" onClick={onSettings} />
          <HeaderButton icon={<ChevronRight className="h-3.5 w-3.5" />} label="Reset" onClick={onReset} />
        </div>
      </div>
    </header>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[10px] border border-white/8 bg-white/[0.045] px-3 py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)]"><span className="block font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/38">{label}</span><span className="mt-0.5 block truncate font-mono text-base font-semibold leading-tight text-white tabular-nums">{value}</span></div>;
}

function HeaderButton({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button className="group flex items-center justify-between gap-2 rounded-[10px] border border-white/8 bg-white/[0.045] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/66 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:translate-y-0 disabled:opacity-35"><span className="truncate">{label}</span><span className="grid h-6 w-6 place-items-center rounded-[8px] bg-white/[0.08] text-white/72 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">{icon}</span></button>;
}

function MapPanel({ run, onChooseNode }: { run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNode = run.map.flat().find((node) => node.id === hoveredNodeId) ?? null;

  return (
    <div className="relative flex h-full min-h-[68vh] w-full flex-col overflow-hidden bg-black/24 text-gray-200 shadow-none backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><MapIcon className="h-4 w-4 text-white/55" /><h2 className="font-serif text-lg text-white">Route</h2></div><HelpCircle className="h-4 w-4 cursor-pointer text-white/35" /></div>
        <div className="mt-3 grid grid-cols-5 border border-white/10 text-center font-mono text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
          <Legend icon={<Sword className="h-3.5 w-3.5 text-gray-400" />} label="Battle" />
          <Legend icon={<Skull className="h-3.5 w-3.5 text-orange-300/70" />} label="Elite" />
          <Legend icon={<Coffee className="h-3.5 w-3.5 text-emerald-200/70" />} label="Rest" />
          <Legend icon={<HelpCircle className="h-3.5 w-3.5 text-purple-200/70" />} label="Event" />
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
      <div className="grid grid-cols-[1fr_auto] items-center border-t border-white/10 bg-black/28 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
        <span>Draw pile</span>
        <span className="text-sm font-semibold text-white tabular-nums">{run.deck.length}</span>
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

function CommandDock({ combat, phase, primaryDisabled, run, showTutorial, onEventChoice, onOpenWindow, onPrimaryAction }: {
  combat: ReturnType<typeof createInitialRunState>['combat'];
  phase: string;
  primaryDisabled: boolean;
  run: ReturnType<typeof createInitialRunState>;
  showTutorial: boolean;
  onEventChoice: (choiceId: string) => void;
  onOpenWindow: (window: Exclude<GameWindow, null>) => void;
  onPrimaryAction: () => void;
}) {
  const energy = combat?.energy ?? 3;
  const maxEnergy = combat?.maxEnergy ?? 3;
  const primaryLabel = combat?.phase === 'won' ? 'Choose Reward' : phase === 'rest' ? 'Rest and Upgrade' : phase === 'event' ? 'Continue' : 'End Turn';
  const quickEventChoice = EVENT_CHOICES[0];

  return (
    <aside className="z-20 flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#11182A]/86 p-1.5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_22px_70px_rgba(0,0,0,0.30)]">
      <div className="rounded-[16px] bg-black/34 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-white/42">{showTutorial ? 'Hint active' : 'Run phase'}</span>
        <p className="mt-1 truncate font-serif text-lg font-black text-white">{phase}</p>
      </div>
      <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 py-3">
        <div className="overflow-hidden rounded-[16px] border border-white/10 bg-black/24 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <DockButton icon={<MapIcon className="h-4 w-4" />} label="Map" meta={`${run.completedNodeIds.length}/${run.map.length}`} onClick={() => onOpenWindow('map')} />
          <DockButton icon={<Archive className="h-4 w-4" />} label="Inventory" meta={`${run.artifacts.length} relics`} onClick={() => onOpenWindow('inventory')} />
          <DockButton icon={<Sparkles className="h-4 w-4" />} label="Synergy" meta={`${run.activeSynergies.length} active`} onClick={() => onOpenWindow('synergies')} />
          <DockButton icon={<BookOpen className="h-4 w-4" />} label="Lore" meta={run.party[0]?.name ?? 'Hero'} onClick={() => onOpenWindow('lore')} />
          <DockButton icon={<Library className="h-4 w-4" />} label="Gallery" meta={`${run.reserveRoster.length + run.party.length} seen`} onClick={() => onOpenWindow('gallery')} />
          <DockButton icon={<Feather className="h-4 w-4" />} label="Log" meta={`${combat?.log.length ?? run.summary.length} notes`} onClick={() => onOpenWindow('log')} />
          <DockButton icon={<Settings className="h-4 w-4" />} label="Commands" meta={run.phase === 'event' ? 'event' : `${energy}/${maxEnergy} energy`} onClick={() => onOpenWindow('commands')} />
        </div>
        {run.phase === 'event' && quickEventChoice ? <button className="mt-3 w-full border border-white/12 bg-white/[0.055] px-3 py-3 text-left text-xs font-semibold text-white/72 transition hover:bg-white/10" onClick={() => onEventChoice(quickEventChoice.id)}>{quickEventChoice.title}</button> : null}
      </div>
      <div className="rounded-[16px] bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <EnergyMeter energy={energy} maxEnergy={maxEnergy} />
        <button className="mt-3 w-full bg-white px-5 py-3 font-serif text-base font-black text-black transition hover:bg-white/88 active:bg-white/75 disabled:bg-white/20 disabled:text-white/35" disabled={primaryDisabled} onClick={onPrimaryAction}>{primaryLabel}</button>
      </div>
    </aside>
  );
}

function DockButton({ icon, label, meta, onClick }: { icon: ReactNode; label: string; meta: string; onClick: () => void }) {
  return <button className="group grid w-full grid-cols-[28px_1fr] items-center gap-2 rounded-[10px] px-3 py-2.5 text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-white/[0.09] active:scale-[0.98] active:bg-white/[0.13]" onClick={onClick}><span className="grid h-7 w-7 place-items-center rounded-[8px] bg-white/[0.07] text-white/70 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">{icon}</span><span className="min-w-0"><span className="block text-xs font-semibold text-white">{label}</span><span className="block truncate font-mono text-[8px] uppercase tracking-[0.14em] text-white/42">{meta}</span></span></button>;
}

function EnergyMeter({ energy, maxEnergy }: { energy: number; maxEnergy: number }) {
  return <div className="flex items-center gap-1.5 px-1">{Array.from({ length: maxEnergy }).map((_, index) => <div key={index} className={`h-8 w-3 border border-white/20 ${index < energy ? 'bg-white/80 shadow-[0_0_16px_rgba(255,255,255,0.28)]' : 'bg-white/10'}`}></div>)}<span className="ml-1 font-mono text-xs font-black text-white">{energy}/{maxEnergy}</span></div>;
}

function WindowButton({ icon, label, meta, onClick }: { icon: ReactNode; label: string; meta: string; onClick: () => void }) {
  return <button className="grid w-full grid-cols-[24px_1fr] items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[0.09] active:bg-white/[0.12]" onClick={onClick}>{icon}<span className="min-w-0"><span className="block text-xs font-semibold text-white">{label}</span><span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/42">{meta}</span></span></button>;
}

function GameWindowOverlay({ activeWindow, character, combat, intelEnemy, roster, run, onArtifact, onChooseNode, onClose, onEventChoice, onPrimaryAction, onScan }: {
  activeWindow: GameWindow;
  character: typeof runtimeRoster[number];
  combat: ReturnType<typeof createInitialRunState>['combat'];
  intelEnemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] | undefined;
  roster: typeof runtimeRoster;
  run: ReturnType<typeof createInitialRunState>;
  onArtifact: () => void;
  onChooseNode: (nodeId: string) => void;
  onClose: () => void;
  onEventChoice: (choiceId: string) => void;
  onPrimaryAction: () => void;
  onScan: () => void;
}) {
  if (!activeWindow) {
    return null;
  }

  const title = windowTitle(activeWindow);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-white/16 bg-[#070A0F]/96 text-white shadow-[0_28px_90px_rgba(0,0,0,0.46)]">
        <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 bg-white/[0.035] px-4 py-3">
          <div className="min-w-0">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/42">Workspace</span>
            <h2 className="truncate font-serif text-2xl font-black">{title}</h2>
          </div>
          <button className="border border-white/16 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12" onClick={onClose}>Close</button>
        </div>
        <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {activeWindow === 'map' ? <MapWindow run={run} onChooseNode={onChooseNode} /> : null}
          {activeWindow === 'commands' ? <CommandsWindow combat={combat} phase={combat?.phase ?? run.phase} run={run} onEventChoice={onEventChoice} onPrimaryAction={onPrimaryAction} /> : null}
          {activeWindow === 'log' ? <LogWindow combat={combat} run={run} /> : null}
          {activeWindow === 'player' ? <PlayerIntelWindow character={character} player={combat?.player} /> : null}
          {activeWindow === 'enemy' && intelEnemy ? <EnemyIntelWindow enemy={intelEnemy} intent={combat?.enemyIntent[intelEnemy.id] ?? 7} /> : null}
          {activeWindow === 'inventory' ? <InventoryWindow run={run} onArtifact={onArtifact} /> : null}
          {activeWindow === 'synergies' ? <SynergyWindow run={run} onScan={onScan} /> : null}
          {activeWindow === 'lore' ? <CharacterSheet character={character} /> : null}
          {activeWindow === 'gallery' ? <GalleryPanel roster={roster} run={run} /> : null}
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
    synergies: 'Synergies',
    lore: 'Character Lore',
    gallery: 'Wiki Gallery',
  };
  return titles[activeWindow];
}

function MapWindow({ run, onChooseNode }: { run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void }) {
  return (
    <div className="grid min-h-[68vh] grid-cols-[minmax(0,1fr)_280px] gap-4">
      <div className="min-h-0 border border-white/12 bg-white/[0.035]">
        <MapPanel run={run} onChooseNode={onChooseNode} />
      </div>
      <Panel title="Route Brief">
        <div className="space-y-3 text-sm text-white/62">
          <p>Choose an available glowing node to move the run forward. Battles lead to recruit rewards, while events and rest nodes resolve through command choices.</p>
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

function PlayerIntelWindow({ character, player }: { character: typeof runtimeRoster[number]; player: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['player'] | undefined }) {
  return <div className="grid grid-cols-[0.9fr_1.1fr] gap-4"><PlayerIntelCard character={character} player={player} /><CharacterSheet character={character} /></div>;
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

function GalleryPanel({ roster, run }: { roster: typeof runtimeRoster; run: ReturnType<typeof createInitialRunState> }) {
  const [selectedId, setSelectedId] = useState(roster[0]?.id ?? '');
  const selected = roster.find((character) => character.id === selectedId) ?? roster[0];
  const partyIds = new Set(run.party.map((character) => character.id));
  const reserveIds = new Set(run.reserveRoster.map((character) => character.id));

  return (
    <div className="grid min-h-0 grid-cols-[minmax(320px,0.8fr)_1.2fr] gap-4">
      <Panel title={`Gallery (${roster.length})`}>
        <div className="glass-scrollbar max-h-[62vh] overflow-y-auto border border-white/10">
          <div className="grid grid-cols-[56px_1fr_104px] border-b border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
            <span>Img</span><span>Name</span><span>Status</span>
          </div>
          {roster.map((character) => {
            const status = partyIds.has(character.id) ? 'Party' : reserveIds.has(character.id) ? 'Recruitable' : 'Seen';
            return (
              <button className={`grid w-full grid-cols-[56px_1fr_104px] items-center border-b border-white/10 px-3 py-2 text-left transition hover:bg-white/[0.08] ${selected?.id === character.id ? 'bg-white/[0.12] text-white' : 'text-white/80'}`} key={character.id} onClick={() => setSelectedId(character.id)}>
                {character.source.image_url ? <img className="h-9 w-9 border border-white/15 object-cover object-top" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <BookMarked className="h-8 w-8 text-white" />}
                <strong className="truncate font-serif text-sm text-white">{character.name}</strong>
                <span className="font-mono text-[8px] font-black uppercase tracking-widest text-white/45">{status}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      {selected ? <CharacterSheet character={selected} /> : null}
    </div>
  );
}

function CharacterSheet({ character }: { character: typeof runtimeRoster[number] }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title={`${character.name} Sheet`}>
        <div className="flex items-start gap-3 mb-3">
          {character.source.image_url ? <img className="h-16 w-16 border border-white/15 object-cover object-top" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <BookMarked className="w-8 h-8 text-white flex-shrink-0" />}
          <div>
            <p className="text-xs text-white/60 leading-relaxed">{character.short_lore || character.lore}</p>
            <div className="mt-2 flex flex-wrap gap-1">{character.tags.slice(0, 4).map((tag) => <span className="border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60" key={tag}>{tag}</span>)}</div>
          </div>
        </div>
        <a className="text-xs font-semibold text-white/75 hover:text-white hover:underline" href={character.source.wikidata_url} rel="noreferrer" target="_blank">Read source</a>
      </Panel>
      <Panel title="Stats">
        <div className="grid grid-cols-3 gap-2">{Object.entries(character.stats).map(([stat, value], index) => <StatRune key={stat} label={stat} value={String(value)} tone={statTone(index)} />)}</div>
      </Panel>
      <Panel title={`Cards (${character.cards.length})`}>
        <div className="border border-white/10">{character.cards.map((card) => <CardSummary card={card} key={card.id} />)}</div>
      </Panel>
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
  const glow = tone === 'red' ? 'shadow-white/10' : tone === 'blue' ? 'shadow-slate-200/10' : tone === 'green' ? 'shadow-emerald-100/10' : 'shadow-white/10';
  return (
    <div className={`grid min-h-10 grid-cols-[1fr_auto] items-center gap-2 border border-white/15 bg-white/[0.08] px-2 py-1 text-left shadow-lg ${glow} backdrop-blur-md`} title={label}>
      <span className="truncate font-mono text-[8px] font-black uppercase tracking-widest text-white/60">{statLabel(label)}</span>
      <span className="font-mono text-sm font-black text-white">{value}</span>
    </div>
  );
}

function CardSummary({ card }: { card: RuntimeCard }) {
  return <div className="border-b border-white/10 bg-white/[0.04] p-2 last:border-b-0"><div className="grid grid-cols-[1fr_28px] items-center gap-2"><strong className="truncate font-serif text-sm text-white">{card.name}</strong><span className="border border-white/15 bg-black/35 px-2 py-0.5 text-center text-[10px] font-bold text-white">{card.energy_cost}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{card.card_type} · {card.card_rarity}</p><p className="mt-1 text-xs leading-relaxed text-white/60">{card.mechanics_text}</p></div>;
}

function PlayerIntelCard({ character, player }: { character: typeof runtimeRoster[number]; player: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['player'] | undefined }) {
  const stats = Object.entries(character.stats).filter(([stat]) => stat !== 'hp');
  const hp = player ? `${player.hp}/${player.maxHp}` : 'Ready';
  const block = player?.block ?? 0;

  return (
    <div className="glass-panel w-full p-5 text-white">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Hero Sheet</span>
        <span className="border border-white/15 bg-white/[0.07] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/65">{character.tags[0] ?? 'Hero'}</span>
      </div>
      <h3 className="mt-2 font-serif text-2xl font-black leading-tight text-white">{character.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs italic leading-relaxed text-white/60">{character.short_lore || character.lore}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
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
      <div className="mt-4 grid grid-cols-3 gap-2">
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

function CenterPanel({ combat, currentCharacter, hand, livingEnemyCount, recruitChoices, selectedEnemy, selectedEnemyId, settingsCompact, phase, primaryDisabled, onOpenEnemyIntel, onOpenPlayerIntel, onPrimaryAction, onRecruit, onSelectEnemy, onPlayCard }: {
  combat: ReturnType<typeof createInitialRunState>['combat'];
  currentCharacter: typeof runtimeRoster[number];
  hand: RuntimeCard[];
  livingEnemyCount: number;
  recruitChoices: typeof runtimeRoster;
  selectedEnemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] | undefined;
  selectedEnemyId: string | undefined;
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
  const player = combat?.player;
  const playerHp = player ? `${player.hp} / ${player.maxHp}` : 'Ready';
  const enemyHp = selectedEnemy ? `${selectedEnemy.hp} / ${selectedEnemy.maxHp}` : 'Awaiting battle';
  const handScrollerRef = useRef<HTMLDivElement>(null);
  const slideHand = (direction: -1 | 1) => handScrollerRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#11182A]/86 p-1.5 font-sans shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-x-0 top-0 z-20 grid h-8 grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 bg-black/32 px-4 backdrop-blur-xl"><div className="h-px bg-white/10"></div><div className="flex items-center gap-2 px-4"><Sparkles className="h-3 w-3 text-white/55" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75">{phase}</span><Sparkles className="h-3 w-3 text-white/55" /></div><div className="h-px bg-white/10"></div></div>
      <GameplayBackdrop />
      <div className="absolute inset-1.5 rounded-[18px] border border-white/[0.055] pointer-events-none z-10"></div>
      <div className="absolute bottom-1.5 left-1.5 right-1.5 h-[318px] rounded-b-[18px] border-t border-white/10 bg-gradient-to-t from-[rgba(5,7,13,0.98)] via-[rgba(5,7,13,0.90)] to-transparent z-10 pointer-events-none"></div>
      <div className="relative z-20 grid h-full min-h-0 grid-rows-[minmax(260px,1fr)_290px] gap-4 px-8 pb-4 pt-10 overflow-hidden">
        <div className="min-h-0 flex items-start justify-center gap-72 px-8 pt-10 overflow-visible">
          <div className="relative flex">
            <CombatantPanel
              align="left"
              block={player?.block ?? 0}
              currentHp={player?.hp ?? 1}
              hpLabel={playerHp}
              imageUrl={currentCharacter.source.image_url}
              inspectable
              maxHp={player?.maxHp ?? 1}
              name={currentCharacter.name}
              onInspect={onOpenPlayerIntel}
            />
          </div>
          <div className="relative flex">
            <CombatantPanel
              align="right"
              block={selectedEnemy?.block ?? 0}
              currentHp={selectedEnemy?.hp ?? 1}
              hpLabel={enemyHp}
              inspectable={Boolean(selectedEnemy)}
              intent={selectedEnemy ? combat?.enemyIntent[selectedEnemy.id] : undefined}
              maxHp={selectedEnemy?.maxHp ?? 1}
              name={selectedEnemy?.name ?? 'Archive Sentry'}
              onInspect={() => selectedEnemy && onOpenEnemyIntel(selectedEnemy.id)}
            />
          </div>
        </div>
        <div className="min-h-0 w-full z-30 flex flex-col justify-center items-center pb-1 relative overflow-visible">
          <button className="glass-button absolute left-4 top-1/2 z-40 grid h-12 w-12 -translate-y-1/2 place-items-center px-0 py-0 font-mono text-2xl font-black leading-none text-white transition hover:-translate-y-[calc(50%+2px)] active:-translate-y-1/2" onClick={() => slideHand(-1)} type="button"><span className="-mt-1 block leading-none">&lt;</span></button>
          <div ref={handScrollerRef} className="glass-scrollbar absolute inset-x-20 top-0 bottom-8 overflow-x-auto overflow-y-visible scroll-smooth pt-6">
            <div className={`mx-auto flex w-max min-w-full justify-center gap-2 items-end ${settingsCompact ? 'scale-90 origin-bottom' : ''}`}>{hand.map((card, index) => <button className="disabled:cursor-not-allowed min-w-0" disabled={!combat || combat.phase !== 'player' || combat.energy < card.energy_cost || livingEnemyCount === 0} key={`${card.id}-${card.name}`} onClick={() => onPlayCard(card)}><CardItem card={card} disabled={!combat || combat.phase !== 'player' || combat.energy < card.energy_cost || livingEnemyCount === 0} image={cardArt[index % cardArt.length]} /></button>)}</div>
          </div>
          <button className="glass-button absolute right-4 top-1/2 z-40 grid h-12 w-12 -translate-y-1/2 place-items-center px-0 py-0 font-mono text-2xl font-black leading-none text-white transition hover:-translate-y-[calc(50%+2px)] active:-translate-y-1/2" onClick={() => slideHand(1)} type="button"><span className="-mt-1 block leading-none">&gt;</span></button>
          <div className="absolute inset-x-0 bottom-0 w-full text-center pointer-events-none z-10"><p className="text-gray-400 text-sm tracking-widest uppercase">Play cards to use their effects.</p></div>
        </div>
      </div>
      {combat?.enemies.length ? <div className="absolute right-8 top-16 z-30 flex justify-end gap-2">{combat.enemies.map((enemy) => <button className={`border px-3 py-1 text-xs backdrop-blur-md transition ${enemy.id === selectedEnemyId ? 'border-white/35 bg-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.16)]' : 'border-white/15 bg-black/35 text-white/65 hover:bg-white/10'}`} disabled={enemy.hp <= 0} key={enemy.id} onClick={() => onSelectEnemy(enemy.id)}>{enemy.name}</button>)}</div> : null}
      {combat?.phase === 'won' ? <RewardOverlay recruits={recruitChoices} onRecruit={onRecruit} onSkip={onPrimaryAction} /> : null}
    </div>
  );
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
    <button className="border border-white/15 bg-white/[0.07] p-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/12" onClick={onRecruit}>
      <div className="mb-2 flex items-center gap-3">
        {character.source.image_url ? <img className="h-16 w-16 border border-white/15 object-cover object-top" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <BookMarked className="h-10 w-10 text-white" />}
        <div className="min-w-0">
          <h4 className="truncate font-serif text-lg font-black text-white">{character.name}</h4>
          <p className="font-mono text-[9px] font-black uppercase tracking-widest text-white/45">+{character.cards.length} cards</p>
        </div>
      </div>
      <p className="line-clamp-3 text-xs font-semibold leading-relaxed text-white/60">{character.short_lore || character.lore}</p>
      <div className="mt-3 grid grid-cols-3 gap-1">
        <StatRune label="HP" value={String(character.stats.hp)} tone="red" />
        <StatRune label="ATK" value={String(character.stats.attack)} tone="gold" />
        <StatRune label="DEF" value={String(character.stats.defense)} tone="blue" />
      </div>
    </button>
  );
}

function GameplayBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0E1528]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.13),transparent_22%),radial-gradient(circle_at_78%_16%,rgba(148,163,184,0.10),transparent_25%),radial-gradient(circle_at_50%_82%,rgba(255,255,255,0.06),transparent_32%)]"></div>
      <div className="absolute inset-8 rounded-[22px] border border-white/[0.055]"></div>
      <div className="absolute inset-x-10 top-12 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:54px_54px] opacity-18"></div>
      <div className="absolute inset-x-12 bottom-8 h-40 rounded-[999px] bg-white/[0.035] blur-3xl"></div>
      <div className="absolute inset-0 bg-black/30"></div>
    </div>
  );
}

function CombatantPanel({ align, block, currentHp, hpLabel, imageUrl, inspectable, intent, maxHp, name, onInspect }: {
  align: 'left' | 'right';
  block: number;
  currentHp: number;
  hpLabel: string;
  imageUrl?: string | null;
  inspectable?: boolean;
  intent?: number;
  maxHp: number;
  name: string;
  onInspect?: () => void;
}) {
  const right = align === 'right';
  return (
    <button
      className={`relative flex flex-col items-center w-56 min-w-0 text-left transition ${right ? 'items-end' : 'items-start'} ${inspectable ? 'cursor-help hover:scale-[1.02]' : 'cursor-default'}`}
      disabled={!inspectable}
      onClick={onInspect}
      type="button"
    >
      <div className="w-40 h-44 relative mb-3 flex justify-center self-center">
        {imageUrl ? (
          <div className="absolute bottom-0 h-40 w-36 overflow-hidden border border-white/15 bg-white/[0.055] shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <img className="h-full w-full object-cover object-top" src={imageUrl} alt={name} referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"></div>
          </div>
        ) : (
          <FallbackEnemyFigure />
        )}
      </div>
      <div className="w-full text-center relative">
        <h2 className={`font-serif font-bold text-lg text-[#FDFBF8] drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] mb-2 truncate ${right ? 'text-right pr-2' : 'text-left pl-2'}`}>{name}</h2>
        <HealthBar current={currentHp} max={maxHp} label={hpLabel} />
        <BlockBadge value={block} align={align} />
      </div>
      <div className={`mt-3 flex ${right ? 'justify-end' : 'justify-start'}`}><GlassInfoBadge label={inspectable ? 'CLICK INTEL' : 'INTEL'} tone={right ? 'red' : 'blue'} value={right ? String(intent ?? 7) : '?'} /></div>
    </button>
  );
}

function FallbackEnemyFigure() {
  return (
    <div className="absolute bottom-0 grid h-40 w-36 place-items-center border border-white/15 bg-white/[0.055] shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md">
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

function CardItem({ card, image, disabled }: { card: RuntimeCard; image: ReactNode; disabled?: boolean }) {
  return (
    <div className={`relative h-[236px] w-[168px] flex-shrink-0 transition-transform duration-200 ${disabled ? 'translate-y-2 opacity-70' : 'z-10 cursor-pointer opacity-100 hover:z-20 hover:-translate-y-4'}`}>
      <div className="absolute inset-0 flex flex-col overflow-hidden border border-white/20 bg-white/82 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="relative z-10 mb-2 text-center"><h3 className="truncate px-2 font-serif text-[16px] font-bold leading-tight text-gray-950">{card.name}</h3><span className="font-mono text-[10px] font-black uppercase tracking-widest text-gray-500">{card.card_type}</span></div>
        <div className="relative z-10 mb-2 flex h-[72px] w-full flex-col items-center justify-center overflow-hidden border border-gray-950/10 bg-gray-950/[0.035]">{image}</div>
        <div className="relative z-10 flex flex-1 items-center justify-center px-2 text-center"><p className="line-clamp-4 text-[13.5px] font-bold leading-snug text-gray-900">{card.mechanics_text}</p></div>
      </div>
      <div className="absolute -left-1 -top-1 z-30 flex h-8 w-8 items-center justify-center border border-white/30 bg-black/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"><span className="font-serif text-lg font-bold text-white">{card.energy_cost}</span></div>
      {disabled ? <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 pb-4 backdrop-blur-[2px]"><div className="pointer-events-none bg-black/70 px-3 py-1 text-xs text-gray-200"><span>Not enough Energy</span></div></div> : null}
    </div>
  );
}

export default App;
