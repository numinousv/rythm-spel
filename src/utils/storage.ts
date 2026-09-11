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

function idbRequest<T>(callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = callback(db.transaction(AUDIO_STORE).objectStore(AUDIO_STORE));
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }),
  );
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

  const blob = await idbRequest<Blob>((store) => store.get(AUDIO_KEY));
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
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put(file, AUDIO_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
  localStorage.setItem(META_KEYS.name, name);
  localStorage.setItem(META_KEYS.duration, String(duration));
  localStorage.setItem(META_KEYS.bpm, String(bpm));
  localStorage.setItem(META_KEYS.beats, JSON.stringify(beats));
}

export async function clearSong(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(AUDIO_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
  Object.values(META_KEYS).forEach((key) => localStorage.removeItem(key));
}
