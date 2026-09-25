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

- **Experiment / cell expansion:** open it → tap the ⬇ **Export** icon (top right) → **Save file**. Copy the `.json` file to the other device (Google Drive, OneDrive, e-mail, USB) → in LabTrack there: **Settings → Import file** (or the ⬆ icon on the Experiments list).
  - If the experiment doesn't exist there yet, it is added.
  - If it exists, the two are **merged**: newer info/chamber changes win, new photos are added; for the same chamber and day the newer photo is kept.
- **Storage (consumables):** **Settings → Export storage**, then import the same way. Items are merged (most recently changed version wins; history is combined).

Tip: exporting is also your backup. Export finished experiments and keep the files in a cloud folder.

## 4. Updating the app

If you receive new app files, upload **all** of them to the same GitHub repository (overwrite). Your data is not affected.

GitHub Pages can take a few minutes to publish. After that, when you open LabTrack (or bring it back to the foreground) a bar appears: **"A new version of LabTrack is available – Update"**. Tap **Update** and the app reloads with the new version. If you tap ×, the update is installed the next time the app is fully closed and reopened. You can also use **Settings → Check for updates**, and see the installed version there.

## Quick reference

| Where | What |
|---|---|
| Experiments list | Active / Finished / All; **New experiment** numbers automatically (#01, #02…) and asks for the **Model** (8 defaults, or *+ New model…*) |
| Experiment page | Title, status, seeding date (→ automatic Day N), protocol, notes, **cell count** (dilution factor + any number of counts → total = average × dilution factor × 10⁴). Chips seeded is counted automatically |
| Conditions | List of conditions for the experiment; each chip is assigned one. For **Lung-COPD** each condition has CSE yes/no and one or more drugs |
| Drugs (COPD) | Name + dilution as ratio 1:X or stock → final concentration (M…pM, mg/mL…ng/mL, %, ×) |
| Add chip | Adds one or more chips named A, B, C… (AA after Z), each with chambers 1–3 and a condition. ✎ to edit or delete a chip |
| Medium change (COPD) | Enter CSE absorbance → CSE fraction = 0.07 / absorbance. Per condition (chips × 1 mL, editable) shows CSE, each drug (from its dilution) and base medium (the rest), plus the base-medium recipe scaled to the volume needed. Chips whose 3 chambers all failed are excluded by default |
| Staining | Chambers to stain (default = non-failed chambers), 100 µL each (+ optional extra %). Calculates blocking (Goat Serum 5 %, Tween-20 0.1 %, PBS), primary and secondary solutions (Goat Serum 0.5 %, up to 3 antibodies from Storage category *Antibodies*, PBS). Can deduct antibody volumes from Storage (items with unit µL or mL). Imaging table (405/477/545/637 nm: marker, laser %, exposure ms) can be filled later |
| Cell expansion (tab) | **New expansion**: cell type, lot, cells in vial, seeding efficiency %, viability %, number of flasks, flask type, starting passage, seeding date/time. Each flask has daily photos (Day = days since that passage was seeded) |
| Split / passage | Harvest date/time, total harvested, frozen, used (0), thrown away (0), optional viability at harvest, number of new flasks. Remaining cells are split equally (editable per flask – must add up). 0 flasks finishes the expansion. **Undo last split** available |
| Expansion statistics | Per passage and overall, **raw** and **corrected**: N₀, fold expansion, population doublings, doubling time (h), growth rate μ (/day), cumulative PD, mean DT, seeding/harvest density (cells/cm²), theoretical yield, totals frozen/used/discarded. Corrected N₀ = seeded × seeding efficiency × viability (vial viability for the first passage, viability at harvest for later ones, if entered) |
| Chamber (tap a tile) | Status **OK / Low-density / Failed** (failed asks reason + day), notes, **Take photo** for the selected day (−/+ to change day), timeline. ‹ › jump to previous/next chamber |
| Photos by day | Compare all chambers of one day side by side |
| Photo viewer | Swipe/arrow between photos, change day, delete |
| Storage | Search, category filter, **Low stock** / **Expiring** (≤30 days) filters. − / + ask for a quantity pre-filled with the last one used; removals can be linked to an experiment |
| Item page | All details, minimum for low-stock alert, **Set count** for stocktakes, full history |

Photos are reduced to 1024 px JPEG (~100 KB each).
