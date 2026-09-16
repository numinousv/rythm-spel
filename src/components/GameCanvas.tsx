import { useRef, useEffect, useCallback } from "react";
import type { GameState, Difficulty } from "../types/game";
import { DIFFICULTY_CONFIG, LANE_COUNT, LANE_KEYS } from "../types/game";
import {
  judgeHit,
  releaseHold,
  updateMisses,
  calculateAccuracy,
  isSongFinished,
  lowerBoundTime,
  LEAD_IN_SECONDS,
} from "../services/gameEngine";
import { useVolume } from "../context/VolumeContext";
import { useTheme } from "./ThemeContext";
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
const PAUSE_BTN = { x: 365, y: 8, w: 28, h: 24 };
const FS_BTN = { x: 329, y: 8, w: 28, h: 24 };
const BTN_HIT_PAD = 6;
const RESUME_GRACE_SECONDS = 0.75;

const canFullscreen =
  typeof document !== "undefined" && !!document.fullscreenEnabled;

interface CanvasPalette {
  bg: string;
  sep: string;
  hitLine: string;
  keyText: string;
  lanes: [string, string, string, string];
  hit: string;
  miss: string;
  flashRgb: string;
}

// pending lanes stay neutral in both themes
// so unjudged notes never read as failed.
const PALETTES: Record<"light" | "dark", CanvasPalette> = {
  light: {
    bg: "#dad4bb",
    sep: "#c2bda6",
    hitLine: "#4e4b42",
    keyText: "#57544a",
    lanes: ["#6b6558", "#8a8172", "#57544a", "#2e2c26"],
    hit: "#4e8f62",
    miss: "#b3402f",
    flashRgb: "87, 84, 74",
  },
  dark: {
    bg: "#1e1e1a",
    sep: "#3a3832",
    hitLine: "#b4af9a",
    keyText: "#57544a",
    lanes: ["#9a917e", "#b4af9a", "#57544a", "#6e6858"],
    hit: "#5a9e6f",
    miss: "#8b3a3a",
    flashRgb: "180, 175, 154",
  },
};

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
  const { theme } = useTheme();
  const sfxVolumeRef = useRef(sfxVolume);
  sfxVolumeRef.current = sfxVolume;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const paletteRef = useRef<CanvasPalette>(PALETTES[theme]);
  paletteRef.current = PALETTES[theme];
  const staticRef = useRef<{
    theme: string;
    bg: HTMLCanvasElement;
    glow: HTMLCanvasElement;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(gameState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const aliveRef = useRef(true);
  const startedRef = useRef(false);
  const onStateUpdateRef = useRef(onStateUpdate);
  const difficultyRef = useRef(difficulty);
  const hitFlashRef = useRef(0);
  const missShakeRef = useRef(0);

  const sfxCtxRef = useRef<AudioContext | null>(null);
  const sfxBuffersRef = useRef<{
    hit: AudioBuffer | null;
    miss: AudioBuffer | null;
    tick: AudioBuffer | null;
  }>({ hit: null, miss: null, tick: null });
  const tickNodesRef = useRef<{
    source: AudioBufferSourceNode;
    gain: GainNode;
  } | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);
  // identifier -> lane: tracks each finger independently so holds and taps
  // can overlap across lanes.
  const touchLanesRef = useRef<Map<number, number>>(new Map());
  const frameRef = useRef(0);
  const lastPushedRef = useRef({ combo: 0, score: 0 });
  const prevAudioUrlRef = useRef<string | null>(null);
  const fsComboRef = useRef(0);
  const comboPopRef = useRef(0);
  const clockRef = useRef({ anchorPerf: 0, anchorTime: 0 });
  const graceRef = useRef(LEAD_IN_SECONDS);

  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
    difficultyRef.current = difficulty;
  });

  useEffect(() => {
    // performance-fix: lagging React snapshots clobbers fresher engine state;
    // reverting a "hit" to "pending" would double-count the miss.
    if (gameState.elapsed >= stateRef.current.elapsed) {
      stateRef.current = gameState;
    }
  }, [gameState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = musicVolume;
  }, [musicVolume]);

  const playSfx = useCallback((kind: "hit" | "miss") => {
    const ctx = sfxCtxRef.current;
    const buf = sfxBuffersRef.current[kind];
    if (!ctx || !buf) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = sfxVolumeRef.current;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }, []);

  const playHitSound = useCallback(() => playSfx("hit"), [playSfx]);

  const playMissSound = useCallback(() => playSfx("miss"), [playSfx]);

  const getLaneColor = useCallback((lane: number) => {
    return paletteRef.current.lanes[lane % LANE_COUNT];
  }, []);

  useEffect(() => {
    // more performance-optimization:
    // prerendered once per theme: playfield, lane separators, key labels,
    // hit-flash glow sprite. rebuilt when the theme flips.
    const ensureStatic = (): {
      bg: HTMLCanvasElement;
      glow: HTMLCanvasElement;
    } => {
      const theme = themeRef.current;
      const cached = staticRef.current;
      if (cached && cached.theme === theme) return cached;

      const palette = PALETTES[theme];

      const bg = document.createElement("canvas");
      bg.width = CANVAS_WIDTH;
      bg.height = CANVAS_HEIGHT;
      const b = bg.getContext("2d");
      if (b) {
        b.fillStyle = palette.bg;
        b.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        b.strokeStyle = palette.sep;
        b.lineWidth = 1;
        for (let i = 1; i < LANE_COUNT; i++) {
          b.beginPath();
          b.moveTo(i * LANE_WIDTH, 0);
          b.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
          b.stroke();
        }
        b.fillStyle = palette.keyText;
        b.font = "16px Manrope, monospace";
        b.textAlign = "center";
        for (let i = 0; i < LANE_COUNT; i++) {
          b.fillText(
            LANE_KEYS[i].toUpperCase(),
            i * LANE_WIDTH + LANE_WIDTH / 2,
            HIT_LINE_Y + 40,
          );
        }
      }

      const glow = document.createElement("canvas");
      glow.width = CANVAS_WIDTH;
      glow.height = 120;
      const g = glow.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(
          CANVAS_WIDTH / 2,
          60,
          0,
          CANVAS_WIDTH / 2,
          60,
          CANVAS_WIDTH / 2,
        );
        grad.addColorStop(0, `rgba(${palette.flashRgb}, 0.15)`);
        grad.addColorStop(1, `rgba(${palette.flashRgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, CANVAS_WIDTH, 120);
      }

      staticRef.current = { theme, bg, glow };
      return staticRef.current;
    };

    if (document.fonts) {
      // key letters bake the webfont into the static layer. rebuild once it
      // arrives instead of shipping fallback glyphs.
      document.fonts.ready
        .then(() => {
          staticRef.current = null;
        })
        .catch(() => {});
    }

    const draw = (ctx: CanvasRenderingContext2D) => {
      const state = stateRef.current;
      const elapsed = state.elapsed;
      const palette = paletteRef.current;
      const statics = ensureStatic();

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(statics.bg, 0, 0);

      const now = performance.now();
      const shakeOffset =
        now - missShakeRef.current < MISS_SHAKE_DURATION
          ? Math.sin((now - missShakeRef.current) * 0.05) * 3
          : 0;

      ctx.save();
      ctx.translate(shakeOffset, 0);

      const flashActive = now - hitFlashRef.current < HIT_FLASH_DURATION;
      const flashProgress = flashActive
        ? 1 - (now - hitFlashRef.current) / HIT_FLASH_DURATION
        : 0;

      ctx.strokeStyle = flashActive
        ? `rgba(${palette.flashRgb}, ${0.4 + flashProgress * 0.6})`
        : palette.hitLine;
      ctx.lineWidth = flashActive ? 3 + flashProgress * 4 : 2;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(CANVAS_WIDTH, HIT_LINE_Y);
      ctx.stroke();

      if (flashActive) {
        ctx.globalAlpha = flashProgress;
        ctx.drawImage(statics.glow, 0, HIT_LINE_Y - 60);
        ctx.globalAlpha = 1;
      }

      const scrollSpeed = DIFFICULTY_CONFIG[difficultyRef.current].scrollSpeed;

      const startIdx = lowerBoundTime(
        state.notes,
        elapsed - (HIT_LINE_Y + 200) / scrollSpeed - 1.5,
      );
      const endTime = elapsed + (HIT_LINE_Y + 200) / scrollSpeed;

      for (
        let i = startIdx;
        i < state.notes.length && state.notes[i].time <= endTime;
        i++
      ) {
        const note = state.notes[i];
        if (note.status === "holding") continue;

        const noteY = HIT_LINE_Y - (note.time - elapsed) * scrollSpeed;

        if (noteY < -200 || noteY > CANVAS_HEIGHT + 200) continue;

        const noteX = note.lane * LANE_WIDTH + 10;
        const noteW = LANE_WIDTH - 20;

        if (note.type === "hold" && note.holdDuration > 0) {
          const tailFullHeight = note.holdDuration * scrollSpeed;
          {
            const tailY = noteY - tailFullHeight;
            const tailBottom = noteY + NOTE_HEIGHT / 2;

            if (note.status === "hit") {
              ctx.globalAlpha = 0.3;
              ctx.fillStyle = palette.hit;
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            } else if (note.status === "missed") {
              ctx.globalAlpha = 0.4;
              ctx.fillStyle = palette.miss;
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            } else {
              const fade =
                noteY > HIT_LINE_Y
                  ? Math.min((noteY - HIT_LINE_Y) / 100, 1)
                  : 0;
              ctx.globalAlpha = 1 - fade * 0.6;
              ctx.fillStyle = getLaneColor(note.lane);
              ctx.fillRect(noteX, tailY, noteW, tailBottom - tailY);
            }

            ctx.globalAlpha =
              note.status === "hit"
                ? 0.3
                : note.status === "missed"
                  ? 0.4
                  : noteY > HIT_LINE_Y
                    ? 1 - Math.min((noteY - HIT_LINE_Y) / 100, 1) * 0.6
                    : 1;
            ctx.fillStyle =
              note.status === "hit"
                ? palette.hit
                : note.status === "missed"
                  ? palette.miss
                  : getLaneColor(note.lane);
            ctx.fillRect(noteX, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT);
          }
        } else {
          if (note.status === "hit") {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = palette.hit;
          } else if (note.status === "missed") {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = palette.miss;
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

      for (const note of state.notes) {
        if (note.status !== "holding") continue;
        const tailFullHeight = note.holdDuration * scrollSpeed;
        const holdProgress = Math.max(
          0,
          Math.min(1, (elapsed - note.time) / note.holdDuration),
        );
        const remainingTail = tailFullHeight * (1 - holdProgress);
        const noteX = note.lane * LANE_WIDTH + 10;
        const noteW = LANE_WIDTH - 20;

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = getLaneColor(note.lane);
        ctx.fillRect(noteX, HIT_LINE_Y - remainingTail, noteW, remainingTail);
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.hit;
        ctx.fillRect(noteX, HIT_LINE_Y - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT);
        ctx.globalAlpha = 1;
      }

      const progress = Math.min(elapsed / songDuration, 1);
      ctx.fillStyle = palette.sep;
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH, 4);
      ctx.fillStyle = palette.hitLine;
      ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH * progress, 4);

      ctx.restore();

      ctx.fillStyle = palette.keyText;
      ctx.fillRect(PAUSE_BTN.x, PAUSE_BTN.y, 6, PAUSE_BTN.h);
      ctx.fillRect(PAUSE_BTN.x + 14, PAUSE_BTN.y, 6, PAUSE_BTN.h);

      ctx.strokeStyle = palette.keyText;
      ctx.lineWidth = 2;
      ctx.strokeRect(FS_BTN.x + 4, FS_BTN.y + 4, 20, 16);

      if (!startedRef.current) {
        ctx.fillStyle = "rgba(30, 30, 26, 0.75)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#b4af9a";
        ctx.font = "24px Manrope, monospace";
        ctx.textAlign = "center";
        ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = "12px Manrope, monospace";
        ctx.fillStyle = "#57544a";
        ctx.fillText(
          "Tap the lanes · D F J K · Space/Pause-Button pauses",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 30,
        );
      }

      if (pausedRef.current) {
        ctx.fillStyle = "rgba(30, 30, 26, 0.7)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#b4af9a";
        ctx.font = "24px Manrope, monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = "12px Manrope, monospace";
        ctx.fillStyle = "#57544a";
        ctx.fillText(
          "SPACE / tap ⏸ to resume",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 30,
        );
      }

      // fullscreen-only HUD: both fullscreen modes hide the DOM combo below
      // the canvas, so mirror it here. plain canvas text costs nothing per
      // frame (no DOM churn), unlike the remount-based DOM pulse.
      const fsActive =
        !!document.fullscreenElement ||
        !!wrapRef.current?.classList.contains("game-pseudo-fullscreen");
      if (fsActive && state.combo > 0) {
        if (state.combo !== fsComboRef.current) {
          fsComboRef.current = state.combo;
          comboPopRef.current = now;
        }
        // pop animation mirroring the WAAPI pulse of the DOM counter.
        const k = Math.min(1, (now - comboPopRef.current) / 250);
        const scale =
          k >= 1 ? 1 : k < 0.3 ? 1 + k : 1.3 - (0.3 * (k - 0.3)) / 0.7;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(CANVAS_WIDTH / 2, 48);
        ctx.scale(scale, scale);
        ctx.fillStyle = palette.hitLine;
        ctx.font = "30px Manrope, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${state.combo}x`, 0, 0);
        ctx.restore();
      }
    };

    const resyncClock = () => {
      const audio = audioRef.current;
      clockRef.current = {
        anchorPerf: performance.now(),
        anchorTime: audio ? audio.currentTime : 0,
      };
    };

    const nowElapsed = (): number => {
      const audio = audioRef.current;
      const c = clockRef.current;
      if (!audio || c.anchorPerf === 0) return audio?.currentTime ?? 0;
      return Math.max(
        0,
        c.anchorTime + (performance.now() - c.anchorPerf) / 1000,
      );
    };

    const gameLoop = () => {
      if (!aliveRef.current) return;

      if (pausedRef.current) {
        const pausedCanvas = canvasRef.current;
        const pausedCtx = pausedCanvas?.getContext("2d");
        if (pausedCtx) draw(pausedCtx);
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      // currentTime is quantized on some platforms (mobile/Firefox), which
      // reads as choppy motion. using perf-clock instead: smooth
      // per-frame gliding with no visible snaps, same clock for rendering
      // and judgment.
      const mediaTime = audio.currentTime;
      const err = mediaTime - nowElapsed();
      if (err !== 0) {
        const corr = Math.max(-0.05, Math.min(0.05, err * 0.05));
        clockRef.current.anchorTime += corr;
      }
      const elapsed = nowElapsed();
      let state = { ...stateRef.current, elapsed };

      state = updateMisses(
        state,
        elapsed,
        difficultyRef.current,
        heldKeysRef.current,
        graceRef.current,
      );

      const isHolding = state.notes.some((n) => n.status === "holding");
      const sfxCtx = sfxCtxRef.current;
      const tickBuf = sfxBuffersRef.current.tick;
      if (sfxCtx && tickBuf) {
        // native loop of the wav tail. created/stopped only on transitions,
        // never touched per frame.
        if (isHolding && !tickNodesRef.current) {
          const source = sfxCtx.createBufferSource();
          source.buffer = tickBuf;
          source.loop = true;
          source.loopStart = Math.max(0, tickBuf.duration - 0.15);
          source.loopEnd = tickBuf.duration;
          const gain = sfxCtx.createGain();
          gain.gain.value = sfxVolumeRef.current;
          source.connect(gain);
          gain.connect(sfxCtx.destination);
          source.start(0, source.loopStart);
          tickNodesRef.current = { source, gain };
        } else if (!isHolding && tickNodesRef.current) {
          const nodes = tickNodesRef.current;
          tickNodesRef.current = null;
          try {
            nodes.source.stop();
          } catch {
            /* already stopped */
          }
          nodes.source.disconnect();
          nodes.gain.disconnect();
        } else if (isHolding && tickNodesRef.current) {
          tickNodesRef.current.gain.gain.value = sfxVolumeRef.current;
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

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) draw(ctx);
      }

      frameRef.current += 1;
      const last = lastPushedRef.current;
      // canvas renders every requestAnimationFrame, but react only needs periodic score ticks.
      // combo/score changes push instantly so hit feedback stays snappy.
      if (
        frameRef.current % pushEvery === 0 ||
        state.combo !== last.combo ||
        state.score !== last.score
      ) {
        lastPushedRef.current = { combo: state.combo, score: state.score };
        onStateUpdateRef.current(state);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    const togglePause = () => {
      const audio = audioRef.current;
      if (!audio) return;

      pausedRef.current = !pausedRef.current;
      if (pausedRef.current) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
        resyncClock();
        graceRef.current = nowElapsed() + RESUME_GRACE_SECONDS;
      }
    };

    const startGame = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const ctx = sfxCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      audioRef.current?.play().catch(() => {});
      resyncClock();
    };

    const toggleFullscreen = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (canFullscreen && wrap.requestFullscreen) {
        wrap.requestFullscreen().catch(() => {});
      } else {
        // iOS Safari has no fullscreen API: emulate with a fixed overlay (improves performance a lot)
        wrap.classList.toggle("game-pseudo-fullscreen");
      }
    };

    const pressLane = (laneIndex: number) => {
      if (!startedRef.current || pausedRef.current) return;

      heldKeysRef.current.add(LANE_KEYS[laneIndex]);

      const elapsed = nowElapsed();
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

    const releaseLane = (laneIndex: number) => {
      heldKeysRef.current.delete(LANE_KEYS[laneIndex]);

      const elapsed = nowElapsed();
      const state = { ...stateRef.current, elapsed };
      const newState = releaseHold(
        state,
        laneIndex,
        elapsed,
        difficultyRef.current,
        graceRef.current,
      );
      if (newState !== state) {
        stateRef.current = newState;
        onStateUpdateRef.current(newState);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!startedRef.current) {
          startGame();
        } else {
          togglePause();
        }
        return;
      }

      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (laneIndex === -1) return;
      e.preventDefault();
      pressLane(laneIndex);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (laneIndex === -1) return;
      releaseLane(laneIndex);
    };

    const getTouchLane = (touch: Touch): number => {
      const canvas = canvasRef.current;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const lane = Math.floor(x / (rect.width / LANE_COUNT));
      return lane >= 0 && lane < LANE_COUNT ? lane : -1;
    };

    const toCanvasCoords = (
      clientX: number,
      clientY: number,
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) * CANVAS_WIDTH) / rect.width,
        y: ((clientY - rect.top) * CANVAS_HEIGHT) / rect.height,
      };
    };

    const isBtnHit = (
      coords: { x: number; y: number } | null,
      btn: { x: number; y: number; w: number; h: number },
    ): boolean => {
      if (!coords) return false;
      return (
        coords.x >= btn.x - BTN_HIT_PAD &&
        coords.x <= btn.x + btn.w + BTN_HIT_PAD &&
        coords.y >= btn.y - BTN_HIT_PAD &&
        coords.y <= btn.y + btn.h + BTN_HIT_PAD
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (!startedRef.current) {
        startGame();
        return;
      }

      for (const touch of Array.from(e.changedTouches)) {
        const coords = toCanvasCoords(touch.clientX, touch.clientY);
        // buttons stay usable while paused. only lane input is blocked, so
        // a paused game can always be resumed by touch.
        if (isBtnHit(coords, PAUSE_BTN)) {
          togglePause();
          continue;
        }
        if (isBtnHit(coords, FS_BTN)) {
          toggleFullscreen();
          continue;
        }
        if (pausedRef.current) continue;
        const lane = getTouchLane(touch);
        if (lane === -1) continue;
        const laneAlreadyTouched = Array.from(
          touchLanesRef.current.values(),
        ).includes(lane);
        touchLanesRef.current.set(touch.identifier, lane);
        if (!laneAlreadyTouched) {
          pressLane(lane);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      for (const touch of Array.from(e.changedTouches)) {
        const lane = touchLanesRef.current.get(touch.identifier);
        touchLanesRef.current.delete(touch.identifier);
        if (lane === undefined) continue;

        const stillTouched = Array.from(
          touchLanesRef.current.values(),
        ).includes(lane);
        if (!stillTouched) {
          releaseLane(lane);
        }
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (!startedRef.current) {
        startGame();
        return;
      }
      const coords = toCanvasCoords(e.clientX, e.clientY);
      if (isBtnHit(coords, PAUSE_BTN)) {
        togglePause();
      } else if (isBtnHit(coords, FS_BTN)) {
        toggleFullscreen();
      }
    };

    // losing focus (alt-tab, app switch) would strand "holding" notes and
    // soft-lock song end; release everything like a physical key-up.
    const handleBlur = () => {
      for (const key of Array.from(heldKeysRef.current)) {
        const laneIndex = LANE_KEYS.indexOf(key);
        if (laneIndex !== -1) releaseLane(laneIndex);
      }
      touchLanesRef.current.clear();
    };

    // never let the browser
    // steal a gesture mid-hold for scroll/zoom handling.
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    const handleTouchCancel = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        const lane = touchLanesRef.current.get(touch.identifier);
        touchLanesRef.current.delete(touch.identifier);
        if (lane === undefined) continue;

        const stillTouched = Array.from(
          touchLanesRef.current.values(),
        ).includes(lane);
        if (!stillTouched) {
          releaseLane(lane);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resyncClock();
      }
    };

    if (!audioUrl) return;

    if (audioUrl !== prevAudioUrlRef.current) {
      // new song on the same mounted component: full engine reset. Scoped
      // to song changes only so volume-slider re-renders can't wipe progress.
      prevAudioUrlRef.current = audioUrl;
      stateRef.current = gameState;
      frameRef.current = 0;
      fsComboRef.current = 0;
      lastPushedRef.current = { combo: 0, score: 0 };
      clockRef.current = { anchorPerf: performance.now(), anchorTime: 0 };
      graceRef.current = LEAD_IN_SECONDS;
    }

    const pushEvery = window.matchMedia("(pointer: coarse)").matches ? 20 : 10;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.volume = musicVolume;
    audio.playbackRate = 1;

    const sfxCtx = new AudioContext();
    sfxCtxRef.current = sfxCtx;
    let sfxCancelled = false;
    (async () => {
      try {
        const [hitAb, missAb, tickAb] = await Promise.all([
          fetch(hitSoundUrl).then((r) => r.arrayBuffer()),
          fetch(missSoundUrl).then((r) => r.arrayBuffer()),
          fetch(slidertickUrl).then((r) => r.arrayBuffer()),
        ]);
        if (sfxCancelled) return;
        const [hit, miss, tick] = await Promise.all([
          sfxCtx.decodeAudioData(hitAb),
          sfxCtx.decodeAudioData(missAb),
          sfxCtx.decodeAudioData(tickAb),
        ]);
        if (!sfxCancelled) {
          sfxBuffersRef.current = { hit, miss, tick };
        }
      } catch {
        /* SFX silently unavailable */
      }
    })();

    aliveRef.current = true;
    animFrameRef.current = requestAnimationFrame(gameLoop);

    if (window.matchMedia("(max-width: 640px)").matches) {
      canvasRef.current?.scrollIntoView({ block: "start" });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      canvas.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", handleTouchCancel, {
        passive: false,
      });
      canvas.addEventListener("click", handleCanvasClick);
    }

    return () => {
      aliveRef.current = false;
      sfxCancelled = true;
      pausedRef.current = false;
      startedRef.current = false;
      touchLanesRef.current.clear();
      audio.pause();
      audio.src = "";
      if (tickNodesRef.current) {
        try {
          tickNodesRef.current.source.stop();
        } catch {
          /* already stopped */
        }
        tickNodesRef.current.source.disconnect();
        tickNodesRef.current.gain.disconnect();
        tickNodesRef.current = null;
      }
      sfxCtx.close().catch(() => {});
      sfxCtxRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
        canvas.removeEventListener("touchcancel", handleTouchCancel);
        canvas.removeEventListener("click", handleCanvasClick);
      }
    };
  }, [audioUrl, getLaneColor, songDuration]);

  return (
    <div ref={wrapRef} className="flex justify-center game-fullscreen">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-muted touch-none max-w-full h-auto"
      />
    </div>
  );
}
