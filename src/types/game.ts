export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type NoteType = "tap" | "hold";

export type NoteStatus = "pending" | "holding" | "hit" | "missed";

export interface Beat {
  time: number;
  intensity: number;
}

export interface Beat16 {
  time: number;
  subdivision: number; // 0-15 for 1/16th note position
  intensity: number;
  strength: number; // 0-1 weight for note selection
}

export interface Note {
  id: number;
  time: number;
  lane: number;
  type: NoteType;
  holdDuration: number;
  status: NoteStatus;
  beatIndex: number; // which beat16 this note came from
  subdivision: number; // 0-15
}

export interface GameState {
  status: "idle" | "playing" | "paused" | "finished";
  notes: Note[];
  score: number;
  combo: number;
  maxCombo: number;
  totalHits: number;
  totalMisses: number;
  accuracy: number;
  elapsed: number;
  bpm: number;
  beatInterval: number;
}

export interface SongData {
  name: string;
  duration: number;
  bpm: number;
  beats: Beat[];
  beatInterval: number; // 60/bpm
  offset: number; // seconds from audio start to first downbeat
  beats16: Beat16[]; // all 1/16 grid positions with weights
  audioBuffer: AudioBuffer;
}

export interface DifficultySettings {
  noteDensity: number;
  scrollSpeed: number;
  hitWindow: number;
  holdChance: number;
  maxDensity: number; // cap on notes per measure
  label: string;
}

export const LANE_COUNT = 4;
export const LANE_KEYS = ["d", "f", "j", "k"];

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  easy: {
    noteDensity: 0.45,
    scrollSpeed: 280,
    hitWindow: 110,
    holdChance: 0.12,
    maxDensity: 3,
    label: "Easy",
  },
  medium: {
    noteDensity: 0.7,
    scrollSpeed: 420,
    hitWindow: 75,
    holdChance: 0.16,
    maxDensity: 5,
    label: "Medium",
  },
  hard: {
    noteDensity: 0.95,
    scrollSpeed: 560,
    hitWindow: 50,
    holdChance: 0.2,
    maxDensity: 7,
    label: "Hard",
  },
  extreme: {
    noteDensity: 1.2,
    scrollSpeed: 800,
    hitWindow: 30,
    holdChance: 0.3,
    maxDensity: 12,
    label: "Extreme",
  },
};
