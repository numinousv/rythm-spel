import { Routes, Route } from "react-router";
import { HomePage } from "../pages/HomePage";
import { GamePage } from "../pages/GamePage";
import { ResultsPage } from "../pages/ResultsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  );
}
