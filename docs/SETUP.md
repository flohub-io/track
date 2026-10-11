# Build TRACK yourself (Option B)

About 10 minutes. You need a Google account and a computer (the Apps Script editor doesn't work well on phones).

> 📸 Lines marked **[SCREENSHOT n]** are shots to capture for this guide before it goes public. The list is at the bottom.

## 1. Put the template in Google Sheets
1. Download `template/TRACK-template.xlsx` from this repo (click the file, then the download button).
2. Go to [sheets.google.com](https://sheets.google.com) → **Blank spreadsheet**.
3. **File → Import → Upload**, then choose the file. Pick **Replace spreadsheet** → **Import data**. **[SCREENSHOT 1]**
4. Check that you have 3 tabs at the bottom: **Jobs**, **Settings**, **How to use**. The tab names must stay exactly like this. **[SCREENSHOT 2]**
5. **File → Settings → Time zone**: set your local time zone. The morning email and the "days waiting" count use it. **[SCREENSHOT 3]**
6. Check the **Stage** column has a dropdown. If it doesn't: select column D from row 2 down, then **Data → Data validation → Add rule → Dropdown**, and add Quote, Booked, Done, Invoiced, Paid, Lost.

*(No Excel file? You can import `template/track-jobs.csv` into a tab named **Jobs** and `template/track-settings.csv` into a tab named **Settings** instead.)*

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**. A new tab opens. **[SCREENSHOT 4]**
2. Delete whatever is in `Code.gs`, paste in the whole of this repo's [`Code.gs`](../Code.gs), and click the 💾 save icon.
3. Click ⚙️ **Project Settings** (left side) and tick **Show "appsscript.json" manifest file in editor**. **[SCREENSHOT 5]**
4. Back in the editor (`<>` icon), open `appsscript.json`, replace everything with this repo's [`appsscript.json`](../appsscript.json), and save. This keeps the script's permissions as small as possible.
5. Rename the project (top left, "Untitled project") to **TRACK**.

## 3. Turn it on
1. Go back to your sheet tab and reload the page. After a few seconds a **TRACK** menu appears. **[SCREENSHOT 6]**
2. Click **TRACK → Turn on morning email.**
3. Google asks for permission: **Continue** → choose your account → **"Google hasn't verified this app"** → **Advanced** → **Go to TRACK (unsafe)** → read the list → **Allow**. **[SCREENSHOT 7, 8, 9]** (Why this appears, and what each permission does, is in the README.)
4. You may need to click **TRACK → Turn on morning email** once more after allowing. A box confirms "Morning email is ON". **[SCREENSHOT 10]**
5. Click **TRACK → Send me a test email now.** Check your inbox (and your spam folder the first time). **[SCREENSHOT 11]**

## 4. Try it
- Change a job's Stage. The **Stage date** fills with today's date. **[SCREENSHOT 12]**
- Type a date a few days ago into a **Done** job's Stage date, then send a test email. It should list that job.

## Troubleshooting
- **No TRACK menu:** reload the sheet. Check the script is saved and attached to this sheet (opened from Extensions → Apps Script).
- **"No tab called Jobs":** rename your jobs tab to exactly `Jobs`.
- **Stage date didn't fill:** it only fills when you edit the **Stage** column directly. Pasted or imported rows need the date typed in.
- **Email arrives at the wrong hour:** check File → Settings → Time zone, then click TRACK → Turn on morning email again.
- **Stop everything:** click TRACK → Turn off morning email, and/or remove access at myaccount.google.com/permissions.

---

## Screenshots to capture (before publishing)
Capture each one in a clean test Google account with no real customer data, at 1280px wide. Crop out or blur the account email and avatar.

| # | Screen | Notes |
|---|---|---|
| 1 | File → Import → Upload dialog with "Replace spreadsheet" selected | |
| 2 | The 3 tabs (Jobs / Settings / How to use) with the example rows | show the Stage dropdown open |
| 3 | File → Settings → Time zone | |
| 4 | Extensions → Apps Script menu | |
| 5 | Project Settings with "Show appsscript.json" ticked | |
| 6 | The TRACK menu open in the sheet | |
| 7 | "Authorization required" → Continue | |
| 8 | "Google hasn't verified this app" with **Advanced** expanded | don't crop the warning; show it honestly |
| 9 | The permission list → Allow | must match the 5 permissions in the README; update the README if Google's wording differs |
| 10 | "Morning email is ON" pop-up | |
| 11 | The test email in Gmail | example rows only |
| 12 | A Stage change with the date filled in automatically | |
