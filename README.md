# LabTrack – setup guide

LabTrack is an installable web app (PWA) for Android and Windows. Everything — experiments, chips, chamber photos, storage — is saved **only on the device you use it on**. It works offline.

## 1. Put it online with GitHub Pages (one time, ~5 minutes)

1. Create a free account at <https://github.com> (skip if you have one).
2. Click **+** (top right) → **New repository**.
   - Name: `labtrack` · Visibility: **Public** (required for free Pages) · click **Create repository**.
   - The app files contain no data — your experiments never leave your devices.
3. On the new repository page click **uploading an existing file**.
4. Unzip `labtrack.zip` and drag **all the files and the `icons` folder** into the page (not the zip itself, and not the outer folder). Click **Commit changes**.
5. Go to **Settings → Pages**. Under *Build and deployment* choose **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)** → **Save**.
6. After ~1 minute the address appears at the top of that page, e.g.
   `https://YOUR-USERNAME.github.io/labtrack/`

## 2. Install it

**Android (Chrome)**
Open the address → menu **⋮** → **Add to Home screen** → **Install**. LabTrack now appears as an app.

**Windows (Chrome or Edge)**
Open the address → click the **install icon** at the right end of the address bar (or menu → *Apps* → *Install LabTrack*). It gets its own window and Start-menu entry.

When the camera is used the first time, allow camera access.

## 3. Moving data between phone and PC

Data is not synced automatically.

- **Experiment:** open it → tap the ⬇ **Export** icon (top right) → **Save file**. Copy the `.json` file to the other device (Google Drive, OneDrive, e-mail, USB) → in LabTrack there: **Settings → Import file** (or the ⬆ icon on the Experiments list).
  - If the experiment doesn't exist there yet, it is added.
  - If it exists, the two are **merged**: newer info/chamber changes win, new photos are added; for the same chamber and day the newer photo is kept.
- **Storage (consumables):** **Settings → Export storage**, then import the same way. Items are merged (most recently changed version wins; history is combined).

Tip: exporting is also your backup. Export finished experiments and keep the files in a cloud folder.

## 4. Updating the app

If you receive new app files, upload them to the same GitHub repository (overwrite). Your data is not affected. The app picks up the new version the second time you open it.

## Quick reference

| Where | What |
|---|---|
| Experiments list | Active / Finished / All; **New experiment** numbers automatically (#01, #02…) |
| Experiment page | Title, status, seeding date (→ automatic Day N), protocol, cells harvested, notes. Chips seeded is counted automatically |
| Add chip | Adds one or more chips named A, B, C… (AA after Z), each with chambers 1–3 and a condition/treatment. ✎ to edit or delete a chip |
| Chamber (tap a tile) | Status **OK / Low-density / Failed** (failed asks reason + day), notes, **Take photo** for the selected day (−/+ to change day), timeline. ‹ › jump to previous/next chamber |
| Photos by day | Compare all chambers of one day side by side |
| Photo viewer | Swipe/arrow between photos, change day, delete |
| Storage | Search, category filter, **Low stock** / **Expiring** (≤30 days) filters. − / + ask for a quantity pre-filled with the last one used; removals can be linked to an experiment |
| Item page | All details, minimum for low-stock alert, **Set count** for stocktakes, full history |

Photos are reduced to 1024 px JPEG (~100 KB each).
