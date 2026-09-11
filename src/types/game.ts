export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type NoteType = "tap" | "hold";

export type NoteStatus = "pending" | "holding" | "hit" | "missed";

export interface Beat {
  time: number;
  intensity: number;
}

export interface Note {
  id: number;
  time: number;
  lane: number;
  type: NoteType;
  holdDuration: number;
  status: NoteStatus;
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
}

export interface SongData {
  name: string;
  duration: number;
  bpm: number;
  beats: Beat[];
  audioBuffer: AudioBuffer;
}

export interface DifficultySettings {
  noteDensity: number;
  scrollSpeed: number;
  hitWindow: number;
  holdChance: number;
  label: string;
}

export const LANE_COUNT = 4;
export const LANE_KEYS = ["d", "f", "j", "k"];

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  easy: {
    noteDensity: 0.4,
    scrollSpeed: 200,
    hitWindow: 150,
    holdChance: 0.25,
    label: "Easy",
  },
  medium: {
    noteDensity: 0.7,
    scrollSpeed: 300,
    hitWindow: 100,
    holdChance: 0.2,
    label: "Medium",
  },
  hard: {
    noteDensity: 1.0,
    scrollSpeed: 500,
    hitWindow: 60,
    holdChance: 0.2,
    label: "Hard",
  },
  extreme: {
    noteDensity: 1.2,
    scrollSpeed: 600,
    hitWindow: 40,
    holdChance: 0.25,
    label: "Extreme",
  },
};
