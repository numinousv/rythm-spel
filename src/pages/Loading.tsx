import { useEffect, useRef, useState } from "react";
import { LoadingDots, SpinLoadingIcon } from "../components";
import yorhaLogo from "../assets/yorhalogo.png";

const LOG_LINES = [
  "> CHECKING SYSTEM ...",
  "> MEMORY ................ OK",
  "> AUDIO MODULE .......... OK",
  "> RHYTHM ENGINE ......... OK",
  "> ALL SYSTEMS NOMINAL",
];

const LINE_INTERVAL_MS = 400;
const DONE_DELAY_MS = 600;

// boot overlay inspired by the loading screen in NieR
export function Loading({ onDone }: { onDone: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (visibleCount >= LOG_LINES.length) {
      const t = setTimeout(() => onDoneRef.current(), DONE_DELAY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [visibleCount]);

  return (
    <main className="fixed inset-0 z-100 flex flex-col bg-[#0e0d0b] px-[4%] py-[2%] pb-[4%] font-yorha text-[#d1cdb7]">
      <img
        src={yorhaLogo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto w-[min(60vw,480px)] opacity-15"
      />
      <header className="flex items-center justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-[clamp(20px,4vw,48px)] font-light uppercase tracking-[8px] opacity-90 [text-shadow:0px_0px_5px_rgba(255,255,255,0.8)]">
            Loading
            <LoadingDots />
          </h1>
          <p className="text-sm tracking-[1px] opacity-80 [text-shadow:0px_0px_5px_rgba(255,255,255,0.6)]">
            - CHECKING SYSTEM
          </p>
        </div>
        <SpinLoadingIcon />
      </header>
      <section className="relative ml-[2%] mt-6 text-sm leading-[4vh] tracking-[1px]">
        {LOG_LINES.slice(0, visibleCount).map((line) => (
          <p key={line} className="opacity-80">
            {line}
          </p>
        ))}
        {visibleCount < LOG_LINES.length && (
          <p className="animate-pulse opacity-80">▌</p>
        )}
      </section>
    </main>
  );
}
