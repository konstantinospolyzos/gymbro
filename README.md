# GymBro

Your gym week on your phone, in the same iOS look as the Savings Tracker and Glosor:

- **Plan:** a workout for each day (Monday: back, with its exercises, sets, reps and the rest between sets)
- **Recommended:** a ready workout for each muscle group (back, chest, shoulders, arms, legs, glutes & hamstrings, core)
  and for push/pull/legs, upper/lower and full-body weeks, with the exercises the research rates best for a fully
  equipped gym; or a whole week picked for the number of days you can train
- **Today:** today's workout, one tap to start
- **The workout:** a clock for the whole workout, one big **Set done** button, then the rest counts down and beeps
  (and flashes) in its last 5 seconds so you're ready for the next set; weights start from last time
- **In the gym:** warm-up sets for the first heavy lift, the plates for each side of the bar, supersets (one set of
  each in turn, then rest), swap an exercise for a similar one when the machine is taken, a video of how to do it
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
- **Export:** every set, or your body weight, as CSV for Excel or Python
- **Profiles:** more than one person on a phone, each with their own plan, workouts, body weight and settings, and
  their own OneDrive or Google Drive sign-in (the first profile keeps `gymbro.json`; Anna's is `gymbro-anna.json`)

Data is a JSON file in your own OneDrive (or Google Drive, or on the phone only), synced change by change, the same
way as the Savings Tracker. The app itself is saved on the phone, so it opens at once at the gym, with or without a
signal; a new version downloads in the background and a bar offers to switch to it.

- `index.html`, `css/`, `js/`: the app (plain JavaScript modules, no build step)
- `auth.html`: where Microsoft's sign-in comes back to (it hands the one-time code to the app)
- `js/config.js`: your OneDrive Application (client) ID, and the Google sign-in (the Savings Tracker's; see SETUP.md)
- `js/data.js`: the data file (exercise library, workouts, the week, logged workouts) and the changes made to it
- `js/core.js`: the numbers: estimated one-rep max (Epley), records, comparisons with last time, weeks and streaks
- `js/workout.js`: the workout in progress: the next set, the rest, what gets saved, when to add weight
- `js/library.js`: the recommended workouts and weeks, how to do each exercise, the research behind them (with links),
  and what each exercise is (its movement, bar and the muscles a set counts for)
- `js/profiles.js`: the profiles on the phone and what each keeps (its storage names and its cloud file)
- `js/coach.js`: what Claude is told about a workout, its instructions, and asking it (`js/pages/coach.js`: the sheet)
- `js/csv.js`: the CSV export; `js/update.js`: "New version ready"; `sw.js`: the offline copy of the app (its
  `VERSION` is the app's version: change both for a new version)
- `js/store.js`: syncing, offline queue, weekly backup in the cloud; `js/cloud/onedrive.js` (Microsoft Graph, the
  app's own OneDrive folder) and `js/cloud/google.js` (Google Drive)
- `js/sound.js`: the countdown beeps, keeping the screen on
- `js/pages/`: Today, the workout screen (`live.js`), the summary, Plan and its editors, the recommendations
  (`recommend.js`), History, Progress, Settings
- `tests/`: checks for the data, the numbers, the workout, syncing and the OneDrive connection. Run `npm test`
  (Node 22+); GitHub runs them on every push

Setup: see SETUP.md.
