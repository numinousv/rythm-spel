import type { GameState, Note, Difficulty, SongData } from "../types/game";
import { DIFFICULTY_CONFIG } from "../types/game";
import { generateNotes } from "./levelGenerator";

export function createInitialState(song: SongData, difficulty: Difficulty): GameState {
  return {
    status: "idle",
    notes: generateNotes(song, difficulty),
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalHits: 0,
    totalMisses: 0,
    accuracy: 0,
    elapsed: 0,
  };
}

export function judgeHit(
  state: GameState,
  lane: number,
  currentTime: number,
  difficulty: Difficulty,
): { state: GameState; hit: boolean } {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const hitWindow = settings.hitWindow / 1000;

  const closestNote = state.notes
    .filter((n) => n.lane === lane && n.status === "pending")
    .reduce<Note | null>((closest, note) => {
      const diff = Math.abs(note.time - currentTime);
      if (diff < hitWindow && (!closest || diff < Math.abs(closest.time - currentTime))) {
        return note;
      }
      return closest;
    }, null);

  if (!closestNote) return { state, hit: false };

  const timeDiff = Math.abs(closestNote.time - currentTime);
  const accuracy = 1 - (timeDiff / hitWindow);
  const points = Math.round(100 * accuracy);

  const newStatus = closestNote.type === "hold" ? "holding" : "hit";

  return {
    state: {
      ...state,
      notes: state.notes.map((n) =>
        n.id === closestNote.id ? { ...n, status: newStatus } : n,
      ),
      score: state.score + points * (1 + Math.floor(state.combo / 10) * 0.1),
      combo: state.combo + 1,
      maxCombo: Math.max(state.maxCombo, state.combo + 1),
      totalHits: state.totalHits + 1,
    },
    hit: true,
  };
}

export function releaseHold(
  state: GameState,
  lane: number,
  currentTime: number,
  _difficulty: Difficulty,
): GameState {
  const heldNote = state.notes.find(
    (n) => n.lane === lane && n.status === "holding",
  );

  if (!heldNote) return state;

  const heldLongEnough = currentTime >= heldNote.time + heldNote.holdDuration;

  if (!heldLongEnough) {
    return {
      ...state,
      notes: state.notes.map((n) =>
        n.id === heldNote.id ? { ...n, status: "missed" } : n,
      ),
      combo: 0,
      totalMisses: state.totalMisses + 1,
    };
  }

  return {
    ...state,
    notes: state.notes.map((n) =>
      n.id === heldNote.id ? { ...n, status: "hit" } : n,
    ),
  };
}

export function updateMisses(
  state: GameState,
  currentTime: number,
  difficulty: Difficulty,
  heldKeys: Set<string> = new Set(),
): GameState {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const missThreshold = settings.hitWindow / 1000 + 0.1;

  const holdingLanes = new Set(
    state.notes.filter((n) => n.status === "holding").map((n) => n.lane),
  );

  let newMisses = 0;
  let newHits = 0;
  const updatedNotes = state.notes.map((n) => {
    if (n.status === "pending" && currentTime > n.time + missThreshold) {
      if (holdingLanes.has(n.lane)) return n;
      newMisses++;
      return { ...n, status: "missed" as const };
    }
    if (n.status === "holding") {
      const laneKey = ["d", "f", "j", "k"][n.lane];
      const isKeyHeld = heldKeys.has(laneKey);
      if (!isKeyHeld && currentTime >= n.time + n.holdDuration) {
        newHits++;
        return { ...n, status: "hit" as const };
      }
    }
    return n;
  });

  if (newMisses === 0 && newHits === 0) return state;

  return {
    ...state,
    notes: updatedNotes,
    combo: newMisses > 0 ? 0 : state.combo,
    totalMisses: state.totalMisses + newMisses,
    totalHits: state.totalHits + newHits,
  };
}

export function calculateAccuracy(state: GameState): number {
  const total = state.totalHits + state.totalMisses;
  if (total === 0) return 100;
  return Math.round((state.totalHits / total) * 10000) / 100;
}

export function isSongFinished(state: GameState): boolean {
  return state.notes.every((n) => n.status !== "pending" && n.status !== "holding");
}
