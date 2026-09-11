import { useRef, useEffect, useCallback } from "react";
import type { GameState, Difficulty } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT, LANE_KEYS } from "../types/game";
import {
  judgeHit,
  releaseHold,
  updateMisses,
  calculateAccuracy,
  isSongFinished,
} from "../services/gameEngine";
import { useVolume } from "../context/VolumeContext";
import hitSoundUrl from "../assets/soft-hitnormal.mp3";
import missSoundUrl from "../assets/soft-hitfail.mp3";
import slidertickUrl from "../assets/normal-slidertick.wav";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const NOTE_HEIGHT = 20;
const HIT_LINE_Y = CANVAS_HEIGHT - 80;
const HIT_FLASH_DURATION = 150;
const MISS_SHAKE_DURATION = 200;

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
  const { musicVolume, sfxVolume } = useVolume();
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
  const slidertickRef = useRef<HTMLAudioElement | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);

  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
    difficultyRef.current = difficulty;
  });

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = musicVolume;
  }, [musicVolume]);

  const playHitSound = useCallback(() => {
    const audio = hitSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = sfxVolume;
    audio.play().catch(() => {});
  }, [sfxVolume]);

  const playMissSound = useCallback(() => {
    const audio = missSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = sfxVolume;
    audio.play().catch(() => {});
  }, [sfxVolume]);

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

      const scrollSpeed = DIFFICULTY_CONFIG[difficultyRef.current].scrollSpeed;

      for (const note of state.notes) {
        const noteY =
          HIT_LINE_Y - (note.time - elapsed) * scrollSpeed;

        if (note.status !== "holding" && (noteY < -200 || noteY > CANVAS_HEIGHT + 200)) continue;

        const noteX = note.lane * LANE_WIDTH + 10;
        const noteW = LANE_WIDTH - 20;

        if (note.type === "hold" && note.holdDuration > 0) {
          const tailFullHeight = note.holdDuration * scrollSpeed;

          if (note.status === "holding") {
            const holdProgress = Math.max(
              0,
              Math.min(1, (elapsed - note.time) / note.holdDuration),
            );
            const remainingTail = tailFullHeight * (1 - holdProgress);
            const headY = HIT_LINE_Y;

            ctx.globalAlpha = 0.4;
            ctx.fillStyle = getLaneColor(note.lane);
            ctx.fillRect(noteX, headY - remainingTail, noteW, remainingTail);
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#5a9e6f";
            ctx.fillRect(noteX, headY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT);
          } else {
            const tailY = noteY - tailFullHeight;
            const tailBottom = noteY + NOTE_HEIGHT / 2;

            if (note.status === "hit") {
              ctx.globalAlpha = 0.3;
              ctx.fillStyle = "#5a9e6f";
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            } else if (note.status === "missed") {
              ctx.globalAlpha = 0.4;
              ctx.fillStyle = "#8b3a3a";
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            } else {
              const fade = noteY > HIT_LINE_Y
                ? Math.min((noteY - HIT_LINE_Y) / 100, 1)
                : 0;
              ctx.globalAlpha = 1 - fade * 0.6;
              ctx.fillStyle = getLaneColor(note.lane);
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            }

            ctx.globalAlpha =
              note.status === "hit" ? 0.3 :
              note.status === "missed" ? 0.4 :
              noteY > HIT_LINE_Y ? 1 - Math.min((noteY - HIT_LINE_Y) / 100, 1) * 0.6 : 1;
            ctx.fillStyle =
              note.status === "hit" ? "#5a9e6f" :
              note.status === "missed" ? "#8b3a3a" :
              getLaneColor(note.lane);
            ctx.fillRect(noteX, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT);
          }
        } else {
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

          ctx.fillRect(noteX, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT);
        }
        ctx.globalAlpha = 1;
      }

      const progress = Math.min(elapsed / songDuration, 1);
      ctx.fillStyle = "#3a3832";
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH, 4);
      ctx.fillStyle = "#b4af9a";
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH * progress, 4);

      ctx.restore();

      if (pausedRef.current) {
        ctx.fillStyle = "rgba(30, 30, 26, 0.7)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#b4af9a";
        ctx.font = "24px Manrope, monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = "12px Manrope, monospace";
        ctx.fillStyle = "#57544a";
        ctx.fillText("Press SPACE to resume", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
      }
    };

    const gameLoop = () => {
      if (pausedRef.current) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      const elapsed = audio.currentTime;
      let state = { ...stateRef.current, elapsed };

      state = updateMisses(state, elapsed, difficultyRef.current, heldKeysRef.current);

      const isHolding = state.notes.some((n) => n.status === "holding");
      const stick = slidertickRef.current;
      if (stick) {
        if (isHolding && stick.paused) {
          const loopStart = Math.max(0, stick.duration - 0.15);
          stick.currentTime = loopStart;
          stick.volume = sfxVolume;
          stick.play().catch(() => {});
        } else if (!isHolding && !stick.paused) {
          stick.pause();
          stick.currentTime = 0;
        } else if (isHolding) {
          stick.volume = sfxVolume;
          const loopStart = Math.max(0, stick.duration - 0.15);
          if (stick.currentTime >= loopStart + 0.1) {
            stick.currentTime = loopStart;
          }
        }
      }

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
      if (e.repeat) return;

      if (e.code === "Space") {
        e.preventDefault();
        const audio = audioRef.current;
        if (!audio) return;

        pausedRef.current = !pausedRef.current;
        if (pausedRef.current) {
          audio.pause();
        } else {
          audio.play().catch(() => {});
        }
        return;
      }

      if (pausedRef.current) return;

      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (laneIndex === -1) return;

      heldKeysRef.current.add(e.key.toLowerCase());

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

    const handleKeyUp = (e: KeyboardEvent) => {
      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (laneIndex === -1) return;

      heldKeysRef.current.delete(e.key.toLowerCase());

      const audio = audioRef.current;
      if (!audio) return;

      const elapsed = audio.currentTime;
      const state = { ...stateRef.current, elapsed };
      const newState = releaseHold(state, laneIndex, elapsed, difficultyRef.current);
      if (newState !== state) {
        stateRef.current = newState;
        onStateUpdateRef.current(newState);
      }
    };

    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.volume = musicVolume;
    audio.playbackRate = 1;

    const hitSound = new Audio(hitSoundUrl);
    const missSound = new Audio(missSoundUrl);
    const slidertick = new Audio(slidertickUrl);
    hitSoundRef.current = hitSound;
    missSoundRef.current = missSound;
    slidertickRef.current = slidertick;

    audio.onplay = () => {
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    audio.play().catch(console.error);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      pausedRef.current = false;
      audio.pause();
      audio.src = "";
      hitSound.pause();
      missSound.pause();
      slidertick.pause();
      slidertick.currentTime = 0;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [audioUrl, getLaneColor, songDuration, playHitSound, playMissSound, musicVolume]);

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
