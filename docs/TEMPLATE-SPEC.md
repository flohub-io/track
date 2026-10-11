# TRACK template spec (the "Make a copy" sheet)

The public **Make a copy** link must point to a Google Sheet built exactly like this, **with the script already attached**, so people who copy it get the script too (Google copies a sheet's attached script along with it).

**Owner:** a FloHub Google account, not a personal one. Sharing: **Anyone with the link → Viewer**. Link format: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/copy`. Replace `MAKE_A_COPY_LINK` in README.md with it.

## Tab `Jobs` (header row frozen)
| Col | Header | Format | Notes |
|---|---|---|---|
| A | Job ID | plain text | any short number or code |
| B | Customer | plain text | first name or business name only |
| C | Job | plain text | short label |
| D | Stage | dropdown: Quote, Booked, Done, Invoiced, Paid, Lost (reject other input) | rows 2–1000 |
| E | Stage date | date `yyyy-mm-dd` | stamped by `onEdit` when D changes |
| F | Amount | currency `$#,##0.00` | optional |
| G | Crew | plain text | optional |
| H | Snooze until | date `yyyy-mm-dd` | optional; the job is skipped through this date |

Column order matters: `Code.gs` reads columns A–H by position (`TRACK.COLUMNS`).
Example rows: the 5 rows in `template/track-jobs.csv`; each Customer starts with "Example:". Before sharing the master, **move the example dates into the last 2 weeks** so the test email shows flagged jobs.

## Tab `Settings` (A = label, B = value, C = help)
Exactly the rows in `template/track-settings.csv`. The labels must match `TRACK.DEFAULTS` in `Code.gs`. Unknown labels are ignored, and missing ones use the defaults. B7 has a Yes/No dropdown.

## Tab `How to use`
The 11 lines from `TRACK-template.xlsx`, as plain text.

## Spreadsheet settings
- Time zone: leave the master's zone as is. People who copy it are told to set their own (SETUP.md step 1.5). The script reads the **spreadsheet's** time zone and creates its trigger in that zone.
- Locale: United States. A typed date like `10/1/2026` is read in US order; `yyyy-mm-dd` always works.

## Attached script
- `Code.gs` and `appsscript.json` from this repo, unchanged. Project name **TRACK**.
- **No triggers installed on the master.** Each person turns on their own from the menu.
- No library, no add-on, no Cloud project changes, no UrlFetch.

## Before publishing the link
1. Copy the master from a second clean account. Check the menu appears, turn the email on, confirm the test email arrives and the permission list matches the README.
2. Confirm the copy holds no data from the master's owner (version history isn't copied).
