// Mid-battle dialogue trigger evaluation + firing.
//
// Extracted from BattleScene as part of the file split — behaviour is
// identical to the pre-split checkDialogueTriggers / matchesTrigger /
// findBeforeVictoryDialogue / fireDialogue / checkKillDialogue /
// checkAttackDialogue methods.
//
// Owns the per-battle dialogue bookkeeping: `firedDialogues` (so a
// dialogue never re-fires) and `lastSeenDialogueRound` (so round_start
// triggers fire once per round crossing, not every check tick). A fresh
// DialogueDirector is constructed per battle in BattleScene.create(), so
// that state starts clean on every entry / retry without an explicit
// reset.
//
// Firing a dialogue pauses BattleScene and runs BattleDialogueScene as
// an overlay; the overlay resumes BattleScene when the player closes it.

import Phaser from "phaser";
import type { BattleState } from "../../combat/Actions";
import type { Initiative } from "../../combat/Initiative";
import { isAlive } from "../../combat/Unit";
import type { Unit } from "../../combat/types";
import type { BattleDialogue, BattleDialogueTrigger } from "../../data/battles";
import type { DialogBeat } from "../../story/beats";
import type { MusicKey } from "../../audio/Music";
import type { DialogueSnapshot } from "../../combat/Suspend";

export class DialogueDirector {
  // Dialogues that have already fired this battle — guards re-firing.
  private fired = new Set<string>();
  // Last round number a check ran for, so round_start fires exactly
  // once per round crossing instead of on every check tick.
  private lastSeenRound = 0;

  // ---- Suspend support ----
  // The fired set + round bookkeeping as plain data, so a resumed battle
  // doesn't replay story beats the player already saw.
  serialize(): DialogueSnapshot {
    return { fired: [...this.fired], lastSeenRound: this.lastSeenRound };
  }

  restore(snap: DialogueSnapshot): void {
    this.fired = new Set(snap.fired);
    this.lastSeenRound = snap.lastSeenRound;
  }

  constructor(
    private scene: Phaser.Scene,
    private dialogues: BattleDialogue[],
    // The battle's main music key — forwarded to BattleDialogueScene as
    // the restore target when a dialogue takes the music over.
    private battleMusic: MusicKey,
    private initiative: Initiative,
    private state: BattleState
  ) {}

  // Called from startTurn (every turn transition) for round_start +
  // adjacent_eot triggers. ally_killed_target / ally_attacks are checked
  // inline via checkKill / checkAttack since they need the attack pair.
  // Only fires the FIRST matching un-fired dialogue per check tick — if
  // two triggers match in the same instant, the second waits for its
  // next check.
  checkTurnTriggers(): void {
    const round = this.initiative.round;
    const roundChanged = round !== this.lastSeenRound;
    this.lastSeenRound = round;
    for (const dlg of this.dialogues) {
      if (this.fired.has(dlg.id)) continue;
      if (this.matchesTrigger(dlg.trigger, round, roundChanged)) {
        this.fire(dlg);
        return;
      }
    }
  }

  private matchesTrigger(t: BattleDialogueTrigger, round: number, roundChanged: boolean): boolean {
    switch (t.kind) {
      case "round_start":
        // Fires the first time the round counter reaches t.round (or any
        // higher round if the trigger was added late). roundChanged
        // ensures we don't re-fire on subsequent same-round checks.
        return roundChanged && round >= t.round;
      case "adjacent_eot": {
        const a = this.state.units.find((u) => u.id === t.unitA);
        const b = this.state.units.find((u) => u.id === t.unitB);
        if (!a || !b || !isAlive(a) || !isAlive(b)) return false;
        return this.state.grid.isMeleeAdjacent(a.state.position, b.state.position);
      }
      case "ally_attacks":
      case "ally_killed_target":
      case "second_wind":
        // All three fire inline (checkAttack / checkKill /
        // checkSecondWind), never off the per-turn scan.
        return false;
      case "before_victory":
        // Fired explicitly via findBeforeVictory() in checkEnd.
        return false;
    }
  }

  // Look for an unfired before_victory dialogue. Called by checkEnd when
  // the victory condition flips to "player" — if a match is found, the
  // EndScene transition is deferred until the dialogue closes.
  findBeforeVictory(): BattleDialogue | null {
    for (const dlg of this.dialogues) {
      if (this.fired.has(dlg.id)) continue;
      if (dlg.trigger.kind === "before_victory") return dlg;
    }
    return null;
  }

  // Mark a dialogue fired and launch BattleDialogueScene as an overlay.
  // BattleScene pauses; the dialogue scene resumes it when its Continue
  // button (or ENTER/SPACE) closes the panel.
  //
  // Music takeover: when the dialogue authored a `music` override,
  // forward it along with the battle's main music as the restore
  // target — UNLESS the trigger is `before_victory`, in which case
  // EndScene is about to take the music over with its own sting and
  // restoring the battle theme would just step on it.
  fire(dlg: BattleDialogue): void {
    this.fired.add(dlg.id);
    this.scene.scene.pause();
    const isBeforeVictory = dlg.trigger.kind === "before_victory";
    this.scene.scene.run("BattleDialogueScene", {
      beats: dlg.beats,
      resumeKey: this.scene.scene.key,
      music: dlg.music,
      restoreMusic: dlg.music && !isBeforeVictory ? this.battleMusic : undefined
    });
  }

  // Fire an ad-hoc one-off dialogue that is NOT from the battle's
  // authored dialogue list — same pause/overlay mechanism as fire(),
  // but with no dedup, no trigger, and no music handling. Used for
  // the player-defeat retreat beat (see src/data/retreatLines.ts):
  // the beats are generated at the moment a unit falls, not authored
  // per battle.
  fireAdHoc(beats: DialogBeat[]): void {
    this.scene.scene.pause();
    this.scene.scene.run("BattleDialogueScene", {
      beats,
      resumeKey: this.scene.scene.key
    });
  }

  // Called from applyAttackEffects right after a kill resolves. Scans
  // for an ally_killed_target dialogue matching the (attacker, defender)
  // pair and fires the first match.
  checkKill(attacker: Unit, defender: Unit): void {
    for (const dlg of this.dialogues) {
      if (this.fired.has(dlg.id)) continue;
      const t = dlg.trigger;
      if (t.kind === "ally_killed_target" && t.allyId === attacker.id && t.targetId === defender.id) {
        this.fire(dlg);
        return;
      }
    }
  }

  // Called the instant a boss spends its second wind. Returns true if a
  // beat fired, so BattleScene knows whether the scene is now paused
  // behind a dialogue overlay and can order the reserve wave after it.
  checkSecondWind(unitId: string): boolean {
    for (const dlg of this.dialogues) {
      if (this.fired.has(dlg.id)) continue;
      const t = dlg.trigger;
      if (t.kind === "second_wind" && t.unitId === unitId) {
        this.fire(dlg);
        return true;
      }
    }
    return false;
  }

  // Called from applyAttackEffects after every resolved attack
  // (regardless of hit/miss/kill). Scans for an ally_attacks dialogue
  // matching the attacker and fires the first match.
  checkAttack(attacker: Unit): void {
    for (const dlg of this.dialogues) {
      if (this.fired.has(dlg.id)) continue;
      const t = dlg.trigger;
      if (t.kind === "ally_attacks" && t.allyId === attacker.id) {
        this.fire(dlg);
        return;
      }
    }
  }
}
