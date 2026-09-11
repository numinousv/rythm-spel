import type { Beat, SongData } from "../types/game";

export async function analyzeAudioFile(file: File): Promise<SongData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const beats = detectBeats(audioBuffer);

  const bpm = beats.length > 1
    ? Math.round((beats.length / audioBuffer.duration) * 60)
    : 120;

  await audioContext.close();

  return {
    name: file.name.replace(/\.[^.]+$/, ""),
    duration: audioBuffer.duration,
    bpm,
    beats,
    audioBuffer,
  };
}

function detectBeats(buffer: AudioBuffer): Beat[] {
  const rawData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const chunkSize = Math.floor(sampleRate * 0.01);
  const energies: number[] = [];

  for (let i = 0; i < rawData.length; i += chunkSize) {
    let sum = 0;
    const end = Math.min(i + chunkSize, rawData.length);
    for (let j = i; j < end; j++) {
      sum += rawData[j] * rawData[j];
    }
    energies.push(sum / (end - i));
  }

  const windowSize = 43;
  const threshold = 1.3;
  const beats: Beat[] = [];

  for (let i = windowSize; i < energies.length - windowSize; i++) {
    let localMax = 0;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (energies[j] > localMax) localMax = energies[j];
    }

    const localAvg =
      energies.slice(i - windowSize, i + windowSize + 1).reduce((a, b) => a + b, 0) /
      (windowSize * 2 + 1);

    if (
      energies[i] > localAvg * threshold &&
      energies[i] >= localMax * 0.9
    ) {
      const time = (i * chunkSize) / sampleRate;
      const intensity = Math.min(energies[i] / (localAvg + 0.0001), 2);

      if (beats.length === 0 || time - beats[beats.length - 1].time > 0.15) {
        beats.push({ time, intensity: Math.min(intensity, 1) });
      }
    }
  }

  return beats;
}
