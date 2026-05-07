"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const activeTheme = theme ?? "system";

  return (
    <div className="theme-toggle" aria-label="Tema visual">
      <div className="theme-toggle-options" role="group" aria-label="Cambiar tema">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = activeTheme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`theme-toggle-option ${isActive ? "active" : ""}`}
              onClick={() => setTheme(option.value)}
              aria-pressed={isActive}
              title={option.label}
            >
              <Icon aria-hidden />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
