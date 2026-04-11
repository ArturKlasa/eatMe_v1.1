import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resizeImageToBase64, pdfToImages } from '@/lib/menu-scan-utils';

// Mock pdfjs-dist at the top level — it uses a web worker that is unavailable in jsdom.
// See __mocks__/pdfjs-dist.ts for the reusable mock definition.
vi.mock('pdfjs-dist', () => ({
  default: {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
          render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
        }),
      }),
    }),
  },
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      }),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// resizeImageToBase64
// ---------------------------------------------------------------------------

describe('resizeImageToBase64', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let toDataURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock URL.createObjectURL / revokeObjectURL
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    // Mock canvas.toDataURL
    toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,MOCKBASE64DATA'
    );

    // Mock getContext to return a minimal 2D context
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    // Mock Image so that onload fires synchronously
    vi.stubGlobal(
      'Image',
      class {
        width = 800;
        height = 600;
        src = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(value: string) {
          // Fire onload asynchronously so the mock is realistic
          Promise.resolve().then(() => this.onload?.());
        }
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns correct name, mime_type, and data for a JPEG file', async () => {
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await resizeImageToBase64(file);

    expect(result.name).toBe('photo.jpg');
    expect(result.mime_type).toBe('image/jpeg');
    expect(result.data).toBe('MOCKBASE64DATA');
  });

  it('converts non-JPEG extension to .jpg', async () => {
    const file = new File(['fake'], 'photo.png', { type: 'image/png' });
    const result = await resizeImageToBase64(file);
    expect(result.name).toBe('photo.jpg');
  });

  it('calls URL.createObjectURL and revokeObjectURL', async () => {
    const file = new File(['fake'], 'test.jpg', { type: 'image/jpeg' });
    await resizeImageToBase64(file);

    expect(createObjectURLSpy).toHaveBeenCalledWith(file);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('calls canvas.toDataURL with image/jpeg and quality 0.82', async () => {
    const file = new File(['fake'], 'test.jpg', { type: 'image/jpeg' });
    await resizeImageToBase64(file);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.82);
  });
});

// ---------------------------------------------------------------------------
// pdfToImages
// ---------------------------------------------------------------------------

describe('pdfToImages', () => {
  beforeEach(() => {
    // Mock canvas.getContext
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    // Mock canvas.toBlob to call callback with a blob
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback) => {
        callback(new Blob(['fake-image'], { type: 'image/jpeg' }));
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a File array with one File per PDF page', async () => {
    const pdfFile = new File(['fake-pdf'], 'menu.pdf', { type: 'application/pdf' });
    const results = await pdfToImages(pdfFile);

    // The mock returns numPages: 2, so we expect 2 Files
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(File);
    expect(results[1]).toBeInstanceOf(File);
  });

  it('names output files with page numbers', async () => {
    const pdfFile = new File(['fake-pdf'], 'restaurant-menu.pdf', { type: 'application/pdf' });
    const results = await pdfToImages(pdfFile);

    expect(results[0].name).toBe('restaurant-menu_p1.jpg');
    expect(results[1].name).toBe('restaurant-menu_p2.jpg');
  });

  it('output files have image/jpeg MIME type', async () => {
    const pdfFile = new File(['fake-pdf'], 'menu.pdf', { type: 'application/pdf' });
    const results = await pdfToImages(pdfFile);
    results.forEach(f => expect(f.type).toBe('image/jpeg'));
  });

  it('respects maxPagesPerFile limit', async () => {
    // The mock returns numPages: 2, limit to 1
    const pdfFile = new File(['fake-pdf'], 'menu.pdf', { type: 'application/pdf' });
    const results = await pdfToImages(pdfFile, 1);
    expect(results).toHaveLength(1);
  });
});
