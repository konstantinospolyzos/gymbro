// Sounds and the screen during a workout: the countdown beeps at the end of a rest, keeping the screen
// on, and a small tap you can feel on iPhones that support it.
//
// The beeps mix with your music (they never stop Spotify), so they also follow the silent switch: with
// the iPhone on silent you see the countdown instead of hearing it.

let ctx = null;
let scheduled = [];
let unlocked = false;

/** Must run from a tap once (Start workout, Set done): iPhones only play sounds a tap has allowed. */
export function unlock() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== "ambient") navigator.audioSession.type = "ambient";
  } catch { /* older iOS */ }
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "running" && unlocked) return;
    if (ctx.state !== "running") ctx.resume();
    unlocked = true;
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
  } catch { ctx = null; }
}

function blip(at, freq, len, vol = 0.32) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.03);
  return o;
}

/** Beeps in the last `count` seconds before `endsAt` (a Date.now() moment), and a double high one at the end */
export function scheduleCountdown(endsAt, count) {
  cancelCountdown();
  if (!ctx || !count) return;
  if (ctx.state !== "running") { try { ctx.resume(); } catch { return; } }
  const now = Date.now(), base = ctx.currentTime;
  for (let k = count; k >= 1; k--) {
    const t = endsAt - k * 1000;
    if (t < now - 60) continue;
    scheduled.push(blip(base + Math.max(0, t - now) / 1000, 880, 0.13));
  }
  if (endsAt >= now - 60) {
    const t0 = base + Math.max(0, endsAt - now) / 1000;
    scheduled.push(blip(t0, 1318.5, 0.18, 0.42), blip(t0 + 0.22, 1318.5, 0.34, 0.42));
  }
}

export function cancelCountdown() {
  for (const o of scheduled) { try { o.stop(); } catch { /* already done */ } }
  scheduled = [];
}

/** Three notes up: the workout is done */
export function playFinish() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99].forEach((f, i) => blip(t + i * 0.12, f, 0.32, 0.3));
}

/** Settings › Test the sound */
export function testSound() {
  unlock();
  if (!ctx) return false;
  scheduleCountdown(Date.now() + 2050, 2);
  return true;
}

export const soundWorks = () => Boolean(window.AudioContext || window.webkitAudioContext);

// ---------------------------------------------------------------------------
// The screen stays on during a workout (iOS 18.4 and later in Home Screen apps)
// ---------------------------------------------------------------------------
let lock = null, wantLock = false;
export async function keepAwake(on) {
  wantLock = on;
  if (!on) {
    try { await lock?.release(); } catch { /* gone */ }
    lock = null;
    return;
  }
  if (!("wakeLock" in navigator) || lock) return;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => { lock = null; });
  } catch { lock = null; }
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (!document.hidden && wantLock) keepAwake(true); });
}

// ---------------------------------------------------------------------------
// A tap you can feel: vibration where there is one; on iPhones (iOS 18+) the switch trick
// ---------------------------------------------------------------------------
let hapticLabel = null;
export function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(15); return; }
    // the switch trick can take the focus, which would close the keyboard while you type a weight or a note
    const typing = document.activeElement;
    if (typing && (typing.tagName === "TEXTAREA" || (typing.tagName === "INPUT" && typing.type !== "checkbox"))) return;
    if (!hapticLabel) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "haptic-switch";
      input.setAttribute("switch", "");
      input.setAttribute("aria-hidden", "true");
      input.tabIndex = -1;
      hapticLabel = document.createElement("label");
      hapticLabel.htmlFor = "haptic-switch";
      hapticLabel.setAttribute("aria-hidden", "true");
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px";
      box.append(input, hapticLabel);
      document.body.appendChild(box);
    }
    hapticLabel.click();
  } catch { /* no feel */ }
}
