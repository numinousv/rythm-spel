export type Difficulty = "easy" | "medium" | "hard";

export type NoteStatus = "pending" | "hit" | "missed";

export interface Beat {
  time: number;
  intensity: number;
}

export interface Note {
  id: number;
  time: number;
  lane: number;
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
  label: string;
}

export const LANE_COUNT = 4;
export const LANE_KEYS = ["d", "f", "j", "k"];

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  easy: {
    noteDensity: 0.4,
    scrollSpeed: 200,
    hitWindow: 150,
    label: "Easy",
  },
  medium: {
    noteDensity: 0.7,
    scrollSpeed: 300,
    hitWindow: 100,
    label: "Medium",
  },
  hard: {
    noteDensity: 1.0,
    scrollSpeed: 400,
    hitWindow: 60,
    label: "Hard",
  },
};
