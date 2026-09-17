import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Title, Button, Card, Strip } from "../components";
import type { Difficulty } from "../types/game";
import { DIFFICULTY_CONFIG } from "../types/game";
import { analyzeAudioFile } from "../services/audioAnalyzer";
import {
  getSavedSongs,
  saveSong,
  deleteSong,
  type SavedSongMeta,
} from "../utils/storage";
import { prefetchGamePage } from "../app/routes";

function getInitialSavedSongs(): SavedSongMeta[] {
  return getSavedSongs();
}

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // fetch the game chunk while idle so starting a song feels instant.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchGamePage();
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(run);
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const t = setTimeout(run, 1);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem("difficulty") as Difficulty | null;
    return saved && DIFFICULTY_CONFIG[saved] ? saved : "medium";
  });

  useEffect(() => {
    localStorage.setItem("difficulty", difficulty);
  }, [difficulty]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(
    () => getInitialSavedSongs()[0]?.name ?? null,
  );
  const [songs, setSongs] = useState<SavedSongMeta[]>(getInitialSavedSongs);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setLoading(true);

    try {
      const songData = await analyzeAudioFile(file);

      const id = await saveSong(
        file,
        songData.name,
        songData.duration,
        songData.bpm,
        songData.beats,
        songData.beatInterval,
        songData.offset,
        songData.beats16,
      );
      setSongs(getSavedSongs());

      sessionStorage.setItem("difficulty", difficulty);
      sessionStorage.setItem("songId", id);
      navigate("/game");
    } catch (err) {
      console.error(err);
      setError("Failed to analyze audio. Try a different file.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (id: string) => {
    sessionStorage.setItem("difficulty", difficulty);
    sessionStorage.setItem("songId", id);
    navigate("/game");
  };

  const handleDeleteSong = async (id: string) => {
    await deleteSong(id);
    const remaining = getSavedSongs();
    setSongs(remaining);
    if (remaining.length === 0) setFileName(null);
  };

  return (
    <div className="max-w-225 mx-auto my-4 sm:my-8 flex flex-col gap-4 px-4">
      <section className="py-2">
        <Title title="RHYTHM" subtitle="YoRHa" />
      </section>
      <Strip />

      <section>
        <Card title="SELECT SONG" layout="fill">
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm tracking-[1px]">
              Upload an audio file to generate a unique beatmap
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.opus,.weba,.webm"
              onChange={handleFileChange}
              className="hidden"
            />

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              {loading
                ? "Analyzing..."
                : fileName
                  ? `Replace: ${fileName}`
                  : "Choose Audio File"}
            </Button>

            {songs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs tracking-[1px] opacity-70">
                  SAVED SONGS ({songs.length}/3)
                </p>
                {songs.map((song) => (
                  <div key={song.id} className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handlePlaySong(song.id)}
                    >
                      Play: {song.name}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeleteSong(song.id)}
                      className="w-auto"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-alert text-sm">{error}</p>}
          </div>
        </Card>
      </section>

      <section>
        <Card title="DIFFICULTY" layout="fill">
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => (
                <Button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={difficulty === d ? "bg-primary text-surface" : ""}
                >
                  {DIFFICULTY_CONFIG[d].label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <Strip />
    </div>
  );
}
