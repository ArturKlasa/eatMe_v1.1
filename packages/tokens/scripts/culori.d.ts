declare module 'culori' {
  interface Color {
    mode: string;
    [key: string]: unknown;
  }

  interface OklchColor extends Color {
    mode: 'oklch';
    l: number;
    c: number;
    h: number | undefined;
    alpha?: number;
  }

  function parse(color: string): Color | undefined;
  function oklch(color: Color | string): OklchColor | undefined;
  function formatCss(color: Color): string;
}
