import { useTheme } from "./components";
import { Switch } from "./components";
import { AppRoutes } from "./app/routes";

export function App() {
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
      <AppRoutes />
    </div>
  );
}
