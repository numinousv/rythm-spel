import { useState } from "react";
import hero from "./assets/hero.png";
//import "./App.css";
// import "./index.css";
import { Title, useTheme, Strip, Switch, Button, Card } from "./components";
export function App() {
  const [count, setCount] = useState(0);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-225 mx-auto my-8 flex flex-col gap-4 px-4">
      <section className="py-2 flex justify-end">
        <Switch
          label={theme === "dark" ? "Dark Mode" : "Light Mode"}
          checked={theme === "dark"}
          onCheckedChange={toggleTheme}
        />
      </section>

      <section className="py-2">
        <Title title="SYSTEM" subtitle="aHRoY" />
      </section>
      <Strip />
      <section id="center">
        <div className="content-center justify-center flex items-center mx-auto">
          <Card
            title="placeholder"
            layout="fill"
            className="w-xl content-center justify-center flex items-center"
          >
            <img
              src={hero}
              className="content-center justify-center flex items-center mx-auto"
              width="200"
              height="179"
              alt=""
            />
          </Card>
        </div>
      </section>
      <section>
        <div className="py-5 text-center">
          <Card
            title="-- initial work --"
            layout="fill"
            className="content-center justify-center flex items-center mx-auto w-xl"
          >
            <h2
              className="font-yorha text-[32px] font-light tracking-[8px] py-5 text-primary text-shadow-yorha uppercase 
              content-center justify-center flex items-center mx-auto w-lg"
            >
              <Title subtitle="! WIP ! WIP ! WIP !" />
            </h2>
            <p>test-0</p>
          </Card>
        </div>
        <Strip />
      </section>
      <section>
        <div className="flex flex-col max-w-40 content-center justify-center items-center mx-auto">
          <Button type="button" onClick={() => setCount((count) => count + 1)}>
            Count is {count}
          </Button>
        </div>
      </section>
    </div>
  );
}
