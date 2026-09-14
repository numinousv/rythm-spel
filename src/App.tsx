import { useTheme, useVolume } from "./components";
import { Switch } from "./components";
import { AppRoutes } from "./app/routes";
import { Link } from "react-router";

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 sm:gap-3 font-yorha text-sm text-primary cursor-pointer">
      <span className="w-14 sm:w-20 text-right tracking-[1px]">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="volume-slider w-20 sm:w-24"
      />
      <span className="w-8 text-right text-xs opacity-70">
        {Math.round(value * 100)}
      </span>
    </label>
  );
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { musicVolume, sfxVolume, setMusicVolume, setSfxVolume } = useVolume();

  return (
    <div className="max-w-225 mx-auto my-4 sm:my-8 flex flex-col gap-4 px-4">
      <section className="py-2 flex flex-wrap justify-between items-center gap-x-4 gap-y-3">
        <Link
          to="/"
          className="font-yorha text-base font-bold text-primary opacity-70 hover:opacity-100 tracking-[1px] no-underline transition-opacity"
        >
          ▶ HOME
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-end">
          <VolumeSlider
            label="Music"
            value={musicVolume}
            onChange={setMusicVolume}
          />
          <VolumeSlider
            label="SFX"
            value={sfxVolume}
            onChange={setSfxVolume}
          />
          <Switch
            label={theme === "dark" ? "Dark" : "Light"}
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
          />
        </div>
      </section>
      <section className="flex justify-end">
        <span className="font-yorha text-xs text-primary opacity-50 tracking-[1px]">
          SPACE to pause
        </span>
      </section>
      <AppRoutes />
    </div>
  );
}
