# GymBro

Your gym week on your phone, in the same iOS look as the Savings Tracker and Glosor:

- **Plan:** a workout for each day (Monday: back, with its exercises, sets, reps and the rest between sets)
- **Recommended:** a ready workout for each muscle group (back, chest, shoulders, arms, legs, glutes & hamstrings, core)
  and for push/pull/legs, upper/lower and full-body weeks, with the exercises the research rates best for a fully
  equipped gym; or a whole week picked for the number of days you can train
- **Today:** today's workout, one tap to start
- **The workout:** a clock for the whole workout, one big **Set done** button, then the rest counts down and beeps
  (and flashes) in its last 5 seconds so you're ready for the next set; weights start from last time
- **Notes:** every exercise has its own notes (seat height, grip, what to try next), on its card in every workout;
  the summary and History keep what you wrote on the day
- **Summary:** total time, volume, and every exercise against the last time, with new personal records
- **History:** a calendar and every workout; log one you did without the app
- **Progress:** workouts a week and your streak, volume and time per week, sets per muscle group, records, and each
  exercise's best set over time

Data is a JSON file in your own OneDrive (or Google Drive, or on the phone only), synced change by change, the same
way as the Savings Tracker. It works offline at the gym.

- `index.html`, `css/`, `js/`: the app (plain JavaScript modules, no build step)
- `auth.html`: where Microsoft's sign-in comes back to (it hands the one-time code to the app)
- `js/config.js`: your OneDrive Application (client) ID, and the Google sign-in (the Savings Tracker's; see SETUP.md)
- `js/data.js`: the data file (exercise library, workouts, the week, logged workouts) and the changes made to it
- `js/core.js`: the numbers: estimated one-rep max (Epley), records, comparisons with last time, weeks and streaks
- `js/workout.js`: the workout in progress: the next set, the rest, what gets saved, when to add weight
- `js/library.js`: the recommended workouts and weeks, how to do each exercise, and the research behind them (with links)
- `js/store.js`: syncing, offline queue, weekly backup in the cloud; `js/cloud/onedrive.js` (Microsoft Graph, the
  app's own OneDrive folder) and `js/cloud/google.js` (Google Drive)
- `js/sound.js`: the countdown beeps, keeping the screen on
- `js/pages/`: Today, the workout screen (`live.js`), the summary, Plan and its editors, the recommendations
  (`recommend.js`), History, Progress, Settings
- `tests/`: checks for the data, the numbers, the workout, syncing and the OneDrive connection. Run `npm test`
  (Node 22+); GitHub runs them on every push

Setup: see SETUP.md.
