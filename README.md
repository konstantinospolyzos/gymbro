# GymBro

Your gym week on your phone, in the same iOS look as the Savings Tracker and Glosor:

- **Plan:** a workout for each day (Monday: back, with its exercises, sets, reps and the rest between sets)
- **Recommended:** a ready workout for each muscle group (back, chest, shoulders, arms, legs, glutes & hamstrings, core)
  and for push/pull/legs, upper/lower and full-body weeks, with the exercises the research rates best for a fully
  equipped gym; or a whole week for the 3 to 6 days you can train. Every week gives each muscle at least 10 hard sets
  (the least that builds muscle), and more with more days (3 days about 10–12, 4 days 12–14, 5 days 14–17, 6 days
  16–19, never over 20); a test checks it
- **Today:** today's workout, one tap to start
- **The workout:** a clock for the whole workout, one big **Set done** button, then the rest counts down and beeps
  (and flashes) in its last 5 seconds so you're ready for the next set; weights start from last time. A number far
  off from usual (800 kg for 80, 100 reps for 10) is asked about once when you log the set: "800 kg?"
- **In the gym:** warm-up sets for the first heavy lift, the plates for each side of the bar, supersets (one set of
  each in turn, then rest), swap an exercise for a similar one when the machine is taken (or ask Claude for one
  that suits a reason, like knee pain), a video of how to do it, played inside the app (your own YouTube link if you
  like another one)
- **Plan:** drag an exercise by its handle to reorder a workout; each exercise's video is a tap away; under the
  exercises, each muscle the workout works with its hard sets for the whole week as you edit (10–20 is the aim)
- **Notes:** every exercise has its own notes (seat height, grip, what to try next), on its card in every workout;
  the summary and History keep what you wrote on the day
- **Summary:** total time, volume, and every exercise against the last time, with new personal records
- **History:** a calendar and every workout; log one you did without the app
- **Progress:** workouts a week and your streak, volume and time per week, hard sets per muscle this week against
  10–20, body weight, records, lifts that stopped going up (and what helps), and each exercise's best set over time
- **Ask Claude:** feedback on a workout in your plan (with your whole week and the last times) or on one you just
  did, or on your whole week (Plan › Ask Claude to check my week: Claude proposes better exercises, order and sets,
  and you see each workout's changes and choose what to use, with undo): in the Claude app, or right in GymBro with
  your own Anthropic API key (Settings › Claude)
- **Strava:** each workout goes up when you finish it as a Weight Training activity with every set (Strava shows
  the exercises, the volume and its muscle map), with the hard sets per muscle in the description;
  workouts from before go up from Settings › Strava or History. Without a signal it waits until you're back online.
  You make your own Strava API app once (Settings › Strava walks you through it; Strava asks for a subscription)
- **Export:** every set, or your body weight, as CSV for Excel or Python
- **Profiles:** more than one person on a phone, each with their own plan, workouts, body weight and settings, and
  their own OneDrive or Google Drive sign-in (the first profile keeps `gymbro.json`; Anna's is `gymbro-anna.json`)

Data is a JSON file in your own OneDrive (or Google Drive, or on the phone only), synced change by change, the same
way as the Savings Tracker. The app itself is saved on the phone, so it opens at once at the gym, with or without a
signal; a new version downloads in the background and switches over by itself at a quiet moment (never during a
workout).

- `index.html`, `css/`, `js/`: the app (plain JavaScript modules, no build step)
- `auth.html`: where Microsoft's sign-in comes back to (it hands the one-time code to the app); `strava.html` the same
  for Strava
- `js/config.js`: your OneDrive Application (client) ID, and the Google sign-in (the Savings Tracker's; see SETUP.md)
- `js/data.js`: the data file (exercise library, workouts, the week, logged workouts) and the changes made to it
- `js/core.js`: the numbers: estimated one-rep max (Epley), records, comparisons with last time, weeks and streaks
- `js/workout.js`: the workout in progress: the next set, the rest, what gets saved, when to add weight
- `js/library.js`: the recommended workouts and weeks, how to do each exercise, the research behind them (with links),
  and what each exercise is (its movement, bar and the muscles a set counts for)
- `js/profiles.js`: the profiles on the phone and what each keeps (its storage names and its cloud file)
- `js/coach.js`: what Claude is told about a workout, its instructions, and asking it (`js/pages/coach.js`: the sheet)
- `js/strava.js`: a workout as Strava gets it (each exercise as one of Strava's, every set, the description);
  `js/strava-api.js`: connecting, uploading and the queue (`js/pages/strava.js`: the setup, Settings and the rows)
- `js/csv.js`: the CSV export; `js/update.js`: new versions, switched to at a quiet moment; `sw.js`: the offline copy of the app (its
  `VERSION` is the app's version: change both for a new version)
- `js/store.js`: syncing, offline queue, weekly backup in the cloud; `js/cloud/onedrive.js` (Microsoft Graph, the
  app's own OneDrive folder) and `js/cloud/google.js` (Google Drive)
- `js/sound.js`: the countdown beeps, keeping the screen on
- `js/pages/`: Today, the workout screen (`live.js`), the summary, Plan and its editors, the recommendations
  (`recommend.js`), History, Progress, Settings, Ask Claude (`coach.js`) and an exercise's video (`video.js`)
- `tests/`: checks for the data, the numbers, the workout, syncing, the OneDrive connection and what Strava gets. Run `npm test`
  (Node 22+); GitHub runs them on every push

Setup: see SETUP.md.
