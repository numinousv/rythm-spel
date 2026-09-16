import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router";
import { LoadingDots } from "../components";

const HomePage = lazy(() =>
  import("../pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const GamePage = lazy(() =>
  import("../pages/GamePage").then((m) => ({ default: m.GamePage })),
);
const ResultsPage = lazy(() =>
  import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage })),
);

function RouteFallback() {
  return (
    <div className="flex justify-center py-16 font-yorha text-sm tracking-[2px] text-primary">
      LOADING
      <LoadingDots />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Suspense>
  );
}

// optimization: warm the game chunk while the user is still on the home page so the
// transition feels instant
// later navigation resolves without another network round-trip.
export function prefetchGamePage() {
  void import("../pages/GamePage");
}

export function prefetchResultsPage() {
  void import("../pages/ResultsPage");
}
