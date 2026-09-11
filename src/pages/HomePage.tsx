import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Title, Button, Card, Strip } from "../components";
import type { Difficulty } from "../types/game";
import { DIFFICULTY_CONFIG } from "../types/game";
import { analyzeAudioFile } from "../services/audioAnalyzer";
import { getSavedSongMeta, saveSong, clearSong } from "../utils/storage";

function getInitialSavedSong() {
  return getSavedSongMeta();
}

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(() => getInitialSavedSong()?.name ?? null);
  const [savedSong, setSavedSong] = useState<{ name: string } | null>(getInitialSavedSong);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setLoading(true);

    try {
      const songData = await analyzeAudioFile(file);

      await saveSong(
        file,
        songData.name,
        songData.duration,
        songData.bpm,
        songData.beats,
      );
      setSavedSong({ name: songData.name });

      sessionStorage.setItem("difficulty", difficulty);
      navigate("/game");
    } catch (err) {
      console.error(err);
      setError("Failed to analyze audio. Try a different file.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySaved = () => {
    sessionStorage.setItem("difficulty", difficulty);
    navigate("/game");
  };

  const handleClearSong = async () => {
    await clearSong();
    setFileName(null);
    setSavedSong(null);
  };

  return (
    <div className="max-w-225 mx-auto my-8 flex flex-col gap-4 px-4">
      <section className="py-2">
        <Title title="RHYTHM" subtitle="SPEL" />
      </section>
      <Strip />

      <section>
        <Card title="SELECT SONG" layout="fill">
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm tracking-[1px]">
              Upload an audio file to generate a rhythm level.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
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

            {savedSong && (
              <div className="flex gap-2">
                <Button type="button" onClick={handlePlaySaved}>
                  Play Saved Song
                </Button>
                <Button type="button" onClick={handleClearSong}>
                  Clear
                </Button>
              </div>
            )}

            {error && <p className="text-alert text-sm">{error}</p>}
          </div>
        </Card>
      </section>

      <section>
        <Card title="DIFFICULTY" layout="fill">
          <div className="flex flex-col gap-4 py-4">
            <div className="flex gap-2">
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
