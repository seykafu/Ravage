import Phaser from "phaser";

interface TextInputOpts {
  x: number;          // top-left in Phaser game coords
  y: number;
  w: number;
  h: number;
  type?: "text" | "email" | "password";
  placeholder?: string;
  initialValue?: string;
  fontFamily?: string;
  fontSizePx?: number;
  onSubmit?: (value: string) => void;
}

// Lightweight DOM <input> overlay positioned over the Phaser canvas.
// Phaser does not have a native text-input control; an HTML overlay is the
// least painful path and gives us free IME, paste, autofill.
//
// Usage: const input = new TextInput(scene, opts); ... input.value(); input.destroy();
export class TextInput {
  private el: HTMLInputElement;
  private scene: Phaser.Scene;
  private opts: TextInputOpts;
  private resizeListener: () => void;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: TextInputOpts) {
    this.scene = scene;
    this.opts = opts;
    const el = document.createElement("input");
    el.type = opts.type ?? "text";
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.initialValue) el.value = opts.initialValue;
    el.style.position = "absolute";
    el.style.boxSizing = "border-box";
    el.style.border = "1px solid #2a2a3a";
    el.style.background = "rgba(13, 17, 28, 0.92)";
    el.style.color = "#e6e0d0";
    el.style.padding = "0 12px";
    el.style.outline = "none";
    el.style.fontFamily = opts.fontFamily ?? '"EB Garamond", "Georgia", serif';
    el.style.borderRadius = "4px";
    el.style.zIndex = "50";
    el.addEventListener("focus", () => {
      el.style.border = "1px solid #c9b07a";
    });
    el.addEventListener("blur", () => {
      el.style.border = "1px solid #2a2a3a";
    });
    if (opts.onSubmit) {
      const onSubmit = opts.onSubmit;
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSubmit(el.value);
      });
    }

    document.body.appendChild(el);
    this.el = el;

    this.resizeListener = () => this.layout();
    window.addEventListener("resize", this.resizeListener);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.resizeListener);

    this.layout();
    // Auto-focus the first input on the page when it mounts.
    setTimeout(() => el.focus(), 0);

    // Auto-cleanup if the scene shuts down.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  // Map Phaser game-space coords to DOM page coords using the canvas rect.
  private layout(): void {
    if (this.destroyed) return;
    const canvas = this.scene.game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / this.scene.scale.gameSize.width;
    const sy = rect.height / this.scene.scale.gameSize.height;
    const left = rect.left + window.scrollX + this.opts.x * sx;
    const top = rect.top + window.scrollY + this.opts.y * sy;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.width = `${this.opts.w * sx}px`;
    this.el.style.height = `${this.opts.h * sy}px`;
    const fontPx = (this.opts.fontSizePx ?? 16) * sy;
    this.el.style.fontSize = `${fontPx}px`;
  }

  value(): string {
    return this.el.value;
  }

  setValue(v: string): void {
    this.el.value = v;
  }

  focus(): void {
    this.el.focus();
  }

  setError(isError: boolean): void {
    this.el.style.border = isError ? "1px solid #d05a4a" : "1px solid #2a2a3a";
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.resizeListener);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.resizeListener);
    this.el.remove();
  }
}
