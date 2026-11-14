// Settings: where your workouts are saved (OneDrive, Google Drive or the phone), the rest timer and its
// beeps, the screen, your weekly goal, the look, the exercise list and backups.

import { h, sheet, group, caption, footer, icon, alertBox, actionSheet, toast, saveFile, pickFile, actionRow, infoRow, switchRow, segmented, stepper, copyText, selectOnFocus } from "../ui.js";
import { store, describeData, readBackupFile } from "../store.js";
import { APP_NAME, ALL_PLATES } from "../data.js";
import { APP_VERSION, fmtRest, fmtKg, plannedDays, plural } from "../core.js";
import { setsCsv, bodyCsv } from "../csv.js";
import { checkForUpdate } from "../update.js";
import { current as currentProfile, profiles } from "../profiles.js";
import { avatar, openProfiles } from "./profiles.js";
import { redirectUri } from "../cloud/onedrive.js";
import { testSound, soundWorks } from "../sound.js";
import { NO, chooseRest } from "./common.js";
import { openLibrary } from "./editors.js";
import { apiKey, setApiKey, editApiKey } from "./coach.js";

const dayText = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short" });
const stamp = () => new Date().toISOString().slice(0, 10);

export function applyTheme() {
  const t = store.pref("theme", "auto");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/** OneDrive needs an app registration at Microsoft once: this is where its ID goes */
export function openOneDriveSetup({ thenConnect = false } = {}) {
  const od = store.clouds.onedrive;
  const uri = redirectUri();
  const idIn = selectOnFocus(h("input", { class: "form-input left", type: "text", value: od.clientId || "", placeholder: "for example 1a2b3c4d-…-1234567890ab",
    autocapitalize: "off", autocomplete: "off", spellcheck: "false", "aria-label": "Application (client) ID", disabled: store.oneDriveInConfig || null }));
  const valid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
  const body = h("div", { class: "form" },
    h("div", { class: "info-text", style: { padding: "8px 4px 0" } },
      h("p", null, "OneDrive needs a free “app registration” at Microsoft, once. It takes about ten minutes; the steps are in SETUP.md (part 2)."),
      h("p", null, "Microsoft then gives you an Application (client) ID: paste it below.")),
    caption("1. The sign-in address to register"),
    h("div", { class: "group" }, h("div", { class: "code-box" }, h("span", { class: "code-text" }, uri),
      h("button", { type: "button", class: "btn tinted small", style: { minHeight: "34px", padding: "4px 12px", fontSize: "14px" },
        onclick: async () => toast((await copyText(uri)) ? "Copied" : "Couldn't copy: select it and copy") }, icon("copy", 16), "Copy"))),
    footer("Under Authentication › Add a platform › Single-page application. Supported accounts: Personal Microsoft accounts only."),
    caption("2. Your Application (client) ID"),
    group(h("label", { class: "form-row" }, idIn)),
    footer(store.oneDriveInConfig ? "It's set in js/config.js, for every device." : "Kept on this phone. To set it for every device at once, put it in js/config.js instead (SETUP.md)."));
  const api = sheet({
    title: "Set up OneDrive", left: { text: "Cancel" },
    right: { text: thenConnect ? "Next" : "Save", bold: true, onClick: (a) => {
      const v = idIn.value.trim();
      if (!store.oneDriveInConfig) {
        if (v && !valid(v)) { toast("That doesn't look like an Application ID"); return; }
        store.setOneDriveId(v);
      }
      a.close();
      if (thenConnect && store.clouds.onedrive.configured) toast("Saved. Now tap Continue with Microsoft");
      store.emit();
    } },
    body,
  });
  return api;
}

function connect(kind) {
  store.connect(kind).then(() => toast(store.status.text)).catch((err) => alertBox({ title: `Couldn't connect to ${store.clouds[kind].label}`, message: err.message }));
}

export function openSettings() {
  const body = h("div", { class: "form" });

  function build() {
    const m = store.meta, data = store.data, s = data.settings;
    const me = currentProfile(), count = profiles().length;
    const parts = [caption("Profile"),
      group(h("button", { type: "button", class: "profile-row", onclick: () => openProfiles() }, avatar(me, 38),
        h("span", { class: "profile-text" }, h("span", { class: "profile-name" }, me.name || "Me"),
          h("span", { class: "profile-sub" }, count > 1 ? `${count} profiles on this phone · switch, add or rename` : "Add a profile for someone else who trains")),
        icon("chevron", 15, "chev"))),
      caption("Where your workouts are saved")];
    const cloud = store.cloud;
    if (cloud) {
      parts.push(group(
        infoRow(cloud.label, m.email || m.name || "signed in"),
        infoRow("File", cloud.where),
        infoRow("Status", store.status.text || "—"),
        m.problem && ["error", "retry"].includes(store.status.state)
          ? infoRow("What went wrong", `${new Date(m.problem.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${m.problem.step}: ${m.problem.text}`) : null,
        actionRow("sync", "Sync now", () => store.syncFromTap().then(() => toast(store.status.text))),
        m.link ? actionRow("link", `Open the file in ${cloud.label}`, () => window.open(m.link, "_blank", "noopener")) : null));
      parts.push(footer(`Your workouts and plan are one file in your own ${cloud.label}, the same on every phone or computer signed in with your account. The app can only see its own files.`));
      parts.push(group(actionRow("cloudOff", `Stop using ${cloud.label}`, async () => {
        const ok = await alertBox({ title: `Stop using ${cloud.label}?`, message: `Your workouts stay on this phone, and the file in ${cloud.label} isn't deleted. You can connect again later.`,
          buttons: [NO, { text: "Stop", value: true, style: "destructive" }] });
        if (ok) { store.disconnect(); toast("Now saving on this phone only"); }
      }, { tone: "danger" })));
    } else {
      const od = store.clouds.onedrive, gd = store.clouds.gdrive;
      parts.push(group(infoRow("This phone only", describeData(data)),
        od.configured ? actionRow("cloud", "Save to OneDrive", () => connect("onedrive"), { detail: "The same workouts on your phone and computer" })
          : actionRow("cloud", "Set up OneDrive", () => openOneDriveSetup(), { detail: "A Microsoft app registration, once" }),
        gd.configured ? actionRow("cloud", "Save to Google Drive", () => connect("gdrive"), { detail: "The Savings Tracker's Google sign-in" }) : null));
    }
    if (!store.oneDriveInConfig && (store.clouds.onedrive.configured || store.mode === "onedrive")) {
      parts.push(caption("OneDrive"), group(actionRow("gear", "Application (client) ID", () => openOneDriveSetup(), { value: `${store.clouds.onedrive.clientId.slice(0, 8)}…` })));
    }

    parts.push(caption("Rest timer"));
    parts.push(group(
      actionRow("timer", "Rest for new workouts", async () => { const v = await chooseRest(s.rest); if (v !== null) store.setSetting("rest", v); }, { value: fmtRest(s.rest) }),
      h("div", { class: "form-row switch-row" }, h("span", { class: "form-label" }, "Countdown"),
        segmented(["Off", "3 s", "5 s", "10 s"], [0, 3, 5, 10].indexOf(s.countdown) >= 0 ? [0, 3, 5, 10].indexOf(s.countdown) : 2, (i) => store.setSetting("countdown", [0, 3, 5, 10][i]), "small")),
      switchRow("Beeps", s.sound, (on) => { store.setSetting("sound", on); if (on) testSound(); }, "speaker"),
      s.sound && soundWorks() ? actionRow(null, "Test the beeps", () => { if (!testSound()) toast("This browser can't play sounds"); }) : null));
    parts.push(footer(`Each workout has its own rest (Plan › a workout). In the last ${s.countdown || 5} seconds of a rest the screen counts down${s.sound ? " and beeps" : ""}, so you're ready for the next set. The beeps play over your music and follow the silent switch: on silent you only see the countdown.`));

    parts.push(caption("During a workout"));
    parts.push(group(switchRow("Keep the screen on", s.awake, (on) => store.setSetting("awake", on), "bolt"),
      switchRow("Warm-up sets", s.warmup !== false, (on) => store.setSetting("warmup", on), "flame")));
    parts.push(footer("Keep the screen on: the timer stays in sight between sets (the workout keeps counting anyway). Warm-up sets: the first heavy lift of a workout starts with lighter sets, worked out from your weight; they aren't saved with the workout."));

    parts.push(caption("Plates at your gym"));
    const plates = new Set(s.plates || []);
    parts.push(h("div", { class: "group plate-picker" }, ALL_PLATES.map((v) => h("button", { type: "button", class: `plate-chip ${plates.has(v) ? "on" : ""}`,
      "aria-pressed": String(plates.has(v)), "aria-label": `${fmtKg(v)} kg plates`,
      onclick: () => { if (plates.has(v)) plates.delete(v); else plates.add(v); store.setSetting("plates", ALL_PLATES.filter((x) => plates.has(x))); } }, fmtKg(v)))));
    parts.push(footer("For barbell lifts the workout shows what to put on each side of the bar. Tap the plates your gym has (kg)."));

    parts.push(caption("Weekly goal"));
    const planned = plannedDays(data);
    parts.push(group(h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, "Workouts a week"),
      stepper(s.goal || planned || 3, { min: 1, max: 7, label: "workouts", onChange: (v) => store.setSetting("goal", v === planned ? null : v) }))));
    parts.push(footer(`For the week's progress bar and your streak (weeks in a row you reached it).${planned ? ` Your plan has ${plural(planned, "training day")}.` : ""}`));

    parts.push(caption("Look"));
    const themes = ["auto", "light", "dark"];
    parts.push(h("div", { class: "group", style: { padding: "10px" } }, segmented(["Automatic", "Light", "Dark"], Math.max(0, themes.indexOf(store.pref("theme", "auto"))),
      (i) => { store.setPref("theme", themes[i]); applyTheme(); }, "full")));
    parts.push(footer("The workout screen is always dark, like the iPhone's Clock app."));

    parts.push(caption("Exercises"));
    parts.push(group(actionRow("list", "Exercise list", () => openLibrary(), { detail: "Add your own, change one, hide the ones you don't do" })));

    parts.push(caption("Claude"));
    const ck = apiKey();
    parts.push(group(actionRow("sparkle", "Anthropic API key", async () => { await editApiKey(); build(); }, { value: ck ? `…${ck.slice(-4)}` : "Not set" }),
      ck ? actionRow("trash", "Remove the key", async () => {
        const ok = await alertBox({ title: "Remove the key?", message: "Ask Claude then opens the Claude app instead.", buttons: [NO, { text: "Remove", value: true, style: "destructive" }] });
        if (ok) { setApiKey(""); build(); toast("Key removed"); }
      }, { tone: "danger" }) : null));
    parts.push(footer(ck
      ? "Ask Claude (in Plan › a workout, and after a workout) answers right here. Each answer costs a few cents on your Anthropic account. The key stays on this phone, and every profile here uses it."
      : "Ask Claude (in Plan › a workout, and after a workout) opens the Claude app with your workout, ready to send. With an Anthropic API key (console.anthropic.com, paid separately from a Claude plan: a few cents an answer) the answer comes right here instead."));

    parts.push(caption("Backup"));
    parts.push(group(
      actionRow("download", "Save a backup", () => {
        saveFile(`gymbro-backup-${stamp()}.json`, "application/json", JSON.stringify({ ...store.data, exported: new Date().toISOString() }, null, 1));
        store.noteManualBackup();
      }, { detail: "Every workout, your plan and exercises, in one file (Save to Files › OneDrive works too)" }),
      actionRow("list", "Export to CSV", async () => {
        const v = await actionSheet({ title: "Export to CSV", message: "For Excel, Numbers or Python: one row per set, or per weigh-in.",
          actions: [{ text: "Every set", value: "sets" }, (data.body || []).length ? { text: "Body weight", value: "body" } : null].filter(Boolean) });
        if (v === "sets") saveFile(`gymbro-sets-${stamp()}.csv`, "text/csv", setsCsv(store.data));
        else if (v === "body") saveFile(`gymbro-body-weight-${stamp()}.csv`, "text/csv", bodyCsv(store.data));
      }, { detail: "Every set you've logged, or your body weight" }),
      actionRow("doc", "Restore a backup", async () => {
        const file = await pickFile(".json,application/json");
        if (!file) return;
        try {
          const d = await readBackupFile(file);
          const where = store.cloud ? ` and in ${store.cloud.label}` : "";
          const ok = await alertBox({ title: "Use this backup?", message: `${file.name}: ${describeData(d)}.\n\nIt replaces what's in the app now${where}.`,
            buttons: [NO, { text: "Replace", value: true, style: "bold" }] });
          if (!ok) return;
          store.replaceAll(d);
          toast("✓  Backup restored");
          if (store.needsTap) store.syncFromTap();
        } catch (err) { alertBox({ title: "Can't use that file", message: err.message }); }
      })));
    parts.push(footer(store.cloud
      ? `${store.cloud.label} also keeps a copy each week next to the file (the last 8)${m.lastBackup ? `, latest ${dayText(m.lastBackup)}` : ""}.`
      : `Your workouts are only on this phone, so save a backup now and then. Last saved: ${m.lastManualBackup ? dayText(m.lastManualBackup) : "never"}.`));

    parts.push(caption("On your phone"));
    parts.push(group(h("div", { class: "info-text" },
      h("p", null, h("b", null, "iPhone: "), "open this page in Safari, tap Share, then “Add to Home Screen”. Use the app from its icon (it keeps its own data there)."),
      h("p", null, h("b", null, "Android: "), "open it in Chrome, tap ⋮, then “Add to Home screen” or “Install app”."))));
    parts.push(group(actionRow("sync", "Check for updates", async () => {
      toast("Checking…");
      toast((await checkForUpdate()) ? "A new version is ready: tap Update" : `You have the newest version (${APP_VERSION})`);
    })));
    parts.push(h("div", { class: "about" }, `${APP_NAME} ${APP_VERSION} · ${describeData(data)}`));
    body.replaceChildren(...parts.filter(Boolean));
  }

  build();
  const off = store.on(build);
  sheet({ title: "Settings", right: { text: "Done", bold: true, onClick: (api) => api.close() }, body, onClose: off });
}
