import type { Beat, Beat16 } from "../types/game";

const DB_NAME = "rythm-spel-db";
const DB_VERSION = 1;
const AUDIO_STORE = "audio";
const LEGACY_AUDIO_KEY = "song";

const LIST_KEY = "songs:list";
const MAX_SONGS = 3;

const LEGACY_META_KEYS = {
  name: "song:name",
  duration: "song:duration",
  bpm: "song:bpm",
  beats: "song:beats",
} as const;

export interface SavedSongMeta {
  id: string;
  name: string;
  duration: number;
  bpm: number;
  beats: Beat[];
  beatInterval: number;
  offset: number;
  beats16: Beat16[];
  blobKey: string;
}

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

function idbWrite(callback: (store: IDBObjectStore) => void): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, "readwrite");
        callback(tx.objectStore(AUDIO_STORE));
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      }),
  );
}

function readList(): SavedSongMeta[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(songs: SavedSongMeta[]): void {
  localStorage.setItem(LIST_KEY, JSON.stringify(songs));
}

function migrateLegacySong(): SavedSongMeta[] {
  const name = localStorage.getItem(LEGACY_META_KEYS.name);
  const duration = localStorage.getItem(LEGACY_META_KEYS.duration);
  const bpm = localStorage.getItem(LEGACY_META_KEYS.bpm);
  const beats = localStorage.getItem(LEGACY_META_KEYS.beats);

  if (!name || !duration || !bpm || !beats) return [];

  let parsedBeats: Beat[] = [];
  try {
    parsedBeats = JSON.parse(beats);
  } catch {
    return [];
  }

  const migrated: SavedSongMeta = {
    id: `legacy-${Date.now()}`,
    name,
    duration: Number(duration),
    bpm: Number(bpm),
    beats: parsedBeats,
    beatInterval: 60 / Number(bpm),
    offset: 0,
    beats16: [],
    blobKey: LEGACY_AUDIO_KEY,
  };

  Object.values(LEGACY_META_KEYS).forEach((key) => localStorage.removeItem(key));
  return [migrated];
}

export function getSavedSongs(): SavedSongMeta[] {
  const songs = readList();
  if (songs.length > 0) return songs;

  const migrated = migrateLegacySong();
  if (migrated.length > 0) {
    writeList(migrated);
    return migrated;
  }

  return [];
}

export async function loadSong(id: string): Promise<{
  file: File;
  name: string;
  duration: number;
  bpm: number;
  beats: Beat[];
  beatInterval: number;
  offset: number;
  beats16: Beat16[];
} | null> {
  const meta = getSavedSongs().find((s) => s.id === id);
  if (!meta) return null;

  const blob = await idbRequest<Blob | undefined>((store) => store.get(meta.blobKey));
  if (!blob) return null;

  return {
    file: new File([blob], meta.name, { type: blob.type }),
    name: meta.name,
    duration: meta.duration,
    bpm: meta.bpm,
    beats: meta.beats,
    beatInterval: meta.beatInterval ?? 60 / meta.bpm,
    offset: meta.offset ?? 0,
    beats16: meta.beats16 ?? [],
  };
}

export async function saveSong(
  file: File,
  name: string,
  duration: number,
  bpm: number,
  beats: Beat[],
  beatInterval: number,
  offset: number,
  beats16: Beat16[],
): Promise<string> {
  const id = `${Date.now()}`;
  const blobKey = `song:${id}`;

  await idbWrite((store) => {
    store.put(file, blobKey);
  });

  const songs = getSavedSongs().filter((s) => s.id !== id);
  songs.unshift({ id, name, duration, bpm, beats, beatInterval, offset, beats16, blobKey });

  const evicted = songs.splice(MAX_SONGS);
  writeList(songs);

  for (const song of evicted) {
    await idbWrite((store) => {
      store.delete(song.blobKey);
    });
  }

  return id;
}

export async function deleteSong(id: string): Promise<void> {
  const songs = getSavedSongs();
  const target = songs.find((s) => s.id === id);
  writeList(songs.filter((s) => s.id !== id));

  if (target) {
    await idbWrite((store) => {
      store.delete(target.blobKey);
    });
  }
}

export async function clearSongs(): Promise<void> {
  const songs = getSavedSongs();
  localStorage.removeItem(LIST_KEY);

  for (const song of songs) {
    await idbWrite((store) => {
      store.delete(song.blobKey);
    });
  }
}
