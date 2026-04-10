'use client';

interface AutoSaveIndicatorProps {
  lastSaved: Date | null;
  saving: boolean;
}

export function AutoSaveIndicator({ lastSaved, saving }: AutoSaveIndicatorProps) {
  if (saving) {
    return (
      <span className="text-xs text-muted-foreground animate-pulse transition-opacity duration-300">
        Saving...
      </span>
    );
  }

  if (!lastSaved) return null;

  const time = lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <span
      key={lastSaved.getTime()}
      className="text-xs text-muted-foreground animate-auto-save-fade"
    >
      Draft saved at {time}
    </span>
  );
}
