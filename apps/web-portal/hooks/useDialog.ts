import { useState } from "react";

interface DialogState<T> {
  isOpen: boolean;
  data: T | null;
}

export function useDialog<T>(initial?: T) {
  const [state, setState] = useState<DialogState<T>>({
    isOpen: false,
    data: initial ?? null,
  });

  return {
    isOpen: state.isOpen,
    data: state.data,
    open: (data?: T) =>
      setState((s) => ({ isOpen: true, data: data !== undefined ? data : s.data })),
    close: () => setState((s) => ({ ...s, isOpen: false })), // keeps data for exit animation
    reset: () => setState({ isOpen: false, data: null }), // clears data immediately
  };
}
