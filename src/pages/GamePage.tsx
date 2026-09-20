import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Title, Button, Card, Strip } from "../components";
import type { Difficulty, GameState } from "../types/game";
import { DIFFICULTY_CONFIG } from "../types/game";
import {
  createInitialState,
  calculateAccuracy,
  isSongFinished,
} from "../services/gameEngine";
import { GameCanvas } from "../components/GameCanvas";
import { loadSong } from "../utils/storage";
import { prefetchResultsPage } from "../app/routes";
import { generateNotes } from "../services/levelGenerator";
import type { SongData } from "../types/game";

export function GamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [songName, setSongName] = useState<string>("Unknown");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (sessionStorage.getItem("difficulty") as Difficulty) || "medium",
  );
  const [songDuration, setSongDuration] = useState(60);
  const [started, setStarted] = useState(false);
  const [spectate, setSpectate] = useState(false);
  const [seed, setSeed] = useState<number | null>(() => {
    const s = sessionStorage.getItem("seed");
    return s ? Number(s) : null;
  });
  const [previewSong, setPreviewSong] = useState<SongData | null>(null);
  const [previewNotes, setPreviewNotes] = useState<ReturnType<
    typeof generateNotes
  > | null>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const prevComboRef = useRef(0);

  // pulse via WAAPI instead of key={combo} remounts: remounting a large
  // text node on every hit spiked GPU usage (firefox spiked my GPU to 30% for every note hit lol, fixed now).
  useEffect(() => {
    const combo = gameState?.combo ?? 0;
    if (combo > prevComboRef.current) {
      comboRef.current?.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.3)", offset: 0.3 },
          { transform: "scale(1)" },
        ],
        { duration: 250, easing: "ease-out" },
      );
    }
    prevComboRef.current = combo;
  }, [gameState?.combo]);

  // fetch the results chunk while idle (minutes of gameplay ahead)
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchResultsPage();
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

  // Load song for preview (before start) so shuffle can show result
  useEffect(() => {
    if (started) return;
    const sid = sessionStorage.getItem("songId");
    if (!sid) return;
    loadSong(sid).then((saved) => {
      if (!saved) return;
      setPreviewSong({
        name: saved.name,
        duration: saved.duration,
        bpm: saved.bpm,
        beats: saved.beats,
        beatInterval: saved.beatInterval ?? 60 / saved.bpm,
        offset: saved.offset ?? 0,
        beats16: saved.beats16 ?? [],
        audioBuffer: {} as AudioBuffer,
      });
    });
  }, [started]);

  useEffect(() => {
    if (!previewSong) return;
    const preview = generateNotes(previewSong, difficulty, seed ?? undefined);
    setPreviewNotes(preview.slice(0, 32));
  }, [previewSong, difficulty, seed]);

  const handleShuffle = () => {
    const newSeed = Date.now() ^ Math.floor(Math.random() * 1e9);
    setSeed(newSeed);
    sessionStorage.setItem("seed", String(newSeed));
  };

  const handleStart = async (doSpectate = false) => {
    try {
      const saved = await loadSong(sessionStorage.getItem("songId") ?? "");
      if (!saved) {
        navigate("/");
        return;
      }

      const diff =
        (sessionStorage.getItem("difficulty") as Difficulty) || "medium";

      setDifficulty(diff);
      setSongName(saved.name);
      setSongDuration(saved.duration);
      setSpectate(doSpectate);
      sessionStorage.setItem("spectate", doSpectate ? "1" : "0");
      const useSeed = seed ?? undefined;
      if (useSeed !== undefined)
        sessionStorage.setItem("seed", String(useSeed));

      const audioDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(saved.file);
      });

      const initialState = createInitialState(
        {
          name: saved.name,
          duration: saved.duration,
          bpm: saved.bpm,
          beats: saved.beats,
          beatInterval: saved.beatInterval ?? 60 / saved.bpm,
          offset: saved.offset ?? 0,
          beats16: saved.beats16 ?? [],
          audioBuffer: {} as AudioBuffer,
        },
        diff,
        useSeed,
      );

      setGameState(initialState);
      setAudioUrl(audioDataUrl);
      setStarted(true);
    } catch {
      navigate("/");
    }
  };

  const handleGameStateUpdate = (newState: GameState) => {
    setGameState(newState);
    if (
      isSongFinished(newState) ||
      (gameState && gameState.elapsed >= songDuration)
    ) {
      const finalState = { ...newState, accuracy: calculateAccuracy(newState) };
      sessionStorage.setItem("finalGameState", JSON.stringify(finalState));
      sessionStorage.setItem("songName", songName);
      sessionStorage.setItem("difficulty", difficulty);
      // preserve spectate flag for results banner
      sessionStorage.setItem("spectate", spectate ? "1" : "0");
      navigate("/results");
    }
  };

  return (
    <div className="max-w-225 mx-auto my-4 sm:my-8 flex flex-col gap-4 px-4">
      <section className="py-2">
        <Title title="GAME" subtitle3={songName} />
      </section>
      <Strip />

      {!started ? (
        <section>
          <Card title="READY?" layout="fill">
            <div className="flex flex-col gap-4 py-4 items-center">
              <div className="flex items-center gap-2">
                <p className="text-sm tracking-[1px] text-center">
                  Difficulty: {DIFFICULTY_CONFIG[difficulty].label}
                </p>
                <Button
                  type="button"
                  onClick={handleShuffle}
                  className="w-auto px-3 py-1 text-xs"
                  title="Reshuffle pattern (seeded shuffle mod)"
                >
                  Shuffle
                </Button>
              </div>
              {previewNotes && (
                <div className="w-full max-w-md">
                  <p className="text-xs tracking-[1px] text-center opacity-60 mb-1">
                    Preview: first {previewNotes.length} notes{" "}
                    {seed !== null
                      ? `(seed ${String(seed).slice(-6)})`
                      : "(default seed)"}
                  </p>
                  <div className="grid grid-cols-4 gap-1 bg-muted p-2">
                    {[0, 1, 2, 3].map((lane) => (
                      <div
                        key={lane}
                        className="flex flex-col gap-1 min-h-20 bg-surface p-1"
                      >
                        <span className="text-xs text-center opacity-50">
                          {["D", "F", "J", "K"][lane]}
                        </span>
                        {previewNotes
                          .filter((n) => n.lane === lane)
                          .slice(0, 8)
                          .map((n) => (
                            <div
                              key={n.id}
                              className={`h-3 w-full rounded-sm ${n.type === "hold" ? "bg-primary" : "bg-primary/70"}`}
                              title={`${n.type} @ ${n.time.toFixed(2)}s`}
                            />
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs tracking-[1px] text-center opacity-70">
                Keys: D F J K · or tap the lanes · Tap the canvas to start
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mx-auto">
                <Button type="button" onClick={() => handleStart(false)}>
                  Start Game
                </Button>
                <Button type="button" onClick={() => handleStart(true)}>
                  Spectate
                </Button>
              </div>
            </div>
          </Card>
        </section>
      ) : (
        <section>
          {gameState && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between text-xs tracking-[1px]">
                <span>Score: {Math.round(gameState.score)}</span>
                <span>Accuracy: {calculateAccuracy(gameState)}%</span>
              </div>
              <div className="relative flex flex-col gap-4">
                <GameCanvas
                  gameState={gameState}
                  difficulty={difficulty}
                  audioUrl={audioUrl}
                  onStateUpdate={handleGameStateUpdate}
                  songDuration={songDuration}
                  spectate={spectate}
                />
                {gameState.combo > 0 && (
                  // below the canvas on desktop, overlaid on the canvas bottom
                  // on narrow screens (e.g mobile users/non-widescreen users) where it would otherwise sit below the
                  // fold. pointer-events-none so lane taps pass through.
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center sm:static sm:-mt-2">
                    <span
                      ref={comboRef}
                      className="font-yorha text-4xl tracking-[4px] text-primary"
                    >
                      {gameState.combo}x
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
