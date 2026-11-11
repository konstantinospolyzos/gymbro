// Recommended workouts: one for each muscle group, plus the workouts for push/pull/legs, upper/lower and
// full-body weeks, and the weeks themselves. Picked from the research (sources at the end):
//
// - each workout starts with a heavy compound lift (6–10 reps, 2–3 minutes' rest), then exercises that load
//   the muscle where it's stretched, the position studies keep finding best for growth;
// - machines and cables where they let you take a set close to failure safely;
// - about 10–15 hard sets for the muscle the workout is for; reps as a range (8–12): reach the top in every
//   set and the app tells you to add weight next time.

/** A short name for small spaces (the week grid) */
const SHORT = { "Glutes & hamstrings": "Glutes", "Upper body": "Upper", "Lower body": "Lower", "Full body A": "Full A", "Full body B": "Full B" };

/** [exercise id, sets, reps from, reps to, rest seconds] */
const W = (id, name, group, color, rest, focus, items) => ({ id, name, short: SHORT[name] || name, group, color, rest, focus,
  items: items.map(([ex, sets, reps, hi, r], i) => ({ id: `${id}-${i + 1}`, ex: `ex-${ex}`, sets, reps, hi, w: null, secs: null, rest: r })) });

export const RECOMMENDED = [
  // one muscle group each
  W("rec-back", "Back", "Back", "blue", 120, "Lats and upper back: a vertical pull, two rows and a lat isolation.", [
    ["lat-pulldown", 3, 8, 12, 120], ["chest-supported-row", 3, 8, 12, 120], ["seated-cable-row", 3, 10, 12, 90],
    ["single-arm-pulldown", 2, 10, 12, 90], ["straight-arm-pulldown", 2, 12, 15, 60]]),
  W("rec-chest", "Chest", "Chest", "red", 120, "The whole chest with extra upper chest, finishing with flies in the stretch.", [
    ["bench-press", 3, 6, 10, 150], ["incline-dumbbell-press", 3, 8, 12, 120], ["chest-press-machine", 2, 8, 12, 120],
    ["seated-cable-fly", 3, 12, 15, 90]]),
  W("rec-shoulders", "Shoulders", "Shoulders", "orange", 90, "Front, side and rear delts. The side and rear get the most sets: presses already work the front.", [
    ["dumbbell-shoulder-press", 3, 8, 12, 150], ["cable-lateral-raise", 3, 10, 15, 90], ["lateral-raise", 2, 12, 20, 60],
    ["reverse-pec-deck", 3, 12, 15, 90], ["face-pull", 2, 12, 15, 60]]),
  W("rec-arms", "Arms", "Arms", "purple", 90, "Biceps and triceps, each first in its stretched position.", [
    ["overhead-cable-extension", 3, 10, 12, 90], ["incline-dumbbell-curl", 3, 8, 12, 90], ["triceps-pushdown", 3, 10, 15, 90],
    ["bayesian-curl", 2, 10, 12, 90], ["hammer-curl", 2, 10, 12, 60]]),
  W("rec-legs", "Legs", "Legs", "green", 150, "Quads, hamstrings, glutes and calves: a squat, a hinge, then each muscle in its stretch.", [
    ["squat", 3, 6, 10, 180], ["romanian-deadlift", 3, 8, 10, 150], ["leg-extension", 3, 10, 15, 90],
    ["seated-leg-curl", 3, 10, 12, 90], ["standing-calf-raise", 3, 10, 15, 90]]),
  W("rec-glutes", "Glutes & hamstrings", "Glutes & hamstrings", "pink", 120, "The back of the legs: hip thrusts and hinges, split squats and curls.", [
    ["hip-thrust", 3, 8, 12, 150], ["romanian-deadlift", 3, 8, 10, 150], ["bulgarian-split-squat", 3, 8, 12, 120],
    ["seated-leg-curl", 3, 10, 12, 90], ["hip-abduction", 2, 12, 20, 60]]),
  W("rec-core", "Core", "Core", "teal", 60, "Abs and obliques in about 20 minutes: add it after any workout.", [
    ["hanging-leg-raise", 3, 10, 15, 90], ["cable-crunch", 3, 10, 15, 90], ["ab-wheel", 2, 8, 12, 90], ["cable-woodchopper", 2, 12, 15, 60]]),
  // for weeks that train several muscle groups a day
  W("rec-push", "Push", "Splits", "red", 120, "Chest, shoulders and triceps.", [
    ["bench-press", 3, 6, 10, 150], ["incline-dumbbell-press", 3, 8, 12, 120], ["cable-lateral-raise", 3, 10, 15, 90],
    ["seated-cable-fly", 2, 12, 15, 90], ["overhead-cable-extension", 3, 10, 12, 90]]),
  W("rec-pull", "Pull", "Splits", "blue", 120, "Back, rear delts and biceps.", [
    ["lat-pulldown", 3, 8, 12, 120], ["chest-supported-row", 3, 8, 12, 120], ["seated-cable-row", 2, 10, 12, 90],
    ["reverse-pec-deck", 2, 12, 15, 90], ["incline-dumbbell-curl", 3, 8, 12, 90]]),
  W("rec-upper", "Upper body", "Splits", "indigo", 120, "Chest, back, shoulders and arms in one workout.", [
    ["incline-dumbbell-press", 3, 6, 10, 150], ["chest-supported-row", 3, 8, 12, 120], ["lat-pulldown", 3, 8, 12, 120],
    ["cable-lateral-raise", 3, 10, 15, 90], ["overhead-cable-extension", 2, 10, 12, 90], ["incline-dumbbell-curl", 2, 8, 12, 90]]),
  W("rec-lower", "Lower body", "Splits", "green", 150, "Quads, hamstrings, glutes, calves and abs.", [
    ["hack-squat", 3, 6, 10, 180], ["romanian-deadlift", 3, 8, 10, 150], ["seated-leg-curl", 3, 10, 12, 90],
    ["leg-extension", 2, 10, 15, 90], ["standing-calf-raise", 3, 10, 15, 90], ["hanging-leg-raise", 2, 10, 15, 90]]),
  W("rec-full-a", "Full body A", "Splits", "teal", 150, "Every muscle group in one workout; alternate it with B.", [
    ["squat", 3, 6, 10, 180], ["bench-press", 3, 6, 10, 150], ["lat-pulldown", 3, 8, 12, 120],
    ["romanian-deadlift", 2, 8, 10, 150], ["cable-lateral-raise", 2, 12, 15, 90], ["overhead-cable-extension", 2, 10, 12, 90]]),
  W("rec-full-b", "Full body B", "Splits", "indigo", 150, "Every muscle group in one workout; alternate it with A.", [
    ["leg-press", 3, 8, 12, 150], ["incline-dumbbell-press", 3, 8, 12, 120], ["chest-supported-row", 3, 8, 12, 120],
    ["hip-thrust", 2, 8, 12, 120], ["seated-leg-curl", 2, 10, 12, 90], ["incline-dumbbell-curl", 2, 8, 12, 90]]),
];

export const GROUPS = ["Back", "Chest", "Shoulders", "Arms", "Legs", "Glutes & hamstrings", "Core", "Splits"];
export const GROUP_LABELS = { Splits: "For weeks with several muscle groups a day" };

export const recommendedById = (id) => RECOMMENDED.find((r) => r.id === id) || null;

/** A recommended workout as a workout of your own (same id: its history stays linked if you add it later) */
export function asWorkout(rec) {
  return { id: rec.id, name: rec.name, color: rec.color, rest: rec.rest, items: rec.items.map((it) => ({ ...it })) };
}

/** Recommended weeks. schedule: JavaScript weekday (0 Sunday … 6 Saturday) -> recommended workout */
export const WEEKS = [
  { id: "full2", days: 2, name: "Full body, 2 days", text: "Every muscle twice a week in two workouts: the most you get from two gym days.",
    schedule: { 1: "rec-full-a", 4: "rec-full-b" } },
  { id: "full3", days: 3, name: "Full body, 3 days", text: "Every muscle three times a week, alternating A and B. Lots of results per hour in the gym.",
    schedule: { 1: "rec-full-a", 3: "rec-full-b", 5: "rec-full-a" } },
  { id: "ppl3", days: 3, name: "Push, pull, legs", text: "Chest-shoulders-triceps, back-biceps, then legs: one day each.",
    schedule: { 1: "rec-push", 3: "rec-pull", 5: "rec-legs" } },
  { id: "ul4", days: 4, name: "Upper / lower", text: "Every muscle twice a week. Research favours training a muscle at least twice a week once you do more than about 10 sets for it.",
    schedule: { 1: "rec-upper", 2: "rec-lower", 4: "rec-upper", 5: "rec-lower" } },
  { id: "split5", days: 5, name: "One muscle group a day", text: "Monday back, Tuesday chest, Wednesday legs, Thursday shoulders, Friday arms: each muscle gets a full workout of its own.",
    schedule: { 1: "rec-back", 2: "rec-chest", 3: "rec-legs", 4: "rec-shoulders", 5: "rec-arms" } },
  { id: "ppl6", days: 6, name: "Push, pull, legs, twice", text: "Every muscle twice a week with plenty of sets, for six gym days. Saturday is a second leg day for glutes and hamstrings.",
    schedule: { 1: "rec-push", 2: "rec-pull", 3: "rec-legs", 4: "rec-push", 5: "rec-pull", 6: "rec-glutes" } },
];

/** The weeks for a number of gym days, the recommended one first */
export function weeksFor(days) {
  const list = WEEKS.filter((w) => w.days === days);
  return list.length ? list : WEEKS.filter((w) => w.days === Math.min(6, Math.max(2, days)));
}

/** A week as one change: its workouts (the ones you don't have yet) and the days they're on */
export function weekOp(weekId, data = null) {
  const week = WEEKS.find((w) => w.id === weekId);
  const ids = [...new Set(Object.values(week.schedule))];
  const have = new Set((data?.workouts || []).map((w) => w.id));
  return { type: "setWeek", workouts: ids.filter((id) => !have.has(id)).map((id) => asWorkout(recommendedById(id))), schedule: { ...week.schedule } };
}

/** How to do each exercise, and why it's in the workouts */
export const TIPS = {
  "ex-lat-pulldown": "Pull the bar to your upper chest with the elbows going down, then let it rise until the arms are straight and the lats stretch. A close neutral grip and a wide grip both work well.",
  "ex-chest-supported-row": "Chest on the pad (a row machine, a T-bar with a pad, or dumbbells on an incline bench). Pull the elbows past your body, then let the shoulder blades travel forward. The pad takes the lower back out of it, so all the effort goes to the back.",
  "ex-seated-cable-row": "Sit tall and row to the lower ribs. At the front, let the shoulders reach forward for a full stretch before the next rep.",
  "ex-single-arm-pulldown": "Half-kneeling, one arm at a time (sets are per arm): pull the elbow down to your side, and at the top let the weight pull your arm up for a deep lat stretch.",
  "ex-straight-arm-pulldown": "Arms almost straight, sweep the bar or rope from eye level down to your thighs. The biceps can't help, so the lats do all the work.",
  "ex-face-pull": "Rope at forehead height: pull towards your face with the elbows high and turn the fists back at the end. Rear delts and upper back.",
  "ex-bench-press": "Shoulder blades pulled together, bar to the lower chest, press up and slightly back. Flat pressing trains the whole chest through a long range.",
  "ex-incline-dumbbell-press": "Bench at about 30°, lower the dumbbells deep beside the chest. In an 8-week study, incline pressing built more upper chest than flat pressing.",
  "ex-chest-press-machine": "Handles at mid-chest height. The machine keeps you stable, so you can push close to failure safely.",
  "ex-seated-cable-fly": "Sit with the cables behind you and the arms wide and slightly bent: the chest is stretched at the start of every rep.",
  "ex-dumbbell-shoulder-press": "Seated with the back supported. Lower the dumbbells to ear height and press up.",
  "ex-cable-lateral-raise": "Cable at hand height, raise the arm out to the side to shoulder height (sets are per arm). The cable keeps tension at the bottom, where a dumbbell has almost none.",
  "ex-lateral-raise": "Lead with the elbows to shoulder height and lower slowly. Side delts do well with many sets of moderate weights.",
  "ex-reverse-pec-deck": "Face the pad, arms straight in front, sweep them out and back: the rear delts, often the weakest part of the shoulder.",
  "ex-overhead-cable-extension": "Face away from the cable with the rope behind your head and straighten the arms overhead. In a 12-week study, overhead extensions grew the triceps about 40 % more than pushdowns.",
  "ex-triceps-pushdown": "Elbows pinned to your sides, push down until the arms are straight. Easy to load and progress.",
  "ex-incline-dumbbell-curl": "Bench at about 45° with the arms hanging behind your body: the biceps' long head is stretched at the bottom of every rep.",
  "ex-bayesian-curl": "Face away from a low cable with the arm behind you and curl forward (sets are per arm). The pull is strongest where the biceps is stretched.",
  "ex-hammer-curl": "Thumbs up: works the brachialis and the forearm, which thicken the arm and push the biceps up.",
  "ex-squat": "Bar on the upper back, sit down between your heels as deep as you can with a neutral back. Squats grow the quads, glutes and inner thighs.",
  "ex-hack-squat": "Feet mid-platform, go deep. The machine keeps you stable, so you can take sets close to failure safely.",
  "ex-leg-press": "Feet shoulder-width, lower until the knees are well bent without the lower back rounding off the pad.",
  "ex-romanian-deadlift": "Soft knees, push the hips back with the bar close to the legs until the hamstrings stretch, then drive the hips forward. Keep the back neutral.",
  "ex-seated-leg-curl": "Sit tall and lean slightly forward: the bend at the hip stretches the hamstrings. In a 12-week study, seated curls grew the hamstrings more than lying curls.",
  "ex-leg-extension": "Use the full range and let the knees bend deeply at the bottom: training the deep range grew the quads about twice as much in one study.",
  "ex-standing-calf-raise": "Pause at the bottom in the stretch, then rise. Reps in the bottom half grew the calves about twice as much as full reps in one study, so never cut the stretch short.",
  "ex-hip-thrust": "Upper back on a bench, bar on the hips: push up until the hips are straight and squeeze. In a 9-week study it built the glutes as well as squats, with less thigh.",
  "ex-bulgarian-split-squat": "Back foot on a bench, lean slightly forward and go deep (sets are per leg): a big stretch for the glutes and quads.",
  "ex-hip-abduction": "Push the knees out against the pads: the side glutes, which squats and thrusts barely reach.",
  "ex-hanging-leg-raise": "Hang, then curl the pelvis up and lift the knees high without swinging. The leg raise ranked high for the abs in every EMG study.",
  "ex-cable-crunch": "Kneel with the rope by your head and curl your ribs towards your hips. Abs can be loaded and progressed like any other muscle.",
  "ex-ab-wheel": "From the knees, roll out as far as you can with a flat back, then pull back with the abs.",
  "ex-cable-woodchopper": "Rotate from high to low across your body with straight arms (sets are per side): the obliques.",
  "ex-pull-up": "Hands just outside the shoulders, pull your chest to the bar and lower all the way. Add weight on a belt once you get past about 12 reps.",
  "ex-dips": "Lean slightly forward and lower until the shoulders are a little below the elbows. Add weight on a belt when they get easy.",
};

/** The research behind the choices (shown in the app, with links) */
export const RESEARCH = [
  { text: "Each workout starts with a heavy compound lift, then trains each muscle where it's stretched. Overhead extensions grew the triceps about 40 % more than pushdowns, seated leg curls beat lying curls for the hamstrings, and deep-range leg extensions and bottom-half calf raises roughly doubled growth.",
    links: [["Stronger By Science: training at long muscle lengths", "https://www.strongerbyscience.com/stretch-mediated-hypertrophy/"],
      ["Menno Henselmans: the best exercises to build muscle", "https://mennohenselmans.com/these-are-the-best-exercises-to-build-muscle-science-based/"]] },
  { text: "Machines and cables where they let you take sets close to failure safely; chest-supported rows and pulldowns lead the back rankings, incline pressing builds the upper chest, cable lateral raises and the reverse pec deck the side and rear delts.",
    links: [["Jeff Nippard's picks for every muscle (Fitness Volt)", "https://fitnessvolt.com/jeff-nippard-best-exercises-every-muscle-group"],
      ["Jeff Nippard's back exercise ranking (Fitness Volt)", "https://fitnessvolt.com/jeff-nippard-best-and-worst-back-exercises"],
      ["Incline vs flat bench press (StrengthLog)", "https://www.strengthlog.com/incline-bench-press-vs-flat-bench-press/"]] },
  { text: "Hip thrusts and squats built the glutes about equally in a 9-week study; squats grew more thigh. Leg raises ranked high for the abs in every EMG study.",
    links: [["Plotkin et al. 2023, Frontiers in Physiology", "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full"],
      ["Best and worst ab exercises (The Barbell)", "https://thebarbell.com/science-says-the-best-and-worst-ab-exercises/"]] },
  { text: "Rest 2–3 minutes after heavy lifts (3 minutes grew more muscle and strength than 1 minute), 1–1.5 minutes after small exercises. About 10–20 hard sets per muscle a week work best, with less from each extra set.",
    links: [["Rest between sets: Schoenfeld et al. 2016 (Weight Training Guide)", "https://weighttraining.guide/blog/should-experienced-lifters-rest-longer-between-sets"],
      ["How many sets: Pelland et al. 2024 (BarBend)", "https://barbend.com/scientifically-correct-number-sets-per-workout"]] },
  { text: "Reps come as a range, like 8–12, ending 1–3 reps before you couldn't do another. When every set reaches the top of the range, add weight next time: the app suggests it during the workout.", links: [] },
];
