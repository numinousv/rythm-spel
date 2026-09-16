import { useState, useEffect } from "react";

interface TitleProps {
  title?: string;
  subtitle?: string;
  subtitle2?: string;
  subtitle3?: string;
  title2?: string;
}

const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

function scramble(
  target: string,
  onUpdate: (val: string) => void,
): ReturnType<typeof setInterval> {
  let iteration = 0;
  const interval = setInterval(() => {
    const result = target
      .split("")
      .map((char, i) => {
        if (char === " ") return " ";
        if (i < iteration) return target[i];
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      })
      .join("");
    onUpdate(result);
    if (iteration >= target.length) {
      clearInterval(interval);
    }
    iteration += 1 / 3;
  }, 30);
  return interval;
}

export function Title({
  title = "",
  subtitle = "",
  subtitle2 = "",
  subtitle3 = "",
  title2 = "",
}: TitleProps) {
  const [displayTitle, setDisplayTitle] = useState("");
  const [displaySubtitle, setDisplaySubtitle] = useState("");
  const [displaySubtitle2, setDisplaySubtitle2] = useState("");
  // subtitle3 intentionally has no display state/it renders without a
  // scramble effect (scrambling text glithced the game view, also optimizes the webapp).
  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];
    if (title) {
      intervals.push(scramble(title, setDisplayTitle));
    }
    if (subtitle) {
      intervals.push(scramble(subtitle, setDisplaySubtitle));
    }
    if (subtitle2) {
      intervals.push(scramble(subtitle2, setDisplaySubtitle2));
    }
    return () => intervals.forEach(clearInterval);
  }, [title, subtitle, subtitle2]);

  return (
    <div className="flex flex-row items-baseline gap-2">
      <h1 className="font-yorha text-[48px] font-light tracking-[8px] text-primary text-shadow-yorha uppercase">
        {displayTitle}
      </h1>
      {subtitle && (
        <h3 className="font-yorha text-2xl font-light tracking-normal text-primary">
          -{displaySubtitle}
        </h3>
      )}
      {subtitle2 && (
        <h4 className="font-yorha text-xs font-light tracking-normal text-primary">
          -{displaySubtitle2}
        </h4>
      )}
      {subtitle3 && (
        <h4 className="font-yorha text-xs font-light tracking-normal text-primary">
          -{subtitle3}
        </h4>
      )}
      {title2 && (
        <h1 className="font-yorha text-[48px] font-light tracking-[8px] text-primary text-shadow-yorha uppercase">
          {title2}
        </h1>
      )}
    </div>
  );
}
