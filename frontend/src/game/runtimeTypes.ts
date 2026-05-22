export type MechanicKind =
  | 'damage'
  | 'shield'
  | 'heal'
  | 'apply_status'
  | 'remove_status'
  | 'draw_cards'
  | 'gain_energy'
  | 'buff_stat'
  | 'debuff_stat'
  | 'mark'
  | 'move_position'
  | 'revive_once'
  | 'conditional';

export type Target =
  | 'self'
  | 'selected_enemy'
  | 'selected_ally'
  | 'front_enemy'
  | 'back_enemy'
  | 'adjacent_allies'
  | 'all_enemies'
  | 'all_allies'
  | 'lowest_hp_ally'
  | 'marked_enemy';

export type CardAmount = {
  base: number;
  scaling_stat: string;
  scaling_ratio: number;
};

export type CardMechanic = {
  kind: MechanicKind;
  target: Target;
  amount: CardAmount | null;
  status: string | null;
  duration: number | null;
  condition: string | null;
};

export type RuntimeCard = {
  id: string;
  owner_character_id: string;
  name: string;
  card_type: string;
  card_rarity: string;
  energy_cost: number;
  description: string;
  mechanics_text: string;
  mechanics: CardMechanic[];
  targeting: Target | null;
  exhaust: boolean;
  upgraded: boolean;
};

export type CharacterRarity = 'D' | 'C' | 'B' | 'A' | 'S';

export type RuntimeDeckPreset = {
  id: string;
  name: string;
  archetype: string;
  description: string;
  cards: RuntimeCard[];
};

export type RuntimeCharacter = {
  id: string;
  name: string;
  rarity: CharacterRarity;
  source: {
    wikidata_id: string;
    wikidata_url: string;
    wikipedia_title?: string | null;
    wikipedia_url?: string | null;
    image_url?: string | null;
    language?: string;
  };
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    intelligence: number;
    influence: number;
    survival: number;
  };
  tags: string[];
  lore: string;
  short_lore: string;
  cards: RuntimeCard[];
  deck_presets?: RuntimeDeckPreset[];
};
