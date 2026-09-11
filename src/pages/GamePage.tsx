import { useState } from "react";
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
import { loadSavedSong } from "../utils/storage";

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

  const handleStart = async () => {
    try {
      const saved = await loadSavedSong();
      if (!saved) {
        navigate("/");
        return;
      }

      const diff = (sessionStorage.getItem("difficulty") as Difficulty) || "medium";

      setDifficulty(diff);
      setSongName(saved.name);
      setSongDuration(saved.duration);

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
          audioBuffer: {} as AudioBuffer,
        },
        diff,
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
    if (isSongFinished(newState) || (gameState && gameState.elapsed >= songDuration)) {
      const finalState = { ...newState, accuracy: calculateAccuracy(newState) };
      sessionStorage.setItem("finalGameState", JSON.stringify(finalState));
      sessionStorage.setItem("songName", songName);
      sessionStorage.setItem("difficulty", difficulty);
      navigate("/results");
    }
  };

  return (
    <div className="max-w-225 mx-auto my-8 flex flex-col gap-4 px-4">
      <section className="py-2">
        <Title title="GAME" subtitle={songName} />
      </section>
      <Strip />

      {!started ? (
        <section>
          <Card title="READY?" layout="fill">
            <div className="flex flex-col gap-4 py-4 items-center">
              <p className="text-sm tracking-[1px] text-center">
                Difficulty: {DIFFICULTY_CONFIG[difficulty].label}
              </p>
              <p className="text-xs tracking-[1px] text-center opacity-70">
                Keys: D F J K
              </p>
              <Button type="button" onClick={handleStart}>
                Start Game
              </Button>
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
              <GameCanvas
                gameState={gameState}
                difficulty={difficulty}
                audioUrl={audioUrl}
                onStateUpdate={handleGameStateUpdate}
                songDuration={songDuration}
              />
              {gameState.combo > 0 && (
                <div className="flex justify-center -mt-2">
                  <span
                    key={gameState.combo}
                    className="font-yorha text-4xl tracking-[4px] text-primary combo-pulse"
                  >
                    {gameState.combo}x
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
