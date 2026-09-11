import { useRef, useEffect, useCallback } from "react";
import type { GameState, Difficulty } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT, LANE_KEYS } from "../types/game";
import {
  judgeHit,
  updateMisses,
  calculateAccuracy,
  isSongFinished,
} from "../services/gameEngine";
import hitSoundUrl from "../assets/soft-hitnormal.mp3";
import missSoundUrl from "../assets/soft-hitfail.mp3";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const NOTE_HEIGHT = 20;
const HIT_LINE_Y = CANVAS_HEIGHT - 80;
const HIT_FLASH_DURATION = 150;
const MISS_SHAKE_DURATION = 200;
const SOUND_VOLUME = 0.3;

interface GameCanvasProps {
  gameState: GameState;
  difficulty: Difficulty;
  audioUrl: string | null;
  onStateUpdate: (state: GameState) => void;
  songDuration: number;
}

export function GameCanvas({
  gameState,
  difficulty,
  audioUrl,
  onStateUpdate,
  songDuration,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(gameState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const onStateUpdateRef = useRef(onStateUpdate);
  const difficultyRef = useRef(difficulty);
  const hitFlashRef = useRef(0);
  const missShakeRef = useRef(0);

  const hitSoundRef = useRef<HTMLAudioElement | null>(null);
  const missSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
    difficultyRef.current = difficulty;
  });

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const playHitSound = useCallback(() => {
    const audio = hitSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = SOUND_VOLUME;
    audio.play().catch(() => {});
  }, []);

  const playMissSound = useCallback(() => {
    const audio = missSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = SOUND_VOLUME;
    audio.play().catch(() => {});
  }, []);

  const getLaneColor = useCallback((lane: number) => {
    const colors = ["#cd664d", "#b4af9a", "#57544a", "#cd664d"];
    return colors[lane % colors.length];
  }, []);

  useEffect(() => {
    const draw = (ctx: CanvasRenderingContext2D) => {
      const state = stateRef.current;
      const elapsed = state.elapsed;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#1e1e1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const now = performance.now();
      const shakeOffset =
        now - missShakeRef.current < MISS_SHAKE_DURATION
          ? Math.sin((now - missShakeRef.current) * 0.05) * 3
          : 0;

      ctx.save();
      ctx.translate(shakeOffset, 0);

      ctx.strokeStyle = "#3a3832";
      ctx.lineWidth = 1;
      for (let i = 1; i < LANE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_WIDTH, 0);
        ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
        ctx.stroke();
      }

      const flashActive = now - hitFlashRef.current < HIT_FLASH_DURATION;
      const flashProgress = flashActive
        ? 1 - (now - hitFlashRef.current) / HIT_FLASH_DURATION
        : 0;

      ctx.strokeStyle = flashActive
        ? `rgba(180, 175, 154, ${0.4 + flashProgress * 0.6})`
        : "#b4af9a";
      ctx.lineWidth = flashActive ? 3 + flashProgress * 4 : 2;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(CANVAS_WIDTH, HIT_LINE_Y);
      ctx.stroke();

      if (flashActive) {
        const glow = ctx.createRadialGradient(
          CANVAS_WIDTH / 2, HIT_LINE_Y, 0,
          CANVAS_WIDTH / 2, HIT_LINE_Y, CANVAS_WIDTH / 2,
        );
        glow.addColorStop(0, `rgba(180, 175, 154, ${flashProgress * 0.15})`);
        glow.addColorStop(1, "rgba(180, 175, 154, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, HIT_LINE_Y - 60, CANVAS_WIDTH, 120);
      }

      ctx.fillStyle = "#57544a";
      ctx.font = "16px Manrope, monospace";
      ctx.textAlign = "center";
      for (let i = 0; i < LANE_COUNT; i++) {
        ctx.fillText(
          LANE_KEYS[i].toUpperCase(),
          i * LANE_WIDTH + LANE_WIDTH / 2,
          HIT_LINE_Y + 40,
        );
      }

      for (const note of state.notes) {
        const noteY =
          HIT_LINE_Y -
          (note.time - elapsed) *
            DIFFICULTY_CONFIG[difficultyRef.current].scrollSpeed;

        if (noteY < -NOTE_HEIGHT || noteY > CANVAS_HEIGHT + NOTE_HEIGHT)
          continue;

        const noteX = note.lane * LANE_WIDTH + 10;
        const noteW = LANE_WIDTH - 20;

        if (note.status === "hit") {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#5a9e6f";
        } else if (note.status === "missed") {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = "#8b3a3a";
        } else if (noteY > HIT_LINE_Y) {
          const fade = Math.min((noteY - HIT_LINE_Y) / 100, 1);
          ctx.globalAlpha = 1 - fade * 0.6;
          ctx.fillStyle = getLaneColor(note.lane);
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = getLaneColor(note.lane);
        }

        ctx.fillRect(noteX, noteY, noteW, NOTE_HEIGHT);
        ctx.globalAlpha = 1;
      }

      const progress = Math.min(elapsed / songDuration, 1);
      ctx.fillStyle = "#3a3832";
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH, 4);
      ctx.fillStyle = "#b4af9a";
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH * progress, 4);

      ctx.restore();
    };

    const gameLoop = () => {
      const audio = audioRef.current;
      if (!audio) return;

      const elapsed = audio.currentTime;
      let state = { ...stateRef.current, elapsed };

      state = updateMisses(state, elapsed, difficultyRef.current);

      stateRef.current = state;

      if (isSongFinished(state)) {
        state = {
          ...state,
          status: "finished",
          accuracy: calculateAccuracy(state),
        };
        stateRef.current = state;
        onStateUpdateRef.current(state);
        return;
      }

      onStateUpdateRef.current(state);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) draw(ctx);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (laneIndex === -1) return;

      const audio = audioRef.current;
      if (!audio) return;

      const elapsed = audio.currentTime;
      const state = { ...stateRef.current, elapsed };
      const result = judgeHit(state, laneIndex, elapsed, difficultyRef.current);
      stateRef.current = result.state;
      onStateUpdateRef.current(result.state);

      if (result.hit) {
        hitFlashRef.current = performance.now();
        playHitSound();
      } else {
        missShakeRef.current = performance.now();
        playMissSound();
      }
    };

    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = 1;

    const hitSound = new Audio(hitSoundUrl);
    const missSound = new Audio(missSoundUrl);
    hitSoundRef.current = hitSound;
    missSoundRef.current = missSound;

    audio.onplay = () => {
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    audio.play().catch(console.error);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      audio.pause();
      audio.src = "";
      hitSound.pause();
      missSound.pause();
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [audioUrl, getLaneColor, songDuration, playHitSound, playMissSound]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-muted"
      />
    </div>
  );
}
