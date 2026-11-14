// An exercise's video, played inside GymBro (YouTube's own player, in a sheet). Opening YouTube instead
// leaves the app, and an iPhone can bring you back to a blank GymBro. With it: how to do it, and your own
// video for the exercise (a YouTube link) if you like another one better.

import { h, icon, sheet, group, caption, footer, actionRow, askText, alertBox, toast } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { TIPS, VIDEOS, videoIdOf, youTubeId, videoUrl } from "../library.js";

/** YouTube's player for a video: plays right here (playsinline), no suggestions from other channels */
export const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;

/** YouTube's search, outside GymBro (the last resort, when no video is saved for an exercise) */
function searchYouTube(name) {
  const a = h("a", { href: videoUrl(name), target: "_blank", rel: "noopener" });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The video sheet of an exercise (exId), over the workout screen too */
export function openVideo(exId, { name = "" } = {}) {
  const body = h("div", { class: "form video-sheet" });
  const exNow = () => exerciseMap(store.data).get(exId) || { id: exId, name };
  const save = (video) => {
    const cur = exNow();
    if (!exerciseMap(store.data).get(exId)) return;
    const next = { ...cur };
    if (video) next.video = video; else delete next.video;
    store.saveExercise(next);
  };
  const draw = () => {
    const ex = exNow();
    const id = videoIdOf(ex);
    const own = Boolean(youTubeId(ex.video));
    body.replaceChildren(...[
      id ? h("div", { class: "video-frame" }, h("iframe", { src: embedUrl(id), title: `${ex.name}: how to do it`, loading: "lazy",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin" }))
        : h("div", { class: "card video-none" }, h("span", { class: "video-none-icon" }, icon("play", 26)),
          h("div", null, h("div", { class: "card-title" }, "No video yet"),
            h("div", { class: "muted" }, "Add one: in YouTube, tap Share › Copy link on a video, then paste it here."))),
      id ? footer(own ? "Your video for this exercise." : "Plays here in GymBro. The player's full-screen button makes it bigger.") : null,
      TIPS[ex.id] ? caption("How to do it") : null,
      TIPS[ex.id] ? h("div", { class: "group" }, h("div", { class: "info-text", style: { padding: "12px 16px" } }, TIPS[ex.id])) : null,
      caption("Video"),
      group(
        actionRow("link", own ? "Change your video" : id ? "Use another video" : "Add a video", async () => {
          const text = await askText({ title: "A YouTube video", message: `For ${ex.name}: paste the video's link (in YouTube: Share › Copy link).`,
            value: own ? `https://youtu.be/${ex.video}` : "", placeholder: "https://youtu.be/…", ok: "Use", mode: "url" });
          if (!text) return;
          const vid = youTubeId(text);
          if (!vid) { alertBox({ title: "That's not a YouTube video link", message: "Copy the link from YouTube's Share button and paste it here." }); return; }
          save(vid);
          toast("Video saved for this exercise");
          draw();
        }, { detail: "Paste a YouTube link" }),
        own && VIDEOS[ex.id] ? actionRow("sync", "Back to GymBro's video", () => { save(null); draw(); }) : null,
        own && !VIDEOS[ex.id] ? actionRow("trash", "Remove your video", () => { save(null); draw(); }, { tone: "danger" }) : null,
        actionRow("search", "Search on YouTube", () => searchYouTube(ex.name), { detail: "Opens YouTube, outside GymBro" })),
    ].filter(Boolean));
  };
  draw();
  sheet({ title: exNow().name || "Video", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body });
}
