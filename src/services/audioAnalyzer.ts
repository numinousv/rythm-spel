import type { Beat, Beat16, SongData } from "../types/game";
import { beatTrack } from "@audio/beat";
import Meyda from "meyda";

export async function analyzeAudioFile(file: File): Promise<SongData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  const mono = new Float32Array(length);
  for (let c = 0; c < channelCount; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += ch[i];
  }
  for (let i = 0; i < length; i++) mono[i] /= channelCount;

  // DP beat tracking, 40-240 BPM per user preference (fast songs fun)
  let bpm = 120;
  let beats: number[] = [];
  try {
    const res = beatTrack(mono, { sampleRate, minBpm: 40, maxBpm: 240 } as any);
    const r: any = res as any;
    bpm = Math.round(r.bpm ?? r.tempo ?? 120) || 120;
    const rawBeats: any = r.beats ?? r.beatPositions ?? [];
    beats = Array.from(rawBeats as ArrayLike<number>).map(Number).filter((t) => Number.isFinite(t) && t >= 0);
  } catch {
    // fallback handled below
  }

  if (beats.length < 4) {
    // lightweight fallback: energy flux onsets
    const fallback = fallbackBeats(mono, sampleRate);
    beats = fallback.times;
    bpm = fallback.bpm;
  }

  beats.sort((a, b) => a - b);
  const beatInterval = bpm > 0 ? 60 / bpm : 0.5;
  const offset = beats.length ? beats[0] % beatInterval : 0;

  const beatObjs: Beat[] = beats.map((t, i) => ({
    time: t,
    intensity: 0.7 + (i % 4 === 0 ? 0.3 : 0),
  }));

  // meyda-driven sustain map for 1-3s holds: sustained loudness windows
  const sustain = buildSustainMask(mono, sampleRate, beats);

  const beats16: Beat16[] = [];
  for (let i = 0; i < beats.length; i++) {
    const bt = beats[i];
    const base = i % 4 === 0 ? 1.0 : i % 2 === 0 ? 0.7 : 0.5;
    for (let sub = 0; sub < 4; sub++) {
      const t = bt + (sub * beatInterval) / 4;
      if (t > audioBuffer.duration) break;
      const strength = sub === 0 ? base : sub === 2 ? base * 0.7 : base * 0.4;
      const subIdx = (i * 4 + sub) % 16;
      const key = Math.round(t * 100);
      const isSustained = sustain.has(key);
      beats16.push({
        time: t,
        subdivision: subIdx,
        intensity: strength,
        strength: isSustained ? Math.min(1, strength + 0.15) : strength,
      });
    }
  }
  beats16.sort((a, b) => a.time - b.time);

  return {
    name: file.name.replace(/\.[^.]+$/, ""),
    duration: audioBuffer.duration,
    bpm,
    beats: beatObjs,
    beatInterval,
    offset,
    beats16,
    audioBuffer,
  };
}

function buildSustainMask(mono: Float32Array, sampleRate: number, beats: number[]): Set<number> {
  const mask = new Set<number>();
  if (beats.length < 2) return mask;
  try {
    const win = 1024;
    const hop = 512;
    const loudBins: number[] = [];
    // @ts-ignore meyda types expect AudioContext buffer
    for (let i = 0; i + win <= mono.length; i += hop) {
      const chunk = mono.slice(i, i + win);
      // @ts-ignore
      const f: any = Meyda.extract("loudness", chunk);
      const total = f?.totalLoudness ?? f?.loudness ?? 0;
      loudBins.push(total);
    }
    if (loudBins.length < 10) return mask;
    const sorted = [...loudBins].sort((a, b) => a - b);
    const hi = sorted[Math.floor(sorted.length * 0.75)] || 1;
    const thr = hi * 0.85;
    // sustained = loudness > thr for >= 1s window (~ 86 hops at 44.1k: 512 hop ~11.6ms => 86 ~1s)
    const need = Math.ceil(sampleRate / hop);
    let run = 0;
    for (let i = 0; i < loudBins.length; i++) {
      if (loudBins[i] > thr) run++;
      else run = 0;
      if (run >= need) {
        const t = (i * hop) / sampleRate;
        // mark nearest beat's 1/16 subdivision as sustained-friendly
        let best = 0;
        let bestD = Infinity;
        for (let b = 0; b < beats.length; b++) {
          const d = Math.abs(beats[b] - t);
          if (d < bestD) { bestD = d; best = b; }
        }
        const beat = beats[best];
        const sub = 0; // sustain favors downbeat
        const tt = beat + (sub * (60 / 120)) / 4;
        mask.add(Math.round(tt * 100));
      }
    }
  } catch {
    // meyda unavailable -> no sustain bias
  }
  return mask;
}

function fallbackBeats(mono: Float32Array, sampleRate: number): { times: number[]; bpm: number } {
  const chunk = Math.floor(sampleRate * 0.01);
  const fluxes: number[] = [];
  let prev = 0;
  for (let i = 0; i < mono.length; i += chunk) {
    let s = 0;
    const end = Math.min(i + chunk, mono.length);
    for (let j = i; j < end; j++) s += mono[j] * mono[j];
    const e = s / (end - i);
    fluxes.push(Math.max(0, e - prev));
    prev = e;
  }
  const W = 43;
  const times: number[] = [];
  for (let i = W; i < fluxes.length - W; i++) {
    let mx = 0;
    for (let j = i - W; j <= i + W; j++) if (fluxes[j] > mx) mx = fluxes[j];
    let avg = 0;
    for (let j = i - W; j <= i + W; j++) avg += fluxes[j];
    avg /= 2 * W + 1;
    if (fluxes[i] > avg * 1.5 && fluxes[i] >= mx * 0.85) {
      const t = (i * chunk) / sampleRate;
      if (!times.length || t - times[times.length - 1] > 0.1) times.push(t);
    }
  }
  if (times.length < 4) return { times, bpm: 120 };
  const diffs = times.slice(1).map((t, i) => t - times[i]);
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const bpm = Math.max(40, Math.min(240, Math.round(60 / avg) || 120));
  return { times, bpm };
}
