# GymBro on your phone: setup

You'll do three things:

1. Put the app online with **GitHub Pages**, at `https://konstantinospolyzos.github.io/gymbro/` (5 minutes).
2. Choose where your workouts are saved:
   - **OneDrive**: a free "app registration" at Microsoft, once (about 10 minutes, part 2 below), or
   - **Google Drive**: nothing new to set up. It uses the Savings Tracker's Google sign-in, like Glosor, or
   - **only on the phone**, to try the app first. You can move to OneDrive or Google Drive later in Settings.
3. Open it on your iPhone and **Add to Home Screen**.

Nothing costs money, and no server holds your workouts: the website is just these files, and your data goes
from your phone straight to your own OneDrive (or Google Drive).

---

## 1. Put the app online (GitHub Pages)

1. Go to <https://github.com/new>.
   - Repository name: `gymbro` (it becomes part of the address)
   - **Public** (only the app's code is public; your workouts never go to GitHub)
   - Click **Create repository**.
2. On the new repository page, click **uploading an existing file**.
   Drag **everything inside** the unzipped `gymbro` folder into the page (the `index.html`, `auth.html`,
   `manifest.webmanifest`, `sw.js` and `package.json` files plus the `css`, `js`, `icons` and `tests` folders),
   then click **Commit changes**. (The hidden `.github` folder only runs the tests on GitHub. It's fine to leave it out.)
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**,
   folder **/ (root)**, and click **Save**.
4. After a minute the page shows *Your site is live at* `https://konstantinospolyzos.github.io/gymbro/`.
   Open it: you see the welcome screen. "Only on this phone" and Google Drive already work.

## 2. OneDrive (once)

The app needs permission to save one file in your OneDrive. Microsoft gives that permission to registered apps
only, so you register yours. It's free, and the app can only see its own folder (`OneDrive › Apps › GymBro`).

### 2a. A Microsoft "directory" (only if you don't have one)

Since 2024 Microsoft only lets you register apps inside a directory (they also call it a tenant).

1. Open <https://entra.microsoft.com> and sign in with the Microsoft account that has your OneDrive
   (your outlook.com / hotmail / live address).
2. If it opens the *Microsoft Entra admin center* with a menu on the left (Identity, Applications…), you have one:
   go to 2b.
3. If it says you don't have access or need a directory: create a free Azure account at
   <https://azure.microsoft.com/free> with the same Microsoft account. That makes a directory ("Default Directory")
   for you. Microsoft may ask for a phone number and a card to check it's you; registering an app is free and
   nothing is charged for it. Then go back to <https://entra.microsoft.com>.

### 2b. Register the app

1. In the Entra admin center: **Identity → Applications → App registrations → New registration**.
2. Fill in:
   - **Name:** `GymBro` (the folder in your OneDrive gets this name)
   - **Supported account types:** **Personal Microsoft accounts** only
   - **Redirect URI:** choose **Single-page application (SPA)** and enter
     `https://konstantinospolyzos.github.io/gymbro/auth.html`
3. Click **Register**.
4. On the page that opens (*Overview*), copy the **Application (client) ID**. It looks like
   `1a2b3c4d-1234-5678-9abc-1234567890ab`. (No "client secret" is needed.)

If you forgot the redirect address in step 2: **Authentication → Add a platform → Single-page application**, paste
the address, **Configure**. It must be under *Single-page application*, not *Web*.

Optional, for tidiness: **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, tick
`Files.ReadWrite.AppFolder`, `offline_access`, `openid` and `profile`, then **Add permissions**. The app asks for
these when you sign in anyway.

### 2c. Give the app its ID

Pick one:

- **For every device (recommended):** on GitHub open `js/config.js`, click the pencil (Edit), paste the ID between
  the quotes and click **Commit changes**:

  ```js
  oneDriveClientId: "1a2b3c4d-1234-5678-9abc-1234567890ab",
  ```

- **Just on this phone:** in the app tap **Set up OneDrive** (on the welcome screen, or in Settings) and paste it there.
  The same screen shows the redirect address with a Copy button.

### 2d. Connect

Tap **Continue with Microsoft**. A Microsoft window opens: sign in, and allow *GymBro* to use its app folder
(Microsoft shows "Let this app access your info?"). The window closes and the app saves
`OneDrive › Apps › GymBro › gymbro.json`. (In Swedish OneDrive the Apps folder may show as *Appar*.)

## 3. On your iPhone

1. Open `https://konstantinospolyzos.github.io/gymbro/` in **Safari**.
2. Tap **Share → Add to Home Screen**, then open **GymBro** from its new icon.
3. In the app, choose **OneDrive** (or Google Drive). Do this from the Home Screen icon: the Home Screen app keeps its
   own data, separate from Safari.

---

## Using it

- **Recommended:** don't want to build workouts yourself? **Recommend a week for me** asks how many days you can train
  (2–6) and sets up the week: for 5 days, Monday back, Tuesday chest, Wednesday legs, Thursday shoulders, Friday arms.
  **Recommended workouts** (Plan, or a day's menu) has one for each muscle group: back, chest, shoulders, arms, legs,
  glutes & hamstrings and core, plus push, pull, upper, lower and full body. Each shows its exercises with sets, reps,
  rest, how to do them and why they're there (*Why these exercises* has the research and links). Add one on the days
  you pick, or start it now.
- **Plan:** tap a day to give it a workout (Monday → Back). Tap a workout to change its exercises, sets, reps, colour,
  days and the **rest between sets**. An exercise can have its own rest (tap it in the workout). A new workout can
  start from a recommended one.
- **Rep ranges:** reps can be a range, like 8–12. When every set reaches the top, the next workout adds weight
  (+2.5 kg, or the exercise's own step) and tells you so.
- **Today:** today's workout with **Start workout**.
- **During a workout:** the clock at the top counts the whole workout. The panel at the bottom shows the next set with
  its weight and reps (from last time, and + / − to change them; tap the number to type it). Tap **Set done**: the rest
  starts counting down. In its **last 5 seconds** the screen counts down in big numbers and beeps, then shows **Go!**
  for the next set. **−15 s / +15 s / Skip rest** change the rest. You can also tick sets in the list, tap a set number
  to do that set next, tap the *Last* column to copy last time's set, and add exercises or sets. Each exercise's ⋯
  menu has *How to do it*.
  The arrow at the top left shows the rest of the app; the workout keeps running in the bar above the tabs.
- **Finish:** the summary shows the total time, the volume, and how it went against the last time you did this workout:
  each exercise up or down, and new personal records.
- **History:** a calendar of your gym days and every workout. Tap one to see it, change it or delete it.
  **+** logs a workout you did without the app.
- **Progress:** workouts a week against your goal (and your streak), volume and time per week, sets per muscle group,
  your newest records, and every exercise's best set over time.

## Good to know

- **Signing in again:** Microsoft keeps web apps signed in for 24 hours, then asks again. The app keeps a copy on the
  phone, so you can always train; when the cloud icon turns orange, the first tap (or Done after a workout) opens the
  Microsoft window, which usually closes by itself straight away. With Google Drive it's every hour, as in your other apps.
- **Offline at the gym:** the app opens and works without a connection. Workouts go to OneDrive when you're back online.
- **Beeps and music:** the beeps play over your music without stopping it. They follow the silent switch: on silent you
  only see the countdown. Settings → *Test the beeps*. Keep the app open during the rest: iPhones pause web apps in the
  background, so they can't beep from your pocket.
- **The screen stays on** during a workout (Settings → *Keep the screen on*; iOS 18.4 or later in Home Screen apps).
- **The workout keeps counting** if the screen locks or you close the app: open it again and it's where you left it.
- **Backups:** OneDrive (or Drive) keeps a copy each week next to the file (the last 8), and OneDrive keeps older
  versions of the file itself. Settings → *Save a backup* gives you one file; *Save to Files → OneDrive* works too,
  even without the app registration.
- **Your phone and your computer** can both use the app: changes are merged workout by workout.
- **Updating the app later:** upload the new files to the same repository. Phones pick up the new version the next time
  the app is opened.
- **The Savings Tracker and Glosor live on the same website.** When the Savings Tracker updates, its offline helper
  clears the other apps' saved copies too, so GymBro re-saves its own the next time it's online. If you haven't done
  it for Glosor yet, change one line in the Savings Tracker's `sw.js`:
  `keys.filter((k) => k !== CACHE)` → `keys.filter((k) => k.startsWith("savings-tracker-") && k !== CACHE)`
- **"The folder is called Graph":** OneDrive sometimes names a new app folder `Graph` instead of `GymBro`. It works
  the same; you can rename it in OneDrive.
