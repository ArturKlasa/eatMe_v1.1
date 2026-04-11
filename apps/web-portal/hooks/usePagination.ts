import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPageState] = useState(1);
  const [prevLength, setPrevLength] = useState(items.length);

  // Reset to page 1 when items.length changes (synchronous during render — avoids useEffect setState)
  if (prevLength !== items.length) {
    setPrevLength(items.length);
    setPageState(1);
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setPageState(clamped);
  };

  return {
    page,
    totalPages,
    paginatedItems,
    setPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
