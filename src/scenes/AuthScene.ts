import Phaser from "phaser";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import { drawPanel } from "../ui/Panel";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { isAuthEnabled, signIn, signUp, currentUser, resendConfirmation, resetPassword } from "../auth/session";
import { sfxClick, sfxConfirm, sfxCancel } from "../audio/Sfx";

type Mode = "signin" | "signup";

export class AuthScene extends Phaser.Scene {
  private mode: Mode = "signin";
  private emailInput!: TextInput;
  private passwordInput!: TextInput;
  private statusText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private submitBtn!: Button;
  private toggleBtn!: Button;
  private guestBtn!: Button;
  private busy = false;

  constructor() { super("AuthScene"); }

  async create(): Promise<void> {
    if (!isAuthEnabled()) {
      // No Supabase keys configured — skip straight to slot picker (offline mode).
      this.scene.start("SaveSlotScene");
      return;
    }

    // If a session is already cached (refresh after login), bounce to slot pick.
    const u = await currentUser();
    if (u) {
      this.scene.start("SaveSlotScene");
      return;
    }

    const bgKey = ensureBackdropTexture(this, "bg_auth", BACKDROPS.thuling);
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.55);

    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0.92, 0.92);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel — height bumped 380 → 460 to fit the Resend confirmation
    // and Forgot password links added in the email-confirmation fix.
    const panelW = 480;
    const panelH = 460;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 130;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    this.titleText = this.add.text(GAME_WIDTH / 2, panelY + 36, "Welcome", {
      fontFamily: FAMILY_HEADING,
      fontSize: "32px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(GAME_WIDTH / 2, panelY + 78, "Sign in to sync your saves", {
      fontFamily: FAMILY_BODY,
      fontSize: "15px",
      color: "#c9b07a"
    }).setOrigin(0.5);

    // Email label + input
    this.add.text(panelX + 36, panelY + 116, "Email", {
      fontFamily: FAMILY_BODY, fontSize: "13px", color: "#c9b07a"
    });
    this.emailInput = new TextInput(this, {
      x: panelX + 36,
      y: panelY + 138,
      w: panelW - 72,
      h: 38,
      type: "email",
      placeholder: "you@example.com"
    });

    // Password label + input
    this.add.text(panelX + 36, panelY + 188, "Password", {
      fontFamily: FAMILY_BODY, fontSize: "13px", color: "#c9b07a"
    });
    this.passwordInput = new TextInput(this, {
      x: panelX + 36,
      y: panelY + 210,
      w: panelW - 72,
      h: 38,
      type: "password",
      placeholder: "••••••••",
      onSubmit: () => this.submit()
    });

    // Status (errors / info). Larger word-wrap room and a max of
    // ~5 lines so the friendly error messages from session.ts can
    // breathe ("Your email isn't confirmed yet. Check your inbox..."
    // wraps to 3-4 lines at this font size).
    this.statusText = this.add.text(GAME_WIDTH / 2, panelY + 260, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#d05a4a",
      align: "center",
      wordWrap: { width: panelW - 72 },
      lineSpacing: 4
    }).setOrigin(0.5, 0);

    // Submit + toggle buttons
    const btnRowY = panelY + 348;
    this.submitBtn = new Button(this, {
      x: panelX + 36,
      y: btnRowY,
      w: 200,
      h: 44,
      label: "Sign In",
      primary: true,
      fontSize: 16,
      onClick: () => this.submit()
    });

    this.toggleBtn = new Button(this, {
      x: panelX + panelW - 36 - 200,
      y: btnRowY,
      w: 200,
      h: 44,
      label: "Need an account?",
      primary: false,
      fontSize: 14,
      onClick: () => this.toggleMode()
    });

    // Recovery links — text-only "buttons" below the action row.
    // Forgot password works in any mode; Resend confirmation only
    // makes sense in signin mode (when the user has an unconfirmed
    // account they can't log into). Both read the email field, so
    // the user fills in their email first and then clicks the link.
    this.renderTextLink(
      panelX + 36,
      panelY + panelH - 36,
      "Resend confirmation email",
      () => this.handleResendConfirmation()
    );
    this.renderTextLink(
      panelX + panelW - 36,
      panelY + panelH - 36,
      "Forgot password?",
      () => this.handleForgotPassword(),
      /* alignRight */ true
    );

    // Skip-to-offline button below the panel
    this.guestBtn = new Button(this, {
      x: GAME_WIDTH / 2 - 120,
      y: panelY + panelH + 24,
      w: 240,
      h: 36,
      label: "Continue offline (local only)",
      primary: false,
      fontSize: 13,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("SaveSlotScene"));
      }
    });

    // Back-to-title
    new Button(this, {
      x: 24,
      y: GAME_HEIGHT - 56,
      w: 100,
      h: 36,
      label: "‹ Title",
      primary: false,
      fontSize: 13,
      onClick: () => {
        sfxCancel();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    this.applyMode();
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private toggleMode(): void {
    sfxClick();
    this.mode = this.mode === "signin" ? "signup" : "signin";
    this.applyMode();
  }

  private applyMode(): void {
    if (this.mode === "signin") {
      this.titleText.setText("Welcome back");
      this.subtitleText.setText("Sign in to sync your saves");
      this.submitBtn.setLabel("Sign In");
      this.toggleBtn.setLabel("Need an account?");
    } else {
      this.titleText.setText("Create an account");
      this.subtitleText.setText("Three save slots, anywhere you play");
      this.submitBtn.setLabel("Create Account");
      this.toggleBtn.setLabel("Have an account?");
    }
    this.statusText.setText("");
    this.statusText.setColor("#d05a4a");
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const email = this.emailInput.value().trim();
    const password = this.passwordInput.value();

    if (!email || !email.includes("@")) {
      this.fail("Please enter a valid email.");
      return;
    }
    if (!password || password.length < 6) {
      this.fail("Password must be at least 6 characters.");
      return;
    }

    this.busy = true;
    this.submitBtn.setEnabled(false);
    this.toggleBtn.setEnabled(false);
    this.statusText.setColor("#c9b07a");
    this.statusText.setText(this.mode === "signin" ? "Signing in…" : "Creating account…");

    const result = this.mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password);

    this.busy = false;
    this.submitBtn.setEnabled(true);
    this.toggleBtn.setEnabled(true);

    if (!result.ok) {
      this.fail(result.error ?? "Something went wrong.");
      return;
    }

    sfxConfirm();

    // Email-confirmation gate. Earlier code checked `!result.user`
    // here, but Supabase returns a user object even for unconfirmed
    // accounts — only the SESSION is missing. session.ts now sets
    // `needsEmailConfirmation` based on the actual session check, so
    // we never let an unconfirmed user think they're signed in.
    // Without this fix, the user would proceed past AuthScene with
    // a "user" but no session, then be unable to sign back in next
    // visit because the account exists but is unconfirmed.
    if (this.mode === "signup" && result.needsEmailConfirmation) {
      this.statusText.setColor("#c9b07a");
      this.statusText.setText(
        "Account created! Check your inbox for the confirmation link from Supabase, then come back here and sign in. (Check spam if you don't see it within a minute.)"
      );
      this.mode = "signin";
      this.applyMode();
      return;
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("SaveSlotScene"));
  }

  // Re-send the confirmation email for an account that was created
  // but never confirmed. Reads the email field; surfaces clear
  // success / failure messaging in the status line.
  private async handleResendConfirmation(): Promise<void> {
    if (this.busy) return;
    const email = this.emailInput.value().trim();
    if (!email || !email.includes("@")) {
      this.fail("Type your email above first, then click Resend.");
      return;
    }
    this.busy = true;
    this.statusText.setColor("#c9b07a");
    this.statusText.setText("Sending confirmation email…");
    const result = await resendConfirmation(email);
    this.busy = false;
    if (!result.ok) {
      this.fail(result.error ?? "Couldn't resend the confirmation email.");
      return;
    }
    sfxConfirm();
    this.statusText.setColor("#c9b07a");
    this.statusText.setText(`Confirmation email sent to ${email}. Check your inbox (and spam folder).`);
  }

  // Send a password reset email. Supabase hosts the actual reset
  // flow; the user clicks the link in their inbox and changes their
  // password on Supabase's hosted page, then comes back here to
  // sign in with the new password.
  private async handleForgotPassword(): Promise<void> {
    if (this.busy) return;
    const email = this.emailInput.value().trim();
    if (!email || !email.includes("@")) {
      this.fail("Type your email above first, then click Forgot password.");
      return;
    }
    this.busy = true;
    this.statusText.setColor("#c9b07a");
    this.statusText.setText("Sending password reset link…");
    const result = await resetPassword(email);
    this.busy = false;
    if (!result.ok) {
      this.fail(result.error ?? "Couldn't send the reset link.");
      return;
    }
    sfxConfirm();
    this.statusText.setColor("#c9b07a");
    this.statusText.setText(`Reset link sent to ${email}. Click it, set a new password, then come back to sign in.`);
  }

  // Render a text-only "link" — small underlined text with a click
  // handler. Used for the recovery affordances (Resend confirmation,
  // Forgot password) below the main action row. Cheaper visual
  // weight than a Button so the user knows these are secondary.
  private renderTextLink(x: number, y: number, label: string, onClick: () => void, alignRight = false): void {
    const t = this.add.text(x, y, label, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(alignRight ? 1 : 0, 0).setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setColor("#f4d999"));
    t.on("pointerout", () => t.setColor("#c9b07a"));
    t.on("pointerdown", () => {
      sfxClick();
      onClick();
    });
  }

  private fail(msg: string): void {
    this.statusText.setColor("#d05a4a");
    this.statusText.setText(msg);
    this.emailInput.setError(true);
    this.passwordInput.setError(true);
    setTimeout(() => {
      this.emailInput.setError(false);
      this.passwordInput.setError(false);
    }, 1500);
  }
}
