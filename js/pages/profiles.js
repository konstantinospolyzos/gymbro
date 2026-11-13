// The profiles on this phone: switch, add, rename, take one off the phone.

import { h, icon, sheet, group, footer, alertBox, actionSheet, askText, toast, initials } from "../ui.js";
import { store } from "../store.js";
import { profiles, current, addProfile, renameProfile, deleteProfile, switchTo, metaOf, hasActive } from "../profiles.js";
import { NO } from "./common.js";

const WHERE = { onedrive: "OneDrive", gdrive: "Google Drive", local: "This phone only" };

/** A round badge with the profile's first letter */
export const avatar = (p, size = 34) => h("span", { class: `avatar c-${p.color || "blue"}`, style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.44)}px` },
  "aria-hidden": "true" }, initials(p.name || "?").slice(0, 1));

/** Open the app as another profile (a workout in progress here keeps going and waits) */
export async function switchProfile(p) {
  if (store.active) {
    const ok = await alertBox({ title: `Switch to ${p.name}?`, message: `Your workout keeps going: it's here when you switch back to ${current().name}.`,
      buttons: [NO, { text: "Switch", value: true, style: "bold" }] });
    if (!ok) return;
  }
  switchTo(p.id);
}

/** Add a profile, then open the app as it */
export async function newProfile() {
  const name = await askText({ title: "New profile", message: "For someone else who trains with GymBro on this phone. Their plan, workouts and body weight are their own.",
    placeholder: "Name", ok: "Add" });
  if (!name) return;
  const p = addProfile(name);
  await switchProfile(p);
}

function whereText(p) {
  const m = metaOf(p.id);
  if (!m?.mode) return "Not set up yet";
  return [WHERE[m.mode] || m.mode, m.mode !== "local" ? m.email || m.name : null].filter(Boolean).join(" · ");
}

/** The profiles on this phone */
export function openProfiles() {
  const body = h("div", { class: "form" });
  let api = null;
  const build = () => {
    const me = current();
    body.replaceChildren(
      group(profiles().map((p) => h("button", { type: "button", class: "profile-row", onclick: () => rowMenu(p) },
        avatar(p, 38),
        h("span", { class: "profile-text" }, h("span", { class: "profile-name" }, p.name || "Me", p.id === me.id ? h("span", { class: "profile-here" }, " · this profile") : null),
          h("span", { class: "profile-sub" }, [whereText(p), p.id !== me.id && hasActive(p.id) ? "workout in progress" : null].filter(Boolean).join(" · "))),
        p.id === me.id ? icon("checkBold", 18, "profile-check") : icon("chevron", 15, "chev"))),
      h("button", { type: "button", class: "action-row", onclick: () => newProfile() }, h("span", { class: "action-icon" }, icon("plus", 18)),
        h("span", { class: "action-text" }, "Add a profile"))),
      footer("Each profile has its own plan, workouts, body weight and settings, and its own place to save them: OneDrive or Google Drive (even another person's account) or only this phone. Switching takes a second."));
  };
  const rowMenu = async (p) => {
    const me = current();
    const v = await actionSheet({ title: p.name, actions: [
      p.id !== me.id ? { text: `Switch to ${p.name}`, value: "switch" } : null,
      { text: "Rename", value: "rename" },
      p.id !== me.id ? { text: "Take off this phone", value: "delete", style: "destructive" } : null].filter(Boolean) });
    if (v === "switch") { api.close(); switchProfile(p); }
    else if (v === "rename") {
      const name = await askText({ title: "Rename", value: p.name, placeholder: "Name" });
      if (!name) return;
      renameProfile(p.id, name);
      build();
      store.emit();
    } else if (v === "delete") {
      const cloud = metaOf(p.id)?.mode;
      const ok = await alertBox({ title: `Take ${p.name} off this phone?`,
        message: `${p.name}'s workouts and sign-in on this phone go.${cloud && cloud !== "local" ? ` The file in ${WHERE[cloud]} stays, so adding ${p.name} again and signing in brings everything back.` : " They're only on this phone, so they're gone for good."}`,
        buttons: [NO, { text: "Take off", value: true, style: "destructive" }] });
      if (!ok) return;
      deleteProfile(p.id);
      build();
      store.emit();
      toast(`${p.name} is off this phone`);
    }
  };
  build();
  api = sheet({ title: "Profiles", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body });
}

/** The name at the top: switch in two taps (with only one profile: the list, to add one) */
export async function profileMenu() {
  const me = current();
  const others = profiles().filter((p) => p.id !== me.id);
  if (!others.length) { openProfiles(); return; }
  const v = await actionSheet({ title: `You're ${me.name || "in this profile"}`, actions: [
    ...others.map((p) => ({ text: `Switch to ${p.name}`, value: p.id })),
    { text: "Profiles…", value: "all" }] });
  if (v === "all") openProfiles();
  else if (v) switchProfile(others.find((p) => p.id === v));
}
