'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const THEMES = ['light', 'dark', 'system'] as const;
type Theme = (typeof THEMES)[number];

const ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const current = (theme as Theme) ?? 'system';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  };

  const current = (theme as Theme) ?? 'system';

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Toggle theme">
      {ICONS[current]}
    </Button>
  );
}
