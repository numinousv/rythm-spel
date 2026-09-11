import { useNavigate } from "react-router";
import { Title, Button, Card, Strip, Progress } from "../components";
import { DIFFICULTY_CONFIG } from "../types/game";
import type { Difficulty } from "../types/game";

export function ResultsPage() {
  const navigate = useNavigate();

  const rawState = sessionStorage.getItem("finalGameState");
  const songName = sessionStorage.getItem("songName") || "Unknown";
  const difficulty = (sessionStorage.getItem("difficulty") || "medium") as Difficulty;

  if (!rawState) {
    return (
      <div className="max-w-225 mx-auto my-8 flex flex-col gap-4 px-4">
        <section className="py-2">
          <Title title="RESULTS" subtitle="ERROR" />
        </section>
        <Strip />
        <section>
          <Card title="NO DATA" layout="fill">
            <div className="py-4 text-center">
              <p className="text-sm">No results found.</p>
              <Button type="button" onClick={() => navigate("/")} className="mt-4">
                Back to Menu
              </Button>
            </div>
          </Card>
        </section>
      </div>
    );
  }

  const state = JSON.parse(rawState);
  const accuracy = state.accuracy || 0;

  const grade =
    accuracy >= 95 ? "S" :
    accuracy >= 85 ? "A" :
    accuracy >= 70 ? "B" :
    accuracy >= 50 ? "C" : "D";

  const gradeColor =
    grade === "S" || grade === "A" ? "text-primary" :
    grade === "D" ? "text-alert" :
    "text-foreground";

  return (
    <div className="max-w-225 mx-auto my-8 flex flex-col gap-4 px-4">
      <section className="py-2">
        <Title title="RESULTS" subtitle={songName} />
      </section>
      <Strip />

      <section>
        <Card title="PERFORMANCE" layout="fill">
          <div className="flex flex-col gap-6 py-6 items-center">
            <div className={`font-yorha text-[72px] font-light tracking-[8px] ${gradeColor}`}>
              {grade}
            </div>

            <div className="w-full flex flex-col gap-3">
              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Accuracy</span>
                <span>{accuracy}%</span>
              </div>
              <Progress value={accuracy} />

              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Score</span>
                <span>{Math.round(state.score)}</span>
              </div>

              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Max Combo</span>
                <span>{state.maxCombo}</span>
              </div>

              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Hits</span>
                <span>{state.totalHits}</span>
              </div>

              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Misses</span>
                <span>{state.totalMisses}</span>
              </div>

              <div className="flex justify-between text-sm tracking-[1px]">
                <span>Difficulty</span>
                <span>{DIFFICULTY_CONFIG[difficulty].label}</span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card title="ACTIONS" layout="fill">
          <div className="flex flex-col gap-4 py-4">
            <Button type="button" onClick={() => navigate("/")}>
              Back to Menu
            </Button>
            <Button type="button" onClick={() => navigate("/game")}>
              Retry
            </Button>
          </div>
        </Card>
      </section>

      <Strip />
    </div>
  );
}
