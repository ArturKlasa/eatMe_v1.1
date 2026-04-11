// Mock for pdfjs-dist used in Vitest tests.
// pdfjs-dist requires a web worker loaded from /public/ which is unavailable in jsdom.
// Import this via `vi.mock('pdfjs-dist')` in tests that exercise pdfToImages.

import { vi } from 'vitest';

const mockRender = vi.fn().mockReturnValue({ promise: Promise.resolve() });
const mockGetViewport = vi.fn().mockReturnValue({ width: 100, height: 100 });
const mockGetPage = vi.fn().mockResolvedValue({
  getViewport: mockGetViewport,
  render: mockRender,
});
const mockPdf = {
  numPages: 2,
  getPage: mockGetPage,
};
const mockGetDocument = vi.fn().mockReturnValue({
  promise: Promise.resolve(mockPdf),
});

export const GlobalWorkerOptions = { workerSrc: '' };
export const getDocument = mockGetDocument;

export default {
  GlobalWorkerOptions,
  getDocument: mockGetDocument,
};
