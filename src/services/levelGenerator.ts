import type { Difficulty, Note, SongData } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT } from "../types/game";

export function generateNotes(song: SongData, difficulty: Difficulty): Note[] {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const notes: Note[] = [];
  let id = 0;

  const filteredBeats = song.beats.filter(
    (_, i) => Math.random() < settings.noteDensity || i % 3 === 0,
  );

  const usedTimes = new Set<number>();
  // lanes stay reserved for the full hold duration (+buffer) so later notes
  // never spawn inside an active hold.
  const laneHoldEnd: number[] = new Array(LANE_COUNT).fill(0);

  const pushTap = (time: number): void => {
    const roundedTime = Math.round(time * 10) / 10;
    if (usedTimes.has(roundedTime)) return;
    const freeLanes: number[] = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      if (time >= laneHoldEnd[i]) {
        freeLanes.push(i);
      }
    }
    if (freeLanes.length === 0) return;
    usedTimes.add(roundedTime);
    notes.push({
      id: id++,
      time,
      lane: freeLanes[Math.floor(Math.random() * freeLanes.length)],
      type: "tap",
      holdDuration: 0,
      status: "pending",
    });
  };

  let prevBeatTime: number | null = null;

  for (const beat of filteredBeats) {
    // extreme only: subdivide sparse gaps with off-beat taps for density.
    // density >= 1 already converts every beat, so this is the only way to
    // add more notes. respects the same dedup/occupancy rules below.
    if (
      difficulty === "extreme" &&
      prevBeatTime !== null &&
      beat.time - prevBeatTime > 0.4
    ) {
      pushTap((beat.time + prevBeatTime) / 2);
    }
    prevBeatTime = beat.time;

    const roundedTime = Math.round(beat.time * 10) / 10;
    if (usedTimes.has(roundedTime)) continue;
    usedTimes.add(roundedTime);

    const availableLanes: number[] = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      if (beat.time >= laneHoldEnd[i]) {
        availableLanes.push(i);
      }
    }
    if (availableLanes.length === 0) continue;

    const lane =
      availableLanes[Math.floor(Math.random() * availableLanes.length)];

    const isHold = Math.random() < settings.holdChance;
    const holdDuration = isHold ? 0.3 + Math.random() * 0.5 : 0;

    if (isHold) {
      laneHoldEnd[lane] = beat.time + holdDuration + 0.1;
    }

    notes.push({
      id: id++,
      time: beat.time,
      lane,
      type: isHold ? "hold" : "tap",
      holdDuration,
      status: "pending",
    });
  }

  return notes;
}
