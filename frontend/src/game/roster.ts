import exportedCharacters from './gameCharacters.json';
import { seedCharacter } from './seedData';
import type { RuntimeCharacter } from './runtimeTypes';

const characters = exportedCharacters as RuntimeCharacter[];

export const runtimeRoster: RuntimeCharacter[] = characters.length ? characters : [seedCharacter];
