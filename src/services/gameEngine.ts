import type { GameState, Note, Difficulty, SongData } from "../types/game";
import { DIFFICULTY_CONFIG } from "../types/game";
import { generateNotes } from "./levelGenerator";

export function createInitialState(
  song: SongData,
  difficulty: Difficulty,
): GameState {
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
    bpm: song.bpm,
    beatInterval: song.beatInterval,
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

  let closestNote: Note | null = null;
  let closestDiff = Infinity;
  // windowed search around song time instead of filtering the whole chart
  // on every press. notes stay time-sorted so binary search is valid.
  const lo = lowerBoundTime(state.notes, currentTime - hitWindow - 0.15);
  for (let i = lo; i < state.notes.length; i++) {
    const note = state.notes[i];
    if (note.time > currentTime + hitWindow + 0.15) break;
    if (note.lane !== lane || note.status !== "pending") continue;
    const diff = Math.abs(note.time - currentTime);
    if (diff < hitWindow && diff < closestDiff) {
      closestNote = note;
      closestDiff = diff;
    }
  }

  if (!closestNote) return { state, hit: false };

  const timeDiff = Math.abs(closestNote.time - currentTime);
  const accuracy = 1 - timeDiff / hitWindow;
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
  difficulty: Difficulty,
  graceUntil: number = 0,
): GameState {
  const heldNote = state.notes.find(
    (n) => n.lane === lane && n.status === "holding",
  );

  if (!heldNote) return state;

  const heldLongEnough = currentTime >= heldNote.time + heldNote.holdDuration;
  const missThreshold = DIFFICULTY_CONFIG[difficulty].hitWindow / 1000 + 0.1;

  // sweep overdue same-lane notes: a very long hold can shield them past
  // updateMisses scan window, stranding them "pending" forever.
  let missedOverdue = 0;
  const notes = state.notes.map((n) => {
    if (n.id === heldNote.id) {
      return {
        ...n,
        status: heldLongEnough ? ("hit" as const) : ("missed" as const),
      };
    }
    if (
      currentTime >= graceUntil &&
      n.lane === lane &&
      n.status === "pending" &&
      currentTime > n.time + missThreshold
    ) {
      missedOverdue++;
      return { ...n, status: "missed" as const };
    }
    return n;
  });

  const missedTotal = (heldLongEnough ? 0 : 1) + missedOverdue;

  return {
    ...state,
    notes,
    combo: missedTotal > 0 ? 0 : state.combo,
    totalMisses: state.totalMisses + missedTotal,
  };
}

// binary search over time-sorted notes; keeps per-frame scans proportional
// to what's on screen instead of song length.
export function lowerBoundTime(notes: Note[], t: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const WINDOW_BACK = 1.5;
const WINDOW_FWD = 0.5;
const PRUNE_BACK = 1.5;

// opening grace-period: no misses counted before this so the first notes are
// always hittable (also re-armed briefly after every resume).
export const LEAD_IN_SECONDS = 1.5;

export function updateMisses(
  state: GameState,
  currentTime: number,
  difficulty: Difficulty,
  heldKeys: Set<string> = new Set(),
  missGraceUntil: number = 0,
): GameState {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const missThreshold = settings.hitWindow / 1000 + 0.1;

  const holdingLanes = new Set(
    state.notes.filter((n) => n.status === "holding").map((n) => n.lane),
  );

  // copy-on-write - zero allocations on idle frames. terminal notes far
  // behind are pruned so the array shrinks as the song progresses.
  const noMiss = currentTime < missGraceUntil;
  let newMisses = 0;
  let newHits = 0;
  let updatedNotes: Note[] | null = null;
  const start = lowerBoundTime(state.notes, currentTime - WINDOW_BACK);
  for (let i = start; i < state.notes.length; i++) {
    const n = state.notes[i];
    if (n.time > currentTime + WINDOW_FWD) break;
    if (
      n.status === "pending" &&
      !noMiss &&
      currentTime > n.time + missThreshold
    ) {
      if (holdingLanes.has(n.lane)) continue;
      newMisses++;
      if (!updatedNotes) updatedNotes = state.notes.slice();
      updatedNotes[i] = { ...n, status: "missed" as const };
    } else if (n.status === "holding") {
      const laneKey = ["d", "f", "j", "k"][n.lane];
      const isKeyHeld = heldKeys.has(laneKey);
      if (!isKeyHeld && currentTime >= n.time + n.holdDuration) {
        newHits++;
        if (!updatedNotes) updatedNotes = state.notes.slice();
        updatedNotes[i] = { ...n, status: "hit" as const };
      }
    }
  }

  const base = updatedNotes ?? state.notes;
  let pruneCount = 0;
  while (
    pruneCount < base.length &&
    (base[pruneCount].status === "hit" ||
      base[pruneCount].status === "missed") &&
    base[pruneCount].time < currentTime - PRUNE_BACK
  ) {
    pruneCount++;
  }
  const finalNotes = pruneCount > 0 ? base.slice(pruneCount) : base;

  if (!updatedNotes && pruneCount === 0) return state;

  return {
    ...state,
    notes: finalNotes,
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
  return state.notes.every(
    (n) => n.status !== "pending" && n.status !== "holding",
  );
}
