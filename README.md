# TRACK: a free job tracker for Google Sheets

**See which jobs are stuck before they slip.** TRACK is a simple Google Sheet for service businesses: plumbers, electricians, cleaners, landscapers, HVAC, handymen, and anyone who quotes, does the job, then invoices. Every morning it emails you a short list of the jobs that are stuck.

Free. No signup. Runs in your own Google account. A FloHub guide.

---

## What it does

Each job moves through 5 stages:

**Quote → Booked → Done → Invoiced → Paid** (use **Lost** for quotes that went nowhere)

When you change a job's stage, the sheet writes today's date next to it. Once a day, TRACK checks your jobs and emails **you** a list like this:

```
Subject: TRACK: 3 jobs need you today

DONE, NOT INVOICED (more than 1 day)
- Lee – Panel swap: done 2 days ago · $1,200 · Ana (row 2)

INVOICED, UNPAID (more than 30 days)
- Brown – Gutter: invoiced 31 days ago · $1,250.50 (row 4)

QUOTE, NO REPLY (more than 3 days)
- Kim – Deck: quoted 4 days ago (row 3)

Value on your sheet for these jobs: $2,450.50 (2 of 3 have an amount)
```
*(Example with made-up jobs. Your email lists jobs from your own sheet.)*

### The stuck-job rules

| A job is flagged when it's… | Default limit | Change it on |
|---|---|---|
| **Done, but not invoiced** | more than **1 day** | Settings tab |
| **Quoted, no reply** | more than **3 days** | Settings tab |
| **Invoiced, but unpaid** | more than **14 days** | Settings tab |
| **Invoiced, unpaid, late** | more than **30 days** | Settings tab |

"Booked", "Paid" and "Lost" jobs are never flagged. To quiet one job, put a date in its **Snooze until** column.

---

## Set it up (about 10 minutes)

### Option A: make a copy (easiest)
1. Open the template, **[Make a copy of TRACK](https://docs.google.com/spreadsheets/d/1gWjfnLYyA0tZdqGNxgp2NkI1RvrmCFDjK-4bZ-FtkRY/copy)**, and click **Make a copy**. You need to be signed in to a Google account.
   Your copy, and the script in it, belongs to you. We can't see your copy or your data, and changes we make later won't reach it. To update, make a fresh copy.
2. In your copy, delete the 5 example rows (they start with "Example:").
3. Reload the page. A **TRACK** menu appears at the top, next to Help.
4. Click **TRACK → Turn on morning email**. Google asks for permission the first time (see "The Google permission screen" below).

   **Want pictures?** The **[illustrated setup guide](docs/SETUP.md)** shows every screen, step by step.
5. Click **TRACK → Send me a test email now** to check it works.

That's it. You get one email a day at the hour on the Settings tab (7 AM by default), only on days something is stuck.

### Option B: build it yourself from this repo
Want to see every piece? Follow the **[illustrated setup guide (docs/SETUP.md)](docs/SETUP.md#option-b-build-it-yourself-from-this-repo)**: import `template/TRACK-template.xlsx` into Google Sheets, then paste in `Code.gs` and `appsscript.json`.

---

## Using it day to day
- **One row per job:** Job ID, Customer, Job, Stage, Amount (optional), Crew (optional).
- **Customer = first name or business name only.** Don't put phone numbers, addresses, card details or private notes in this sheet. It doesn't need them.
- Keep the Job column to the work itself (e.g. 'panel swap'), not health, family or other personal details about the customer. The sheet is yours, and so is the data in it.
- **Move the stage when the job moves.** The date fills in by itself. If you paste in old jobs, type the stage date yourself (for example 2026-10-01).
- **Change the limits** on the **Settings** tab, for example 7 days for quotes.
- **Turn the email off** anytime: **TRACK → Turn off morning email**.

---

## What the script can and can't do (permissions, in plain words)

When you turn on the email, Google asks you to approve these permissions. Here's what each one is for:

| Google says | Where you see it | What TRACK uses it for |
|---|---|---|
| *Email address* ("Google will allow TRACK to access this info about you") | **Sign in to TRACK** screen | Know which address to send the email to (yours). |
| *View and manage spreadsheets that this application has been installed in.* | **TRACK wants access** screen | Read your jobs and write the stage date, in **this one spreadsheet only**, not your other files. |
| *Send email as you.* | **TRACK wants access** screen | Send the morning email **to you only**. It never emails your customers or anyone else. |
| *Allow this application to run when you are not present.* | **TRACK wants access** screen | Run the check once a day at your chosen hour. |
| *Display and run third-party web content in prompts and sidebars inside Google applications.* | **TRACK wants access** screen | Show the TRACK menu and its pop-up messages in your sheet. TRACK shows no outside web content. |

**What it doesn't do:** it doesn't read your Gmail or Google Drive, it doesn't touch other spreadsheets, and it makes **no outside web calls**. **It runs entirely in your own Google account, and we (FloHub) receive nothing**: no data, no analytics, no tracking. You can read every line in [`Code.gs`](Code.gs).

### The Google permission screen
The first time you click **TRACK → Turn on morning email**, Google shows these screens (pictures of each one are in the **[illustrated setup guide](docs/SETUP.md#3-turn-on-the-morning-email)**):

1. **Authorization required**: "A script attached to this document needs your permission to run." Click **OK**.
2. **Sign in to TRACK**: choose your Google account. Google says it "will allow TRACK to access this info about you" and lists your **Email address**. Click **Continue**.
3. **TRACK wants access to your Google Account**: "Select what TRACK can access" lists the four permissions in the table above, each with a tick box (or use **Select all**). Below them is a **"Make sure you trust TRACK"** panel. TRACK is a script in your own copy, not a published app, so Google notes it has no links to a privacy policy or terms of service. Leave all four ticked and click **Continue**.
4. A box confirms **"Morning email is ON"**, with the hour, your sheet's time zone and your own email address.

Only continue if you're comfortable with the permissions listed above. You can remove access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

Sometimes Google also shows a **"Google hasn't verified this app"** warning before the permission list. It didn't appear in our test, but it can, because this is a personal script rather than an app Google has reviewed. If you see it, click **Advanced → Go to TRACK (unsafe)** to reach the same permission list.

---

## Limits
- It works in **one spreadsheet**, the one you copied. Each copy is separate.
- **One email a day**, sent to the Google account that turned it on. Google limits how many emails a script can send each day (about 100 for personal accounts), and TRACK sends one.
- It checks **once a day**, not the moment a job gets stuck.
- It doesn't send invoices or chase customers. It tells **you**, and you decide.
- Built for a few hundred to a few thousand rows.

---

## More free FloHub guides
- **The boring ops kit** (18 pages: booking, reminders, invoices, reviews): [https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/boring-ops-kit/v1/index.html](https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/boring-ops-kit/v1/index.html)
- **The handover sheet** (what to write down before you're away): [https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/handover-sheet/v1/index.html](https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/handover-sheet/v1/index.html)
- **The Monday ops review** (a 30-minute weekly check-in): [https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/monday-ops-review/v1/index.html](https://pub-52f57d0849844c9d9ec5508a77234c80.r2.dev/kits/monday-ops-review/v1/index.html)

---

## License and the fine print
- **Script** (`Code.gs`, `appsscript.json`, `test/`): [MIT License](LICENSE).
- **Sheet template and guides** (`template/`, `docs/`, this README): [CC BY 4.0](LICENSE-CONTENT). Share and adapt them, with credit to FloHub.
- Provided **as-is, with no warranty**. TRACK is a reminder tool, **not legal, tax or accounting advice**. You're responsible for your own invoices and records.
- Google and Google Sheets are trademarks of Google LLC. TRACK isn't made, endorsed or verified by Google.
- FloHub is run by **ELRITO Holdings LLC**.
