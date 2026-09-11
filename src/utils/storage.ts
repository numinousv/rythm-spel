import type { Beat } from "../types/game";

const DB_NAME = "rythm-spel-db";
const DB_VERSION = 1;
const AUDIO_STORE = "audio";
const AUDIO_KEY = "song";

const META_KEYS = {
  name: "song:name",
  duration: "song:duration",
  bpm: "song:bpm",
  beats: "song:beats",
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUDIO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbSet(store: string, key: string, value: unknown): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

function idbDelete(store: string, key: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function getSavedSongMeta(): { name: string; duration: number } | null {
  const name = localStorage.getItem(META_KEYS.name);
  const duration = localStorage.getItem(META_KEYS.duration);
  if (!name || !duration) return null;
  return { name, duration: Number(duration) };
}

export async function loadSavedSong(): Promise<{
  file: File;
  name: string;
  duration: number;
  bpm: number;
  beats: Beat[];
} | null> {
  const name = localStorage.getItem(META_KEYS.name);
  const duration = localStorage.getItem(META_KEYS.duration);
  const bpm = localStorage.getItem(META_KEYS.bpm);
  const beats = localStorage.getItem(META_KEYS.beats);

  if (!name || !duration || !bpm || !beats) return null;

  const blob = await idbGet<Blob>(AUDIO_STORE, AUDIO_KEY);
  if (!blob) return null;

  return {
    file: new File([blob], name, { type: blob.type }),
    name,
    duration: Number(duration),
    bpm: Number(bpm),
    beats: JSON.parse(beats),
  };
}

export async function saveSong(
  file: File,
  name: string,
  duration: number,
  bpm: number,
  beats: Beat[],
): Promise<void> {
  await idbSet(AUDIO_STORE, AUDIO_KEY, file);
  localStorage.setItem(META_KEYS.name, name);
  localStorage.setItem(META_KEYS.duration, String(duration));
  localStorage.setItem(META_KEYS.bpm, String(bpm));
  localStorage.setItem(META_KEYS.beats, JSON.stringify(beats));
}

export async function clearSong(): Promise<void> {
  await idbDelete(AUDIO_STORE, AUDIO_KEY);
  Object.values(META_KEYS).forEach((key) => localStorage.removeItem(key));
}
