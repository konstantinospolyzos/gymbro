// The first screen: where your workouts are kept (OneDrive, Google Drive, or only this phone).

import { h, icon, alertBox, chip } from "../ui.js";
import { store } from "../store.js";
import { openOneDriveSetup } from "./settings.js";
import { current, profiles, renameProfile } from "../profiles.js";
import { avatar, profileMenu } from "./profiles.js";

const msLogo = () => h("span", { class: "ms-logo", "aria-hidden": "true" },
  h("i", { style: { background: "#F25022" } }), h("i", { style: { background: "#7FBA00" } }), h("i", { style: { background: "#00A4EF" } }), h("i", { style: { background: "#FFB900" } }));

export function renderWelcome() {
  const od = store.clouds.onedrive, gd = store.clouds.gdrive;
  const busy = h("div", { class: "welcome-busy" });
  // a new phone: whose GymBro this is (the first profile); a profile added later already has its name
  const me = current(), many = profiles().length > 1;
  const nameIn = me.name ? null : h("input", { class: "welcome-name", type: "text", placeholder: "Your name", autocomplete: "given-name",
    autocapitalize: "words", maxlength: 30, "aria-label": "Your name" });
  const keepName = () => { if (nameIn) renameProfile(me.id, nameIn.value.trim() || "Me"); };
  const go = (kind, btn) => {
    keepName();
    busy.textContent = `Connecting to ${store.clouds[kind].label}…`;
    btn.disabled = true;
    store.connect(kind)
      .catch((err) => alertBox({ title: `Couldn't connect to ${store.clouds[kind].label}`, message: err.message }))
      .finally(() => { busy.textContent = ""; btn.disabled = false; });
  };
  const odBtn = h("button", { type: "button", class: "btn primary wide" }, od.configured ? "Continue with Microsoft" : "Set up OneDrive");
  odBtn.addEventListener("click", () => { keepName(); if (od.configured) go("onedrive", odBtn); else openOneDriveSetup({ thenConnect: true }); });
  const gdBtn = h("button", { type: "button", class: "btn tinted wide" }, "Continue with Google");
  gdBtn.addEventListener("click", () => go("gdrive", gdBtn));

  return h("div", { class: "welcome" },
    h("img", { class: "welcome-logo", src: "icons/icon-192.png", alt: "" }),
    h("h1", { class: "welcome-title" }, me.name && many ? `Hi ${me.name}` : "GymBro"),
    h("p", { class: "welcome-text" }, "Follow your week's plan, log every set, time your rests and see your progress. First, choose where your workouts are kept."),
    nameIn,
    many ? h("button", { type: "button", class: "welcome-switch", onclick: () => profileMenu() }, avatar(me, 22), `${me.name}'s profile · Switch`) : null,
    h("div", { class: "choice-card" },
      h("div", { class: "choice-head" }, msLogo(), h("div", { class: "choice-title" }, "OneDrive"), od.configured ? null : chip("One-time setup", "warn")),
      h("div", { class: "choice-text" }, "One file in your own OneDrive (Apps › GymBro): the same on your phone and computer, and backed up."),
      odBtn),
    gd.configured ? h("div", { class: "choice-card" },
      h("div", { class: "choice-head" }, icon("cloud", 22, "choice-icon blue"), h("div", { class: "choice-title" }, "Google Drive"), chip("Ready", "up")),
      h("div", { class: "choice-text" }, "The same Google sign-in as your Savings Tracker and Glosor: one file in My Drive › GymBro."),
      gdBtn) : null,
    busy,
    h("div", { class: "choice-card" },
      h("div", { class: "choice-head" }, icon("phone", 22, "choice-icon"), h("div", { class: "choice-title" }, "Only on this phone")),
      h("div", { class: "choice-text" }, "Try the app first. You can move your workouts to OneDrive or Google Drive later in Settings."),
      h("button", { type: "button", class: "btn gray wide", onclick: () => { keepName(); store.startLocal(); } }, "Use on this phone")));
}
