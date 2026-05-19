import { type ReactNode, useState } from 'react';
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
import { applyCardUpgrade, applyEventChoice, applySynergyRules, ARTIFACTS, EVENT_CHOICES } from './game/campaignContent';
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

type RightSidebarTab = 'hint' | 'artifacts' | 'synergies' | 'lore';

export function App() {
  const starterCharacter = runtimeRoster[0];
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [run, setRun] = useState(() => createRunWithRoster(starterCharacter));
  const [selectedEnemyId, setSelectedEnemyId] = useState(run.combat?.enemies[0]?.id);
  const [showMapSidebar, setShowMapSidebar] = useState(true);
  const [showContextSidebar, setShowContextSidebar] = useState(true);
  const currentCharacter = run.party[0];
  const combat = run.combat;
  const livingEnemies = combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [];
  const selectedEnemy = combat?.enemies.find((enemy) => enemy.id === selectedEnemyId) ?? combat?.enemies[0];
  const hand = combat?.hand ?? run.deck.slice(0, 5);
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
      setRun(applySynergyRules(completeNonBattleNode(applyCardUpgrade(run, run.deck[0].id))));
      return;
    }
    if (run.phase === 'event') {
      setRun(completeNonBattleNode(run));
      return;
    }
    if (combat?.phase === 'won') {
      const recruitId = run.reserveRoster.find((character) => !run.party.some((partyMember) => partyMember.id === character.id))?.id ?? starterCharacter.id;
      const next = claimBattleReward(run, recruitId);
      setRun(next);
      setSelectedEnemyId(next.combat?.enemies[0]?.id);
      return;
    }
    if (combat?.phase === 'player') {
      setRun({ ...run, combat: endPlayerTurn(combat) });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#11161D] p-2 font-sans selection:bg-blue-100 overflow-hidden box-border">
      <div className="flex flex-col flex-1 bg-rp-beige-bg overflow-hidden border-4 border-[#0B1120] shadow-[8px_8px_0_#000]">
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
        <div className="flex flex-1 overflow-hidden bg-rp-dark relative">
          <SidebarToggle
            align="left"
            expanded={showMapSidebar}
            expandedLabel="Hide map"
            collapsedLabel="Show map"
            icon={<MapIcon className="w-4 h-4" />}
            onClick={() => setShowMapSidebar(!showMapSidebar)}
          />
          <SidebarToggle
            align="right"
            expanded={showContextSidebar}
            expandedLabel="Hide codex"
            collapsedLabel="Show codex"
            icon={<Archive className="w-4 h-4" />}
            onClick={() => setShowContextSidebar(!showContextSidebar)}
          />
          {showMapSidebar ? <MapPanel run={run} onChooseNode={chooseMapNode} /> : null}
          <CenterPanel
            combat={combat}
            currentCharacter={currentCharacter}
            hand={hand}
            livingEnemyCount={livingEnemies.length}
            onPrimaryAction={primaryAction}
            onSelectEnemy={setSelectedEnemyId}
            onPlayCard={playHandCard}
            phase={combat?.phase ?? run.phase}
            primaryDisabled={run.phase === 'map' || (Boolean(combat) && !canEndTurn && combat?.phase !== 'won')}
            selectedEnemy={selectedEnemy}
            selectedEnemyId={selectedEnemyId}
            settingsCompact={settings.compactCards}
          />
          {showContextSidebar ? (
            <RightPanel
              character={currentCharacter}
              combat={combat}
              phase={combat?.phase ?? run.phase}
              primaryDisabled={run.phase === 'map' || (Boolean(combat) && !canEndTurn && combat?.phase !== 'won')}
              run={run}
              showTutorial={settings.showTutorial}
              onArtifact={() => setRun(applySynergyRules({ ...run, artifacts: [ARTIFACTS[0], ...run.artifacts] }))}
              onEventChoice={(choiceId) => setRun(applySynergyRules(applyEventChoice(run, choiceId)))}
              onPrimaryAction={primaryAction}
              onScan={() => setRun(applySynergyRules(run))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function createRunWithRoster(starterCharacter: typeof runtimeRoster[number]) {
  return {
    ...createInitialRunState(starterCharacter),
    reserveRoster: runtimeRoster.filter((character) => character.id !== starterCharacter.id),
  };
}

function SidebarToggle({ align, collapsedLabel, expanded, expandedLabel, icon, onClick }: {
  align: 'left' | 'right';
  collapsedLabel: string;
  expanded: boolean;
  expandedLabel: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  const sideClass = align === 'left'
    ? 'left-0 border-l-0 pl-2 pr-3'
    : 'right-0 border-r-0 pl-3 pr-2';
  const chevron = align === 'left'
    ? expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
    : expanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />;

  return (
    <button
      aria-label={expanded ? expandedLabel : collapsedLabel}
      className={`group absolute top-20 z-40 flex items-center gap-2 border-4 border-[#0B1120] bg-[#11161C] py-2 text-[#FDFBF8] shadow-[4px_4px_0_#000] transition hover:bg-[#1A2533] hover:text-[#D4AF37] ${sideClass}`}
      onClick={onClick}
      title={expanded ? expandedLabel : collapsedLabel}
    >
      {align === 'left' ? icon : chevron}
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37] opacity-0 transition-all duration-200 group-hover:max-w-24 group-hover:opacity-100">
        {expanded ? 'Hide' : 'Show'}
      </span>
      {align === 'left' ? chevron : icon}
    </button>
  );
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
    <header className="h-[76px] bg-[#F6E8C9] border-b-4 border-[#0B1120] flex items-center px-6 justify-between flex-shrink-0 z-10 w-full relative shadow-[0_4px_0_#D4AF37]">
      <div className="flex flex-row items-center gap-12">
        <div className="flex items-center gap-3">
          <BookOpen className="w-9 h-9 text-[#1c2a38] stroke-[1.5]" />
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#1c2a38] mt-1">Roguepedia</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#1a2533] rounded overflow-hidden flex items-center justify-center border-2 border-[#D4AF37]">
            <div className="w-full h-full bg-[#35455a] relative">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 to-transparent"></div>
              <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1C2331]"></div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold leading-tight">Character</span>
            <span className="font-serif text-xl font-semibold text-[#1c2a38] leading-tight">{characterName}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-10 items-center justify-center absolute left-1/2 -translate-x-1/2">
        <HeaderStat icon={<Library className="w-6 h-6 text-gray-600" />} label="Act" value="1" />
        <div className="h-8 w-px bg-gray-300"></div>
        <HeaderStat icon={<div className="flex gap-0.5 items-center"><div className="w-2 h-2 rounded-full bg-gray-400"></div><div className="w-4 h-0.5 bg-gray-400"></div><div className="w-3 h-3 rounded-full bg-[#1c2a38]"></div></div>} label="Node" value={nodeCount} />
        <div className="h-8 w-px bg-gray-300"></div>
        <HeaderStat icon={<Book className="w-6 h-6 text-gray-600" />} label="Deck" value={String(deckCount)} />
        <div className="h-8 w-px bg-gray-300"></div>
        <HeaderStat icon={<Settings className="w-6 h-6 text-gray-600" />} label="Artifacts" value={String(artifactCount)} />
      </div>

      <div className="flex gap-4">
        <HeaderButton icon={<Save className="w-4 h-4" />} label="Save" onClick={onSave} />
        <HeaderButton disabled={!savedSnapshot} icon={<FolderOpen className="w-4 h-4" />} label="Load" onClick={onLoad} />
        <HeaderButton icon={<Settings className="w-4 h-4" />} label="Settings" onClick={onSettings} />
        <HeaderButton icon={<ChevronRight className="w-4 h-4" />} label="Reset" onClick={onReset} />
      </div>
    </header>
  );
}

function HeaderStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3">{icon}<div className="flex flex-col items-center"><span className="text-xs text-gray-500 uppercase tracking-widest font-semibold leading-tight">{label}</span><span className="font-mono text-lg font-bold text-[#1c2a38] leading-tight">{value}</span></div></div>;
}

function HeaderButton({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button className="flex items-center gap-2 border-4 border-[#0B1120] bg-white px-4 py-2 text-sm font-black shadow-[3px_3px_0_#D4AF37] transition hover:-translate-y-0.5 hover:bg-[#F6E8C9] active:translate-y-0.5 disabled:opacity-40" disabled={disabled} onClick={onClick}>{icon} {label}</button>;
}

function MapPanel({ run, onChooseNode }: { run: ReturnType<typeof createInitialRunState>; onChooseNode: (nodeId: string) => void }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNode = run.map.flat().find((node) => node.id === hoveredNodeId) ?? null;

  return (
    <div className="w-[300px] flex-shrink-0 bg-[#252E3B] border-r-4 border-[#0B1120] flex flex-col relative text-gray-300 h-full overflow-hidden shadow-[inset_-4px_0_0_#111827]">
      <div className="flex items-center justify-between p-4 px-6 border-b border-[#354050]">
        <div className="flex items-center gap-2"><MapIcon className="w-5 h-5 text-gray-400" /><h2 className="font-serif text-lg text-white">Run Map</h2></div>
        <HelpCircle className="w-4 h-4 text-gray-500 cursor-pointer" />
      </div>
      <div className="absolute right-0 top-16 p-4 flex flex-col gap-3 z-20 pointer-events-none">
        <Legend icon={<Sword className="w-4 h-4 text-gray-500" />} label="Battle" />
        <Legend icon={<Skull className="w-4 h-4 text-orange-400" />} label="Elite" />
        <Legend icon={<Coffee className="w-4 h-4 text-green-500" />} label="Rest" />
        <Legend icon={<HelpCircle className="w-4 h-4 text-purple-400" />} label="Event" />
        <Legend icon={<Crown className="w-4 h-4 text-red-500" />} label="Boss" />
      </div>
      <div className="relative flex-1 w-full mt-4 overflow-hidden">
        <div className="absolute inset-x-8 top-3 bottom-20 rounded-full bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_55%)] blur-sm"></div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="map-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="map-path-active" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0.7" />
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
            ? 'h-11 w-11 border-2 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_0_5px_rgba(212,175,55,0.12),0_0_22px_rgba(212,175,55,0.65)] cursor-pointer bg-[#253244]'
            : completed
              ? 'h-9 w-9 border-2 border-green-500 text-green-400 shadow-[0_0_14px_rgba(34,197,94,0.35)]'
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
              {hovered ? <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-[#11161C] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] shadow-lg">{node.title}</span> : null}
            </button>
          );
        }))}
      </div>
      <div className="absolute bottom-4 right-4 z-30 w-[158px] border-4 border-[#0B1120] bg-[#11161C] p-3 shadow-[4px_4px_0_#000]">
        {hoveredNode ? <NodeInfo node={hoveredNode} run={run} /> : <div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">Node Info</span><p className="mt-1 text-xs leading-snug text-gray-400">Hover a map node to preview its type and state.</p></div>}
      </div>
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 items-center bg-[#1B222C] border border-[#354050] rounded-lg p-2 px-3 hover:bg-[#252E3B] cursor-pointer transition">
        <Book className="w-8 h-8 text-gray-400 stroke-[1]" />
        <div className="flex items-center gap-1.5 font-mono"><span className="text-white text-lg leading-none mt-1">{run.deck.length}</span></div>
        <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Draw Pile</span>
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
    return 'h-8 w-8 border-2 border-orange-500 text-orange-400 opacity-55 bg-[#1A232F]';
  }
  if (type === 'rest') {
    return 'h-8 w-8 border-2 border-green-500 text-green-400 opacity-55 bg-[#1A232F]';
  }
  if (type === 'event') {
    return 'h-8 w-8 border-2 border-purple-500 text-purple-400 opacity-55 bg-[#1A232F]';
  }
  if (type === 'boss') {
    return 'h-9 w-9 border-2 border-red-500 text-red-400 opacity-70 bg-[#251A1A]';
  }
  return 'h-8 w-8 border-2 border-gray-500 text-gray-400 opacity-55 bg-[#1A232F]';
}

function Legend({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex items-center gap-2 justify-end"><span className="text-xs font-medium text-gray-400">{label}</span>{icon}</div>;
}

function RightPanel({ character, combat, phase, primaryDisabled, run, showTutorial, onArtifact, onEventChoice, onPrimaryAction, onScan }: {
  character: typeof runtimeRoster[number];
  combat: ReturnType<typeof createInitialRunState>['combat'];
  phase: string;
  primaryDisabled: boolean;
  run: ReturnType<typeof createInitialRunState>;
  showTutorial: boolean;
  onArtifact: () => void;
  onEventChoice: (choiceId: string) => void;
  onPrimaryAction: () => void;
  onScan: () => void;
}) {
  const visibleArtifacts = (run.artifacts.length ? run.artifacts : ARTIFACTS.slice(0, 3)).slice(0, 3);
  const [activeTab, setActiveTab] = useState<RightSidebarTab>('hint');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(visibleArtifacts[0]?.id ?? null);
  const selectedArtifact = visibleArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? visibleArtifacts[0];
  const energy = combat?.energy ?? 3;
  const maxEnergy = combat?.maxEnergy ?? 3;
  const primaryLabel = combat?.phase === 'won' ? 'Choose Reward' : phase === 'rest' ? 'Rest and Upgrade' : phase === 'event' ? 'Continue' : 'End Turn';
  const logs = (combat?.log.map((entry) => entry.text) ?? ['Choose a glowing map node to begin.']).slice(0, 4);

  return (
    <div className="w-[340px] flex-shrink-0 bg-[#F5F2EB] flex flex-col border-l-4 border-[#0B1120]">
      <CombatControlPanel energy={energy} logs={logs} maxEnergy={maxEnergy} onPrimaryAction={onPrimaryAction} primaryDisabled={primaryDisabled} primaryLabel={primaryLabel} />
      <div className="flex h-16 border-b border-[#E0DACE] bg-[#1F2937] text-gray-400">
        <Tab active={activeTab === 'hint'} icon={<HelpCircle className="w-5 h-5" />} label="Hint" onClick={() => setActiveTab('hint')} />
        <Tab active={activeTab === 'artifacts'} icon={<Archive className="w-5 h-5" />} label="Artifacts" onClick={() => setActiveTab('artifacts')} />
        <Tab active={activeTab === 'synergies'} icon={<Sparkles className="w-5 h-5" />} label="Synergies" onClick={() => setActiveTab('synergies')} />
        <Tab active={activeTab === 'lore'} icon={<BookOpen className="w-5 h-5" />} label="Lore" onClick={() => setActiveTab('lore')} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {activeTab === 'hint' ? (
          <>
            {showTutorial ? <InfoCard title="Tutorial Hint" icon={<GraduationCap className="w-5 h-5 text-[#1c2a38]" />} body="Choose a glowing map node, play affordable cards, then end turn. Gold actions are the next safe step." /> : null}
            {run.phase === 'event' ? (
              <Panel title="Event Choices">
                <div className="flex flex-col gap-2">{EVENT_CHOICES.map((choice) => <button className="text-left text-xs bg-white border border-[#D5CDBD] rounded-lg p-2 hover:border-[#D4AF37]" key={choice.id} onClick={() => onEventChoice(choice.id)}><strong>{choice.title}</strong><br />{choice.effect}</button>)}</div>
              </Panel>
            ) : null}
          </>
        ) : null}
        {activeTab === 'artifacts' ? (
          <Panel title={`Artifacts (${run.artifacts.length})`} action={run.artifacts.length >= 1 ? undefined : onArtifact} actionLabel="Take">
            <div className="flex gap-3 justify-between mb-4">
              {visibleArtifacts.map((artifact, index) => (
                <ArtifactItem
                  artifact={artifact}
                  icon={[<Book className="w-8 h-8 text-[#D4AF37] stroke-[1.5]" />, <Feather className="w-8 h-8 text-[#D4AF37] stroke-[1.5]" />, <Fingerprint className="w-8 h-8 text-[#D4AF37] stroke-[1.2]" />][index]}
                  key={`${artifact.id}-${index}`}
                  onSelect={() => setSelectedArtifactId(artifact.id)}
                  selected={selectedArtifact?.id === artifact.id}
                />
              ))}
            </div>
            {selectedArtifact ? <ArtifactDetail artifact={selectedArtifact} acquired={run.artifacts.some((artifact) => artifact.id === selectedArtifact.id)} /> : null}
          </Panel>
        ) : null}
        {activeTab === 'synergies' ? (
          <Panel title="Active Synergies" action={onScan} actionLabel="Scan">
            <div className="flex flex-col gap-3 mb-4">{run.activeSynergies.length ? run.activeSynergies.map((synergy) => <SynergyItem key={synergy.archetype} title={synergy.archetype} body={synergy.description} />) : <p className="text-xs text-[#4A5568]">No active synergy yet.</p>}</div>
          </Panel>
        ) : null}
        {activeTab === 'lore' ? <CharacterSheet character={character} /> : null}
      </div>
    </div>
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
    <div className="border-b-4 border-[#0B1120] bg-[#EEE6D8] p-4 shadow-[0_4px_0_#D4AF37]">
      <div className="border-4 border-[#0B1120] bg-[#F6F4EB] p-3 shadow-[4px_4px_0_#D4AF37]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8A6A4B]">Battle Log</span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxEnergy }).map((_, index) => <div key={index} className={`h-5 w-5 border-2 border-[#111827] ${index < energy ? 'bg-[#D4AF37]' : 'bg-[#2D2D2D]'}`}></div>)}
            <span className="border-2 border-[#111827] bg-white px-2 py-0.5 font-mono text-xs font-black text-[#111]">{energy}/{maxEnergy}</span>
          </div>
        </div>
        <div className="mt-3 flex min-h-[72px] flex-col gap-1 text-xs leading-relaxed text-gray-700">
          {logs.map((entry, index) => <div className="flex items-start gap-1.5" key={`${entry}-${index}`}><ChevronRight className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-[#8A6A4B]" /><span className="line-clamp-2">{entry}</span></div>)}
        </div>
        <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 border-4 border-[#0B1120] bg-[#6B725C] font-serif text-lg font-black text-white shadow-[4px_4px_0_#111827] transition hover:-translate-y-0.5 hover:bg-[#585E4B] active:translate-y-0.5 disabled:opacity-40" disabled={primaryDisabled} onClick={onPrimaryAction}>{primaryLabel} <ChevronRight className="w-5 h-5" /></button>
      </div>
    </div>
  );
}

function Tab({ active, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`flex-1 flex flex-col items-center justify-center gap-1 border-r-4 border-[#0B1120] transition relative ${active ? 'bg-[#F5F2EB] text-[#1c2a38] shadow-[inset_0_4px_0_#D4AF37]' : 'bg-[#1F2937] hover:bg-[#111827] hover:text-white'}`} onClick={onClick}>{icon}<span className="text-xs font-black">{label}</span></button>;
}

function Panel({ title, children, action, actionLabel }: { title: string; children: ReactNode; action?: () => void; actionLabel?: string }) {
  return <div className="bg-[#FAF9F5] border-4 border-[#0B1120] p-4 shadow-[4px_4px_0_#D4AF37] flex flex-col"><div className="flex items-center justify-between mb-3"><h3 className="font-serif font-black text-[#1c2a38] text-lg">{title}</h3>{action ? <button className="border-2 border-[#0B1120] bg-[#F6E8C9] px-2 py-1 text-xs font-black text-[#1c2a38] shadow-[2px_2px_0_#D4AF37]" onClick={action}>{actionLabel}</button> : null}</div>{children}</div>;
}

function InfoCard({ title, icon, body }: { title: string; icon: ReactNode; body: string }) {
  return <div className="bg-[#FAF9F5] border-4 border-[#0B1120] p-4 shadow-[4px_4px_0_#D4AF37] flex flex-col"><div className="flex items-center gap-2 mb-3">{icon}<h3 className="font-serif font-black text-[#1c2a38] text-lg">{title}</h3></div><p className="text-sm text-[#4A5568] leading-relaxed mb-4">{body}</p><div className="flex justify-between items-center text-gray-500 mt-auto"><span className="text-xs font-mono">(1 / 7)</span><div className="flex gap-2"><button className="border-2 border-[#0B1120] p-1 opacity-30"><ChevronLeft className="w-4 h-4" /></button><button className="border-2 border-[#0B1120] p-1 hover:bg-[#F6E8C9]"><ChevronRight className="w-4 h-4" /></button></div></div></div>;
}

function CharacterSheet({ character }: { character: typeof runtimeRoster[number] }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title={`${character.name} Sheet`}>
        <div className="flex items-start gap-3 mb-3">
          {character.source.image_url ? <img className="h-16 w-16 rounded-lg border border-[#D5CDBD] object-cover object-top" src={character.source.image_url} alt={character.name} referrerPolicy="no-referrer" /> : <BookMarked className="w-8 h-8 text-[#1c2a38] flex-shrink-0" />}
          <div>
            <p className="text-xs text-[#4A5568] leading-relaxed">{character.short_lore || character.lore}</p>
            <div className="mt-2 flex flex-wrap gap-1">{character.tags.slice(0, 4).map((tag) => <span className="rounded bg-[#EADDCD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#8A6A4B]" key={tag}>{tag}</span>)}</div>
          </div>
        </div>
        <a className="text-xs text-blue-700 font-semibold hover:underline" href={character.source.wikidata_url} rel="noreferrer" target="_blank">Read source</a>
      </Panel>
      <Panel title="Stats">
        <div className="grid grid-cols-3 gap-2">{Object.entries(character.stats).map(([stat, value], index) => <StatRune key={stat} label={stat} value={String(value)} tone={statTone(index)} />)}</div>
      </Panel>
      <Panel title={`Cards (${character.cards.length})`}>
        <div className="flex flex-col gap-2">{character.cards.map((card) => <CardSummary card={card} key={card.id} />)}</div>
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
  const fill = tone === 'red' ? 'bg-[#B23A2E]' : tone === 'blue' ? 'bg-[#2563EB]' : tone === 'green' ? 'bg-[#3F7D4A]' : 'bg-[#B89019]';
  return (
    <div className={`relative mx-auto grid h-14 w-14 place-items-center border-4 border-[#111827] ${fill} text-center shadow-[4px_4px_0_#0F172A]`} title={label}>
      <div className="absolute inset-1 border-2 border-white/35"></div>
      <div className="relative grid h-full place-items-center px-1 pt-1">
        <span className="font-mono text-sm font-black text-white [text-shadow:2px_2px_0_#111827]">{value}</span>
        <span className="-mt-2 max-w-[48px] truncate font-mono text-[7px] font-black uppercase tracking-widest text-white/90">{statLabel(label)}</span>
      </div>
    </div>
  );
}

function CardSummary({ card }: { card: RuntimeCard }) {
  return <div className="rounded-lg border border-[#D5CDBD] bg-white/70 p-2"><div className="flex items-center justify-between gap-2"><strong className="font-serif text-sm text-[#1c2a38]">{card.name}</strong><span className="rounded bg-[#1A2533] px-2 py-0.5 text-[10px] font-bold text-[#D4AF37]">{card.energy_cost}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#8A6A4B]">{card.card_type} · {card.card_rarity}</p><p className="mt-1 text-xs leading-relaxed text-[#4A5568]">{card.mechanics_text}</p></div>;
}

function PlayerIntelCard({ character, player }: { character: typeof runtimeRoster[number]; player: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['player'] | undefined }) {
  const stats = Object.entries(character.stats).filter(([stat]) => stat !== 'hp');
  const hp = player ? `${player.hp}/${player.maxHp}` : 'Ready';
  const block = player?.block ?? 0;

  return (
    <div className="absolute left-52 -top-16 z-50 w-72 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 288 304" preserveAspectRatio="none" aria-hidden="true">
        <path d="M22 14 C54 5 234 5 266 14 L276 40 C268 82 268 222 276 264 L252 290 C196 300 92 300 36 290 L12 264 C20 218 20 86 12 40 Z" fill="#F6E8C9" stroke="#5E4A28" strokeWidth="4" />
        <path d="M34 30 C66 21 222 21 254 30 L260 46 C251 90 251 214 260 258 L242 276 C188 284 100 284 46 276 L28 258 C37 214 37 90 28 46 Z" fill="none" stroke="#B89019" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.9" />
        <path d="M44 76 H244" stroke="#8A6A4B" strokeWidth="1" opacity="0.55" />
      </svg>
      <div className="relative p-5 text-[#1c2a38]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8A6A4B]">Hero Sheet</span>
          <span className="rounded bg-[#1A2533] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">{character.tags[0] ?? 'Hero'}</span>
        </div>
        <h3 className="mt-2 font-serif text-2xl font-black leading-tight text-[#1c2a38]">{character.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs italic leading-relaxed text-[#5F4B32]">{character.short_lore || character.lore}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatRune label="HP" value={hp} tone="red" />
          <StatRune label="BLK" value={String(block)} tone="blue" />
          {stats.map(([stat, value], index) => <StatRune key={stat} label={stat} value={String(value)} tone={statTone(index)} />)}
        </div>
      </div>
    </div>
  );
}

function EnemyIntelCard({ enemy }: { enemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] }) {
  const statuses = Object.entries(enemy.statuses);
  const intent = Math.max(6, Math.floor(enemy.maxHp / 10));

  return (
    <div className="absolute -left-64 top-4 z-50 w-60 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 260" preserveAspectRatio="none" aria-hidden="true">
        <path d="M18 12 C44 4 196 4 222 12 L230 34 C224 72 224 188 230 226 L212 248 C166 256 74 256 28 248 L10 226 C16 184 16 76 10 34 Z" fill="#F6E8C9" stroke="#5E4A28" strokeWidth="4" />
        <path d="M28 26 C56 18 184 18 212 26 L216 40 C209 78 209 182 216 220 L203 236 C158 242 82 242 37 236 L24 220 C31 182 31 78 24 40 Z" fill="none" stroke="#B89019" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.9" />
        <path d="M42 70 H198" stroke="#8A6A4B" strokeWidth="1" opacity="0.55" />
      </svg>
      <div className="relative p-5 text-[#1c2a38]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8A3A2E]">Enemy Intel</span>
          <div className="flex items-center gap-1 text-[#8A1F1B]"><Sword className="w-4 h-4" /><span className="font-mono text-sm font-black">{intent}</span></div>
        </div>
        <h3 className="mt-2 font-serif text-xl font-black leading-tight text-[#1c2a38]">{enemy.name}</h3>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <EnemyRune label="HP" value={`${enemy.hp}/${enemy.maxHp}`} tone="red" />
          <EnemyRune label="BLK" value={String(enemy.block)} tone="blue" />
          <EnemyRune label="ATK" value={String(intent)} tone="gold" />
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8A6A4B]"><Skull className="w-3.5 h-3.5" /> Status</div>
          {statuses.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">{statuses.map(([status, value]) => <span className="border border-[#5E4A28] bg-[#1A2533] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]" key={status}>{status} {value}</span>)}</div>
          ) : <p className="mt-2 text-xs italic leading-relaxed text-[#5F4B32]">No active statuses. Apply debuffs or marks to change this fight.</p>}
        </div>
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
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{node.type}</span>
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
      <div className={`w-16 h-16 bg-[#1A2533] rounded flex items-center justify-center border-2 shadow-inner relative overflow-hidden transition ${selected ? 'border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.35)]' : 'border-[#1A2533] group-hover:border-[#D4AF37]'}`}>
        <div className="absolute inset-0 border border-[#445566] rounded m-0.5 pointer-events-none group-hover:border-[#D4AF37]"></div>{icon}
      </div>
      <span className="text-[10px] font-semibold text-center text-[#1c2a38] leading-tight">{artifact.name}</span>
    </button>
  );
}

function ArtifactDetail({ artifact, acquired }: { artifact: ReturnType<typeof createInitialRunState>['artifacts'][number]; acquired: boolean }) {
  return (
    <div className="rounded-lg border border-[#D5CDBD] bg-white/70 p-3 text-left shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <strong className="font-serif text-sm text-[#1c2a38]">{artifact.name}</strong>
        <span className="rounded bg-[#1A2533] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">{acquired ? 'Owned' : 'Preview'}</span>
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#8A6A4B]">{artifact.archetype}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#4A5568]">{artifact.description}</p>
    </div>
  );
}

function SynergyItem({ title, body }: { title: string; body: string }) {
  return <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-[#EADDCD] flex items-center justify-center flex-shrink-0 mt-0.5"><BookOpen className="w-4 h-4 text-[#8A6A4B]" /></div><div className="flex flex-col"><span className="text-sm font-bold text-[#1c2a38]">{title}</span><span className="text-xs text-[#4A5568] mt-0.5">{body}</span></div></div>;
}

function CenterPanel({ combat, currentCharacter, hand, livingEnemyCount, selectedEnemy, selectedEnemyId, settingsCompact, phase, primaryDisabled, onPrimaryAction, onSelectEnemy, onPlayCard }: {
  combat: ReturnType<typeof createInitialRunState>['combat'];
  currentCharacter: typeof runtimeRoster[number];
  hand: RuntimeCard[];
  livingEnemyCount: number;
  selectedEnemy: NonNullable<ReturnType<typeof createInitialRunState>['combat']>['enemies'][number] | undefined;
  selectedEnemyId: string | undefined;
  settingsCompact: boolean;
  phase: string;
  primaryDisabled: boolean;
  onPrimaryAction: () => void;
  onSelectEnemy: (enemyId: string) => void;
  onPlayCard: (card: RuntimeCard) => void;
}) {
  const player = combat?.player;
  const playerHp = player ? `${player.hp} / ${player.maxHp}` : 'Ready';
  const enemyHp = selectedEnemy ? `${selectedEnemy.hp} / ${selectedEnemy.maxHp}` : 'Awaiting battle';
  const [inspectedEnemyId, setInspectedEnemyId] = useState<string | null>(null);
  const [inspectingPlayer, setInspectingPlayer] = useState(false);
  const inspectedEnemy = combat?.enemies.find((enemy) => enemy.id === inspectedEnemyId) ?? null;

  return (
    <div className="flex-1 min-w-0 flex flex-col relative bg-[#1E2530] overflow-hidden shadow-inner font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20"><div className="bg-[#11161C] border-b border-l border-r border-[#D4AF37] px-6 pb-1.5 pt-0 rounded-b-xl shadow-lg flex items-center gap-3"><Sparkles className="w-3 h-3 text-[#D4AF37]" /><span className="text-[#FDFBF8] font-serif font-medium text-sm tracking-widest uppercase">{phase}</span><Sparkles className="w-3 h-3 text-[#D4AF37]" /></div></div>
      <GameplayBackdrop />
      <div className="absolute bottom-0 w-full h-[340px] bg-gradient-to-t from-[rgba(15,23,42,1)] via-[rgba(15,23,42,0.88)] to-transparent z-10 pointer-events-none"></div>
      <GameplayFrame />
      <div className="relative z-20 grid h-full min-h-0 grid-rows-[minmax(260px,1fr)_310px] gap-3 px-12 pb-4 pt-12 overflow-hidden">
        <div className="min-h-0 flex justify-between items-end gap-8 px-4 overflow-hidden">
          <div className="relative" onMouseEnter={() => setInspectingPlayer(true)} onMouseLeave={() => setInspectingPlayer(false)}>
            <CombatantPanel
              align="left"
              block={player?.block ?? 0}
              currentHp={player?.hp ?? 1}
              hpLabel={playerHp}
              imageUrl={currentCharacter.source.image_url}
              inspectable
              maxHp={player?.maxHp ?? 1}
              name={currentCharacter.name}
              onInspect={() => setInspectingPlayer(true)}
            />
            {inspectingPlayer ? <PlayerIntelCard character={currentCharacter} player={player} /> : null}
          </div>
          <div className="w-56 shrink-0"></div>
          <div className="relative">
            <CombatantPanel
              align="right"
              block={selectedEnemy?.block ?? 0}
              currentHp={selectedEnemy?.hp ?? 1}
              hpLabel={enemyHp}
              inspectable={Boolean(selectedEnemy)}
              maxHp={selectedEnemy?.maxHp ?? 1}
              name={selectedEnemy?.name ?? 'Archive Sentry'}
              onInspect={() => selectedEnemy && setInspectedEnemyId(selectedEnemy.id)}
              onInspectEnd={() => setInspectedEnemyId(null)}
            />
            {inspectedEnemy ? <EnemyIntelCard enemy={inspectedEnemy} /> : null}
          </div>
        </div>
        <div className="min-h-0 w-full z-30 flex flex-col justify-center items-center pb-1 relative overflow-visible">
          <div className="w-full overflow-x-auto overflow-y-visible px-2 pb-2 pt-6">
            <div className={`mx-auto flex w-max max-w-full justify-center gap-2 items-end ${settingsCompact ? 'scale-90 origin-bottom' : ''}`}>{hand.map((card, index) => <button className="disabled:cursor-not-allowed min-w-0" disabled={!combat || combat.phase !== 'player' || combat.energy < card.energy_cost || livingEnemyCount === 0} key={`${card.id}-${card.name}`} onClick={() => onPlayCard(card)}><CardItem card={card} disabled={!combat || combat.phase !== 'player' || combat.energy < card.energy_cost || livingEnemyCount === 0} image={cardArt[index % cardArt.length]} /></button>)}</div>
          </div>
          <div className="w-full text-center pointer-events-none mt-1 z-10"><p className="text-gray-400 text-sm tracking-widest uppercase">Play cards to use their effects.</p></div>
        </div>
      </div>
      {combat?.enemies.length ? <div className="absolute right-8 top-16 z-30 flex justify-end gap-2">{combat.enemies.map((enemy) => <button className={`text-xs px-2 py-1 rounded border ${enemy.id === selectedEnemyId ? 'bg-[#D4AF37] border-[#8A6A4B]' : 'bg-white/70 border-gray-300'}`} disabled={enemy.hp <= 0} key={enemy.id} onClick={() => onSelectEnemy(enemy.id)}>{enemy.name}</button>)}</div> : null}
    </div>
  );
}

function GameplayBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#182033]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-[10%] top-[12%] h-[300px] w-[170px] border-4 border-[#111827] bg-[#2B2118] shadow-[8px_8px_0_#0B1120]"></div>
      <div className="absolute right-[10%] top-[12%] h-[300px] w-[170px] border-4 border-[#111827] bg-[#2B2118] shadow-[8px_8px_0_#0B1120]"></div>
      {Array.from({ length: 6 }).map((_, index) => <div className="absolute h-3 w-[132px] border-2 border-[#111827] bg-[#B89019]/70" key={index} style={{ left: 'calc(10% + 19px)', top: `${16 + index * 6}%` }}></div>)}
      {Array.from({ length: 6 }).map((_, index) => <div className="absolute h-3 w-[132px] border-2 border-[#111827] bg-[#B89019]/70" key={index} style={{ right: 'calc(10% + 19px)', top: `${16 + index * 6}%` }}></div>)}
      <div className="absolute left-1/2 top-[12%] h-[260px] w-[260px] -translate-x-1/2 border-4 border-[#111827] bg-[#243044] shadow-[8px_8px_0_#0B1120]"></div>
      <div className="absolute left-1/2 top-[18%] h-[140px] w-[140px] -translate-x-1/2 border-4 border-[#D4AF37]/70 bg-[#111827]/45"></div>
      <div className="absolute bottom-0 left-0 h-[38%] w-full bg-[#111827]"></div>
      <div className="absolute bottom-[30%] left-1/2 h-5 w-[72%] -translate-x-1/2 border-2 border-[#0B1120] bg-[#4A3824]"></div>
      <div className="absolute bottom-[20%] left-1/2 h-4 w-[58%] -translate-x-1/2 border-2 border-[#0B1120] bg-[#3A2C20]"></div>
      <div className="absolute bottom-[10%] left-1/2 h-4 w-[44%] -translate-x-1/2 border-2 border-[#0B1120] bg-[#2B2118]"></div>
      <div className="absolute inset-0 bg-[#0F172A]/20"></div>
    </div>
  );
}

function GameplayFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 border-4 border-[#0B1120] shadow-[inset_0_0_0_4px_#D4AF37,inset_0_0_0_8px_#3B2B13]">
      <div className="absolute left-0 top-0 h-12 w-12 border-b-4 border-r-4 border-[#0B1120] bg-[#D4AF37]"></div>
      <div className="absolute right-0 top-0 h-12 w-12 border-b-4 border-l-4 border-[#0B1120] bg-[#D4AF37]"></div>
      <div className="absolute bottom-0 left-0 h-12 w-12 border-r-4 border-t-4 border-[#0B1120] bg-[#D4AF37]"></div>
      <div className="absolute bottom-0 right-0 h-12 w-12 border-l-4 border-t-4 border-[#0B1120] bg-[#D4AF37]"></div>
      <div className="absolute left-16 top-3 h-2 w-24 bg-[#F6D77A]"></div>
      <div className="absolute right-16 top-3 h-2 w-24 bg-[#F6D77A]"></div>
      <div className="absolute bottom-3 left-16 h-2 w-24 bg-[#F6D77A]"></div>
      <div className="absolute bottom-3 right-16 h-2 w-24 bg-[#F6D77A]"></div>
    </div>
  );
}

function CombatantPanel({ align, block, currentHp, hpLabel, imageUrl, inspectable, maxHp, name, onInspect, onInspectEnd }: {
  align: 'left' | 'right';
  block: number;
  currentHp: number;
  hpLabel: string;
  imageUrl?: string | null;
  inspectable?: boolean;
  maxHp: number;
  name: string;
  onInspect?: () => void;
  onInspectEnd?: () => void;
}) {
  const right = align === 'right';
  return (
    <button
      className={`relative flex flex-col items-center w-56 min-w-0 text-left transition ${right ? 'items-end' : 'items-start'} ${inspectable ? 'cursor-help hover:scale-[1.02]' : 'cursor-default'}`}
      disabled={!inspectable}
      onBlur={onInspectEnd}
      onClick={onInspect}
      onFocus={onInspect}
      onMouseEnter={onInspect}
      onMouseLeave={onInspectEnd}
      type="button"
    >
      <div className="w-40 h-44 relative mb-3 flex justify-center self-center">
        {imageUrl ? (
          <div className="absolute bottom-0 w-36 h-40 rounded-t-3xl border-4 border-[#5E4A28] bg-[#1A2533] shadow-2xl overflow-hidden">
            <img className="h-full w-full object-cover object-top" src={imageUrl} alt={name} referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"></div>
          </div>
        ) : (
          <div className="absolute bottom-0 w-32 h-40 bg-[#BA9B53] border-4 border-[#5E4A28] rounded-full shadow-2xl flex flex-col items-center p-4">
            <div className="w-12 h-12 bg-[#DED098] rounded-full border-4 border-[#5E4A28] flex items-center justify-center mt-2 relative"><div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div></div>
            <Shield className="w-16 h-16 text-[#8B6E38] fill-[#8B6E38] absolute -right-2 top-20" />
            <div className="w-1 h-48 bg-gray-800 absolute -left-2 bottom-0"></div>
          </div>
        )}
      </div>
      <div className="w-full text-center relative">
        <h2 className={`font-serif font-bold text-lg text-[#FDFBF8] drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] mb-2 truncate ${right ? 'text-right pr-2' : 'text-left pl-2'}`}>{name}</h2>
        <HealthBar current={currentHp} max={maxHp} label={hpLabel} />
        <BlockBadge value={block} align={align} />
      </div>
      {right ? <div className="flex justify-end items-center mt-3 mr-2"><div className="flex items-center gap-2 group relative"><div className="flex items-center"><Sword className="w-5 h-5 text-red-700" /><Sword className="w-5 h-5 text-red-700 -ml-2 rotate-90" style={{ transform: 'rotateY(180deg)' }} /><span className="font-bold text-lg text-red-800 ml-1">{Math.max(6, Math.floor(maxHp / 10))}</span></div><span className="text-sm font-medium text-gray-800 bg-white/60 px-2 py-0.5 rounded">Intends to attack</span></div></div> : null}
    </button>
  );
}

function BlockBadge({ value, align }: { value: number; align: 'left' | 'right' }) {
  return (
    <div className={`mt-1 flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className="relative h-7 w-7 text-blue-600 drop-shadow-[0_0_6px_rgba(37,99,235,0.55)]">
        <svg viewBox="0 0 32 36" className="h-full w-full" aria-hidden="true">
          <path d="M16 2.5 28 7v10.5C28 25.5 23.2 31 16 34 8.8 31 4 25.5 4 17.5V7l12-4.5Z" fill="#2563EB" stroke="#FDFBF8" strokeWidth="2" />
          <path d="M16 6.5 24.5 9.7v7.7c0 5.6-3.1 9.7-8.5 12.3-5.4-2.6-8.5-6.7-8.5-12.3V9.7L16 6.5Z" fill="#1D4ED8" opacity="0.85" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-white">{value}</span>
      </div>
      <span className="rounded bg-white/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-900">Block</span>
    </div>
  );
}

function HealthBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return <div className="relative w-full h-5 bg-[#2D2D2D] rounded flex overflow-hidden border-2 border-gray-900"><div className="h-full bg-[#E53E3E]" style={{ width: `${pct}%` }}></div><div className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-bold tracking-wide drop-shadow-md">{label}</div></div>;
}

function CardItem({ card, image, disabled }: { card: RuntimeCard; image: ReactNode; disabled?: boolean }) {
  const isRed = card.card_type === 'attack';
  const borderColor = isRed ? 'border-[#8B2F24]' : 'border-[#25595C]';
  const badgeBg = isRed ? 'bg-[#B23A2E]' : 'bg-[#2A6F73]';
  const cardBg = isRed ? 'bg-[#F2D6C9]' : 'bg-[#D7E7E4]';
  return (
    <div className={`relative w-[168px] h-[236px] flex-shrink-0 transition-transform duration-200 ${disabled ? 'opacity-90 translate-y-2' : 'hover:-translate-y-4 cursor-pointer opacity-100 z-10 hover:z-20'}`}>
      <div className={`absolute inset-0 ${cardBg} border-4 ${borderColor} shadow-[6px_6px_0_#0F172A] overflow-hidden flex flex-col p-1.5`}><div className="absolute inset-2 border-2 border-white/35"></div><div className="relative z-10 text-center mb-1 mt-1"><h3 className="font-serif font-bold text-[16px] text-gray-950 leading-tight truncate px-2">{card.name}</h3><span className="font-mono text-[11px] font-black text-gray-700 uppercase tracking-widest">{card.card_type}</span></div><div className="relative z-10 w-full h-[72px] border-4 border-[#111827] bg-[#F6E8C9] mb-2 overflow-hidden flex flex-col items-center justify-center"><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:8px_8px]"></div>{image}</div><div className="relative z-10 flex-1 flex items-center justify-center text-center px-2"><p className="text-[13.5px] text-gray-900 leading-snug font-bold line-clamp-4">{card.mechanics_text}</p></div></div>
      <div className={`absolute -top-3 -left-3 w-10 h-10 border-4 border-[#111827] ${badgeBg} shadow-[3px_3px_0_#0F172A] flex items-center justify-center z-30`}><span className="text-white font-serif font-bold text-xl [text-shadow:2px_2px_0_#111827]">{card.energy_cost}</span></div>
      {disabled ? <div className="absolute inset-x-0 bottom-0 top-0 bg-black/60 z-40 rounded-xl flex items-end justify-center pb-4 backdrop-blur-[1px]"><div className="bg-black/80 px-2 py-1 rounded text-gray-200 text-xs flex items-center gap-1.5 pointer-events-none"><Save className="w-3 h-3" /><span>Not enough Energy</span></div></div> : null}
    </div>
  );
}

export default App;
