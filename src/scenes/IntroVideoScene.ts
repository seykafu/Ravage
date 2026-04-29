import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { getMusic } from "../audio/Music";
import { sfxClick } from "../audio/Sfx";

interface IntroArgs {
  // Scene to start when the video ends or is skipped.
  next: string;
}

// Absolute paths so they resolve from any host route (the game shell now
// lives at /play/, where a relative "video/..." would 404). Two sources are
// attached: WebM first because VP9-capable browsers prefer it (smaller),
// MP4 second as a universal fallback that Safari and older browsers use.
const VIDEO_SOURCES: ReadonlyArray<{ src: string; type: string }> = [
  { src: "/video/intro.webm", type: "video/webm" },
  { src: "/video/intro.mp4",  type: "video/mp4"  }
];

// Plays the intro cinematic between Title → Menu. Uses an HTML <video> element
// overlaid on the Phaser canvas so HD footage renders with the browser's smooth
// scaler (Phaser is in pixelArt mode and would chunk down a 1080p video).
export class IntroVideoScene extends Phaser.Scene {
  private nextScene = "AuthScene";
  private finished = false;
  private videoEl?: HTMLVideoElement;
  private skipWrap?: HTMLDivElement;
  private skipTimers: number[] = [];

  constructor() { super("IntroVideoScene"); }

  init(data: IntroArgs): void {
    if (data?.next) this.nextScene = data.next;
    this.finished = false;
  }

  create(): void {
    // Solid black under the video — also catches any letterbox bars.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    // Quick fade-out for any music that was still playing on title.
    getMusic(this).stop(350);

    // Build the HTML <video> overlay positioned over the Phaser canvas area.
    const app = document.getElementById("app");
    if (!app) {
      // Cannot mount video — just route forward.
      this.finish();
      return;
    }
    const vid = document.createElement("video");
    for (const s of VIDEO_SOURCES) {
      const el = document.createElement("source");
      el.src = s.src;
      el.type = s.type;
      vid.appendChild(el);
    }
    vid.preload = "auto";
    vid.playsInline = true;
    vid.autoplay = true;
    vid.controls = false;
    vid.style.position = "absolute";
    vid.style.inset = "0";
    vid.style.width = "100%";
    vid.style.height = "100%";
    vid.style.objectFit = "contain";
    vid.style.background = "#000";
    vid.style.zIndex = "5";
    vid.style.opacity = "0";
    vid.style.transition = "opacity 600ms ease";
    vid.style.pointerEvents = "none";
    app.appendChild(vid);
    this.videoEl = vid;

    // Fade the video element in once playback actually starts so the title's
    // fade-out has a chance to finish behind it.
    vid.addEventListener("playing", () => { vid.style.opacity = "1"; }, { once: true });
    vid.addEventListener("ended", () => this.finish());
    vid.addEventListener("error", () => this.finish());
    // Some browsers reject autoplay with sound — try explicitly.
    void vid.play().catch(() => {
      // Autoplay blocked. Try muted, or just fall through to skip.
      vid.muted = true;
      void vid.play().catch(() => this.finish());
    });

    // Cinematic fade-in for the Phaser layer (just the black backdrop).
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // "Skip Intro" button — built as an HTML overlay so it sits ABOVE the video
    // element. The Phaser canvas is at z-index 0 and the video at z-index 5, so a
    // Phaser GameObject would be hidden behind the video.
    this.mountSkipUI(app);

    this.input.keyboard?.on("keydown-ESC", () => this.finish());
    this.input.keyboard?.on("keydown-ENTER", () => this.finish());
    this.input.keyboard?.on("keydown-SPACE", () => this.finish());

    // Cleanup safety — if the scene is shut down for any reason, remove the video
    // and skip overlay.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.teardownVideo(); this.teardownSkipUI(); });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => { this.teardownVideo(); this.teardownSkipUI(); });
  }

  private mountSkipUI(host: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.style.position = "absolute";
    wrap.style.top = "32px";
    wrap.style.right = "32px";
    wrap.style.zIndex = "10"; // above the video (z-index 5)
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.gap = "10px";
    wrap.style.opacity = "0";
    wrap.style.transition = "opacity 300ms ease";
    wrap.style.pointerEvents = "none"; // re-enabled on the button itself

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Skip Intro \u23ED";
    btn.style.width = "168px";
    btn.style.height = "44px";
    btn.style.border = "1px solid rgba(212, 175, 55, 0.85)";
    btn.style.outline = "none";
    btn.style.background = "linear-gradient(180deg, #131724 0%, #0a0c14 100%)";
    btn.style.color = "#fff2c0";
    btn.style.fontFamily = "Cinzel, serif";
    btn.style.fontSize = "16px";
    btn.style.letterSpacing = "0.5px";
    btn.style.textShadow = "0 2px 4px #000";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "inset 0 0 0 1px rgba(255, 217, 122, 0.25), 0 4px 14px rgba(0,0,0,0.55)";
    btn.style.pointerEvents = "auto";
    btn.style.transition = "background 120ms ease, box-shadow 120ms ease";
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "linear-gradient(180deg, #1c2032 0%, #0a0c14 100%)";
      btn.style.boxShadow = "inset 0 0 0 1px rgba(255, 217, 122, 0.6), 0 4px 14px rgba(0,0,0,0.55)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "linear-gradient(180deg, #131724 0%, #0a0c14 100%)";
      btn.style.boxShadow = "inset 0 0 0 1px rgba(255, 217, 122, 0.25), 0 4px 14px rgba(0,0,0,0.55)";
    });
    btn.addEventListener("click", () => { sfxClick(); this.finish(); });

    const hint = document.createElement("span");
    hint.textContent = "or press space";
    hint.style.fontFamily = "Inter, system-ui, sans-serif";
    hint.style.fontSize = "11px";
    hint.style.fontStyle = "italic";
    hint.style.color = "#c9b07a";
    hint.style.letterSpacing = "1px";

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    host.appendChild(wrap);
    this.skipWrap = wrap;

    // Fade in after a tiny delay so it appears alongside the video, then hold
    // for ~3.4s, then fade out. Total visible window: ~4 seconds.
    this.skipTimers.push(window.setTimeout(() => { wrap.style.opacity = "1"; }, 200));
    this.skipTimers.push(window.setTimeout(() => { wrap.style.opacity = "0"; }, 3900));
    // After fade-out, drop pointer events so the (now-invisible) button can't
    // intercept clicks meant for stray UI behind it.
    this.skipTimers.push(window.setTimeout(() => {
      btn.style.pointerEvents = "none";
      btn.disabled = true;
    }, 4250));
  }

  private teardownSkipUI(): void {
    for (const id of this.skipTimers) clearTimeout(id);
    this.skipTimers = [];
    if (this.skipWrap) {
      this.skipWrap.remove();
      this.skipWrap = undefined;
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;

    // Hide the skip UI immediately so it doesn't linger over the fade.
    if (this.skipWrap) this.skipWrap.style.opacity = "0";

    // Fade the video out in parallel with the camera fade so the transition into
    // the next scene feels like one motion rather than two.
    if (this.videoEl) {
      this.videoEl.style.opacity = "0";
    }
    this.cameras.main.fadeOut(550, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.teardownVideo();
      this.teardownSkipUI();
      this.scene.start(this.nextScene);
    });
  }

  private teardownVideo(): void {
    const v = this.videoEl;
    if (!v) return;
    this.videoEl = undefined;
    try { v.pause(); } catch { /* ignore */ }
    v.removeAttribute("src");
    try { v.load(); } catch { /* ignore */ }
    v.remove();
  }
}
