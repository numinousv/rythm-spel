import { createContext, useContext, useState, type ReactNode } from "react";

interface VolumeContextValue {
  musicVolume: number;
  sfxVolume: number;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
}

const VolumeContext = createContext<VolumeContextValue>({
  musicVolume: 0.7,
  sfxVolume: 0.3,
  setMusicVolume: () => {},
  setSfxVolume: () => {},
});

export function useVolume() {
  return useContext(VolumeContext);
}

function readNum(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  return v !== null ? Number(v) : fallback;
}

export function VolumeProvider({ children }: { children: ReactNode }) {
  const [musicVolume, setMusicVolumeState] = useState(
    () => readNum("vol:music", 70) / 100,
  );
  const [sfxVolume, setSfxVolumeState] = useState(
    () => readNum("vol:sfx", 30) / 100,
  );

  const setMusicVolume = (v: number) => {
    setMusicVolumeState(v);
    localStorage.setItem("vol:music", String(Math.round(v * 100)));
  };

  const setSfxVolume = (v: number) => {
    setSfxVolumeState(v);
    localStorage.setItem("vol:sfx", String(Math.round(v * 100)));
  };

  return (
    <VolumeContext.Provider
      value={{ musicVolume, sfxVolume, setMusicVolume, setSfxVolume }}
    >
      {children}
    </VolumeContext.Provider>
  );
}
