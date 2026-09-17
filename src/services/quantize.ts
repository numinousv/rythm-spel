export function snapToGrid(
  time: number,
  offset: number,
  beatInterval: number,
  subdivision: number = 16
): number {
  const interval = beatInterval / subdivision;
  const relative = time - offset;
  const snapped = Math.round(relative / interval) * interval + offset;
  return snapped;
}

export function quantizeBeats16(
  beats16: { time: number; strength: number }[],
  offset: number,
  beatInterval: number
): { time: number; subdivision: number; strength: number }[] {
  const SUBDIVISION = 16;
  const gridInterval = beatInterval / SUBDIVISION;
  
  return beats16.map(({ time, strength }) => {
    const relative = time - offset;
    const rawIndex = relative / gridInterval;
    const quantizedIndex = Math.round(rawIndex);
    const quantizedTime = offset + quantizedIndex * gridInterval;
    const subdivision = ((quantizedIndex % SUBDIVISION) + SUBDIVISION) % SUBDIVISION;
    
    return { time: quantizedTime, subdivision, strength };
  });
}

export function deduplicateBeats16(
  beats: { time: number; subdivision: number; strength: number }[],
  maxGap: number
): { time: number; subdivision: number; strength: number }[] {
  if (beats.length === 0) return [];
  
  const result: { time: number; subdivision: number; strength: number }[] = [];
  let last = beats[0];
  result.push(last);
  
  for (let i = 1; i < beats.length; i++) {
    const curr = beats[i];
    if (curr.time - last.time >= maxGap) {
      result.push(curr);
      last = curr;
    } else if (curr.strength > last.strength) {
      result[result.length - 1] = curr;
      last = curr;
    }
  }
  return result;
}

export function mapToGrid(
  beats: { time: number; strength: number }[],
  offset: number,
  beatInterval: number
): { time: number; subdivision: number; strength: number }[] {
  const gridInterval = beatInterval / 16;
  const maxGap = gridInterval * 0.75;
  
  const quantized = quantizeBeats16(beats, offset, beatInterval);
  return deduplicateBeats16(quantized, maxGap);
}