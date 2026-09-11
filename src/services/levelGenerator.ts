import type { Difficulty, Note, SongData } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT } from "../types/game";

export function generateNotes(
  song: SongData,
  difficulty: Difficulty,
): Note[] {
  const settings = DIFFICULTY_CONFIG[difficulty];
  const notes: Note[] = [];
  let id = 0;

  const filteredBeats = song.beats.filter(
    (_, i) => Math.random() < settings.noteDensity || i % 3 === 0,
  );

  const usedTimes = new Set<number>();

  for (const beat of filteredBeats) {
    const roundedTime = Math.round(beat.time * 10) / 10;
    if (usedTimes.has(roundedTime)) continue;
    usedTimes.add(roundedTime);

    const lane = beat.intensity > 0.5
      ? Math.floor(Math.random() * LANE_COUNT)
      : Math.floor(Math.random() * 2) + 1;

    notes.push({
      id: id++,
      time: beat.time,
      lane,
      status: "pending",
    });
  }

  return notes;
}
