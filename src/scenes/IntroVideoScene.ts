import Phaser from "phaser";
import { FAMILY_BODY, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { getMusic } from "../audio/Music";
import { sfxClick } from "../audio/Sfx";

interface IntroArgs {
  // Scene to start when the video ends or is skipped.
  next: string;
}

const VIDEO_URL = encodeURI("video/Ravage - Intro Video.mov");

// Plays the intro cinematic between Title → Menu. Uses an HTML <video> element
// overlaid on the Phaser canvas so HD footage renders with the browser's smooth
// scaler (Phaser is in pixelArt mode and would chunk down a 1080p video).
export class IntroVideoScene extends Phaser.Scene {
  private nextScene = "AuthScene";
  private finished = false;
  private videoEl?: HTMLVideoElement;
  private hintText?: Phaser.GameObjects.Text;

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
    vid.src = VIDEO_URL;
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

    // Cinematic fade-in for the Phaser layer (just the black backdrop + skip UI).
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // "Skip Intro" button — Netflix-style: top-right, visible for ~4s then fades.
    // Wrapped in a Phaser container so the button + its hint can fade together.
    const skipW = 168;
    const skipH = 44;
    const skipX = GAME_WIDTH - skipW - 32;
    const skipY = 32;
    const skipBtn = new Button(this, {
      x: skipX,
      y: skipY,
      w: skipW, h: skipH,
      label: "Skip Intro \u23ED",
      primary: true,
      fontSize: 16,
      onClick: () => { sfxClick(); this.finish(); }
    });
    skipBtn.setAlpha(0);
    skipBtn.setScrollFactor(0);
    skipBtn.setDepth(100);

    // Subtle keyboard hint sits just under the button.
    this.hintText = this.add.text(skipX + skipW / 2, skipY + skipH + 10, "or press space", {
      fontFamily: FAMILY_BODY,
      fontSize: "11px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5, 0).setLetterSpacing(1).setAlpha(0).setDepth(100);

    // Visible for 4 seconds total: 300ms fade-in, 3.4s hold, 300ms fade-out.
    this.tweens.add({ targets: [skipBtn, this.hintText], alpha: 1, duration: 300, delay: 200 });
    this.tweens.add({ targets: [skipBtn, this.hintText], alpha: 0, duration: 300, delay: 3900 });

    // After fading out, disable the button so it doesn't intercept stray clicks
    // on whatever's playing on screen.
    this.time.delayedCall(4250, () => {
      skipBtn.setEnabled(false);
      skipBtn.disableInteractive();
    });

    this.input.keyboard?.on("keydown-ESC", () => this.finish());
    this.input.keyboard?.on("keydown-ENTER", () => this.finish());
    this.input.keyboard?.on("keydown-SPACE", () => this.finish());

    // Cleanup safety — if the scene is shut down for any reason, remove the video.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownVideo());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownVideo());
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;

    // Fade the video out in parallel with the camera fade so the transition into
    // the next scene feels like one motion rather than two.
    if (this.videoEl) {
      this.videoEl.style.opacity = "0";
    }
    this.cameras.main.fadeOut(550, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.teardownVideo();
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
