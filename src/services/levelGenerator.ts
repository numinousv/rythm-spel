import type { Difficulty, Note, SongData } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT } from "../types/game";
import { mapToGrid } from "./quantize";

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateNotes(
  song: SongData,
  difficulty: Difficulty,
  seed?: number,
): Note[] {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const notes: Note[] = [];
  let id = 0;
  // Seeded shuffle: same song+difficulty+seed -> same pattern set, but
  // different seeds give fresh StepMania-style variations (shuffle mod).
  const rng = mulberry32(
    seed ?? hashSeed(`${song.name}:${difficulty}:${song.beats.length}`),
  );

  if (!song.beats16 || song.beats16.length === 0) {
    return notes;
  }

  const candidateBeats = song.beats16
    .filter((b) => b.strength > 0.1)
    .map((b) => ({ time: b.time, strength: b.strength }));

  const quantizedBeats = mapToGrid(
    candidateBeats,
    song.offset,
    song.beatInterval,
  );

  // Group beats by quantized time to prevent stacked notes
  const beatsByTime = new Map<number, typeof quantizedBeats>();
  for (const beat of quantizedBeats) {
    const key = Math.round(beat.time * 1000); // ms precision
    if (!beatsByTime.has(key)) beatsByTime.set(key, []);
    beatsByTime.get(key)!.push(beat);
  }

  const measureNotes = new Map<number, number>();

  const laneHoldEnd: number[] = new Array(LANE_COUNT).fill(0);
  const lastLaneUsed: number[] = [-1, -1, -1, -1];
  let lastLaneIdx = -1;

  // Process beats grouped by time - pick best candidate per timestamp
  const sortedTimes = Array.from(beatsByTime.keys()).sort((a, b) => a - b);

  for (const timeKey of sortedTimes) {
    const beatTime = timeKey / 1000;
    const candidates = beatsByTime.get(timeKey)!;

    // Pick strongest candidate at this timestamp
    const beat = candidates.reduce((best, curr) =>
      curr.strength > best.strength ? curr : best,
    );

    if (settings.noteDensity < 1 && rng() > settings.noteDensity) continue;

    const measureIdx = Math.floor(beatTime / (song.beatInterval * 4));
    const currentInMeasure = measureNotes.get(measureIdx) || 0;
    if (currentInMeasure >= settings.maxDensity) continue;

    measureNotes.set(measureIdx, currentInMeasure + 1);

    const availableLanes: number[] = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      if (beatTime >= laneHoldEnd[i]) {
        availableLanes.push(i);
      }
    }
    if (availableLanes.length === 0) continue;

    const lane = selectLane(
      availableLanes,
      lastLaneIdx,
      lastLaneUsed,
      difficulty,
      rng,
    );
    if (lane === -1) continue;

    lastLaneIdx = lane;
    lastLaneUsed[lane] = id;

    // DDR/Mania holds: 1-3s, only on strong grid positions, weighted by strength
    const isOnBeat = beat.subdivision % 4 === 0;
    const isStrong = beat.strength > 0.6;
    // bias holds to downbeats/sustained positions, feels musical, not random
    const holdBias = isOnBeat ? (isStrong ? 1.4 : 1.0) : 0.3;
    const baseHoldChance = settings.holdChance * 1.5 * holdBias;
    const isHold = isOnBeat && rng() < baseHoldChance;
    const holdDuration = isHold
      ? quantizeHoldDuration(song.beatInterval, rng)
      : 0;

    if (isHold) {
      laneHoldEnd[lane] = beatTime + holdDuration + 0.1;
    }

    const subdivision = beat.subdivision;
    const beatIndex = Math.floor(beatTime / (song.beatInterval / 16));

    notes.push({
      id: id++,
      time: beatTime,
      lane,
      type: isHold ? "hold" : "tap",
      holdDuration,
      status: "pending",
      beatIndex,
      subdivision,
    });
  }

  return notes;
}

function selectLane(
  available: number[],
  lastLane: number,
  lastUsed: number[],
  difficulty: string,
  rng: () => number,
): number {
  if (available.length === 0) return -1;
  if (available.length === 1) return available[0];

  const scored = available.map((lane) => {
    let score = 0;

    if (lane !== lastLane) score += 3;

    const lastUsedIdx = lastUsed[lane];
    if (lastUsedIdx !== -1) {
      score -= 2;
    }

    if (difficulty === "extreme" || difficulty === "hard") {
      const usedCount = lastUsed.filter((x) => x === lane).length;
      score -= usedCount;
    }

    score += rng() * 2;

    return { lane, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].lane;
}

function quantizeHoldDuration(beatInterval: number, rng: () => number): number {
  // Guaranteed 1-3s holds on all difficulties, quantized to beats (DDR/Mania feel)
  const candidates = [
    Math.max(1, Math.min(3, beatInterval * 2)),
    Math.max(1, Math.min(3, beatInterval * 3)),
    Math.max(1, Math.min(3, beatInterval * 4)),
    Math.max(1, Math.min(3, beatInterval * 6)),
  ];
  // bias slightly longer, both easy and hard should feel like real holds
  const weights = [0.2, 0.3, 0.3, 0.2];
  const r = rng();
  let acc = 0;
  for (let i = 0; i < candidates.length; i++) {
    acc += weights[i];
    if (r < acc) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
