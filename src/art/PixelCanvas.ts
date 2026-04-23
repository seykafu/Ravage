// Tiny abstraction over an offscreen 2D canvas for drawing pixel art procedurally,
// then handing the resulting bitmap to Phaser as a texture.

export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D context unavailable");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  fillRect(x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
    this.ctx.fillStyle = colorToCss(color, alpha);
    this.ctx.fillRect(x, y, w, h);
  }

  pixel(x: number, y: number, color: number, alpha = 1): void {
    this.ctx.fillStyle = colorToCss(color, alpha);
    this.ctx.fillRect(x, y, 1, 1);
  }

  // Symmetric brush: mirrors the pixel about the vertical centerline. Useful for character art.
  pixelMirror(x: number, y: number, color: number, alpha = 1): void {
    const cx = (this.width - 1) - x;
    this.pixel(x, y, color, alpha);
    if (cx !== x) this.pixel(cx, y, color, alpha);
  }

  outlineRect(x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
    this.ctx.strokeStyle = colorToCss(color, alpha);
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // Lighten or darken a pixel: simple multiplicative shading useful for "3D" volume.
  shadePixel(x: number, y: number, factor: number): void {
    const data = this.ctx.getImageData(x, y, 1, 1).data;
    const r = clamp255(data[0]! * factor);
    const g = clamp255(data[1]! * factor);
    const b = clamp255(data[2]! * factor);
    this.ctx.fillStyle = `rgba(${r},${g},${b},${(data[3]! / 255).toFixed(3)})`;
    this.ctx.fillRect(x, y, 1, 1);
  }
}

const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

export const colorToCss = (color: number, alpha = 1): string => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
};

export const mixColor = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bx = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bx;
};

export const lightenColor = (c: number, amount: number): number => mixColor(c, 0xffffff, amount);
export const darkenColor = (c: number, amount: number): number => mixColor(c, 0x000000, amount);
