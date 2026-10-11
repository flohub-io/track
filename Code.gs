/**
 * TRACK: a free job tracker for Google Sheets, by FloHub.
 * https://github.com/flohub-io/track  ·  MIT License  ·  Provided as-is, no warranty.
 *
 * What this script does:
 *   1. When you change a job's Stage, it writes today's date in "Stage date".
 *   2. Once a day (at the hour you pick), it checks your jobs and emails YOU
 *      a short list of jobs that are stuck:
 *        - Done, but not invoiced for more than 1 day
 *        - Quote sent, no reply for more than 3 days
 *        - Invoiced, unpaid for more than 14 days (and again past 30 days)
 *
 * What it does NOT do:
 *   - It never emails your customers. The email only goes to the Google account
 *     that turned it on.
 *   - It makes no outside web calls and sends your data nowhere. Everything
 *     runs inside your own Google account.
 *   - It only reads and writes the spreadsheet it is attached to.
 */

// ---------------------------------------------------------------------------
// Sheet layout (must match the template)
// ---------------------------------------------------------------------------
var TRACK = {
  JOBS_SHEET: 'Jobs',
  SETTINGS_SHEET: 'Settings',
  HEADER_ROW: 1,
  COLUMNS: ['Job ID', 'Customer', 'Job', 'Stage', 'Stage date', 'Amount', 'Crew', 'Snooze until'],
  STAGES: ['Quote', 'Booked', 'Done', 'Invoiced', 'Paid', 'Lost'],
  CLOSED_STAGES: ['Paid', 'Lost'],
  HANDLER: 'sendMorningEmail',
  DEFAULTS: {
    'Email hour (0-23)': 7,
    'Done, not invoiced: days': 1,
    'Quote, no reply: days': 3,
    'Invoiced, unpaid: days': 14,
    'Invoiced, unpaid (late): days': 30,
    'Email when nothing is stuck (Yes/No)': 'No',
    'Business name (optional)': ''
  }
};

// ---------------------------------------------------------------------------
// Pure logic (no Google services). Tested by test/run-tests.js.
// ---------------------------------------------------------------------------

/** Turns a sheet cell into a yyyy-mm-dd day key, or null. */
function trackDayKey_(value, tz, fmt) {
  if (value === null || value === undefined || value === '') return null;
  var d = value;
  if (!(d instanceof Date)) {
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);          // 2026-10-09
    var u = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);         // 10/9/2026 (US)
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if (u) return u[3] + '-' + ('0' + u[1]).slice(-2) + '-' + ('0' + u[2]).slice(-2);
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return null;
  return fmt(d, tz, 'yyyy-MM-dd');
}

/** Whole calendar days from day key a to day key b (b - a). */
function trackDaysBetween_(a, b) {
  var pa = a.split('-'), pb = b.split('-');
  var ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
  var tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
  return Math.round((tb - ta) / 86400000);
}

function trackNumber_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var n = Number(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : null;
}

function trackNormStage_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  for (var i = 0; i < TRACK.STAGES.length; i++) {
    if (TRACK.STAGES[i].toLowerCase() === s) return TRACK.STAGES[i];
  }
  return s ? null : '';   // null = unknown stage text, '' = empty
}

/** Reads the Settings rows ([[label, value], ...]) over the defaults. */
function trackParseSettings_(rows) {
  var out = {};
  for (var k in TRACK.DEFAULTS) out[k] = TRACK.DEFAULTS[k];
  (rows || []).forEach(function (r) {
    var key = String(r[0] || '').trim();
    if (!(key in TRACK.DEFAULTS)) return;
    var val = r[1];
    if (typeof TRACK.DEFAULTS[key] === 'number') {
      var n = trackNumber_(val);
      if (n !== null && n >= 0) out[key] = Math.floor(n);
    } else if (val !== '' && val !== null && val !== undefined) {
      out[key] = String(val).trim();
    }
  });
  if (out['Email hour (0-23)'] > 23) out['Email hour (0-23)'] = TRACK.DEFAULTS['Email hour (0-23)'];
  return out;
}

/**
 * Finds stuck jobs.
 * rows: data rows (no header) in TRACK.COLUMNS order.
 * todayKey: yyyy-mm-dd in the sheet's time zone.
 * Returns { items: [...], needsDate: [...], unknownStage: [...], openCount }.
 * "More than N days" means days > N.
 */
function trackFindStuck_(rows, settings, todayKey, tz, fmt) {
  var doneDays = settings['Done, not invoiced: days'];
  var quoteDays = settings['Quote, no reply: days'];
  var unpaidDays = settings['Invoiced, unpaid: days'];
  var lateDays = settings['Invoiced, unpaid (late): days'];
  var res = { items: [], needsDate: [], unknownStage: [], openCount: 0 };

  rows.forEach(function (r, i) {
    var rowNum = i + 2;
    var job = {
      row: rowNum,
      id: String(r[0] || '').trim(),
      customer: String(r[1] || '').trim(),
      job: String(r[2] || '').trim(),
      amount: trackNumber_(r[5]),
      crew: String(r[6] || '').trim()
    };
    var blank = !job.id && !job.customer && !job.job && (r[3] === '' || r[3] === null || r[3] === undefined);
    if (blank) return;

    var stage = trackNormStage_(r[3]);
    if (stage === null) { res.unknownStage.push(job); return; }
    if (stage === '' || TRACK.CLOSED_STAGES.indexOf(stage) >= 0) return;
    res.openCount++;

    var snoozeKey = trackDayKey_(r[7], tz, fmt);
    if (snoozeKey && trackDaysBetween_(todayKey, snoozeKey) >= 0) return;   // snoozed through today

    var stageKey = trackDayKey_(r[4], tz, fmt);
    if (!stageKey) {
      if (stage === 'Done' || stage === 'Quote' || stage === 'Invoiced') res.needsDate.push(job);
      return;
    }
    var days = trackDaysBetween_(stageKey, todayKey);
    job.stage = stage;
    job.days = days;

    if (stage === 'Done' && days > doneDays) {
      job.rule = 'done_not_invoiced'; job.rank = 1; job.label = 'Done, not invoiced';
    } else if (stage === 'Invoiced' && days > lateDays) {
      job.rule = 'unpaid_late'; job.rank = 2; job.label = 'Invoiced, unpaid ' + lateDays + '+ days';
    } else if (stage === 'Invoiced' && days > unpaidDays) {
      job.rule = 'unpaid'; job.rank = 3; job.label = 'Invoiced, unpaid ' + unpaidDays + '+ days';
    } else if (stage === 'Quote' && days > quoteDays) {
      job.rule = 'quote_no_reply'; job.rank = 4; job.label = 'Quote, no reply';
    } else {
      return;
    }
    res.items.push(job);
  });

  res.items.sort(function (a, b) { return a.rank - b.rank || b.days - a.days || a.row - b.row; });
  return res;
}

function trackMoney_(n) {
  var s = Math.round(n * 100) / 100;
  var parts = s.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + (parts[1] === '00' ? parts[0] : parts.join('.'));
}

function trackJobName_(j) {
  var name = [j.customer, j.job].filter(Boolean).join(' – ');
  return name || (j.id ? 'Job ' + j.id : 'Row ' + j.row);
}

/** Builds the email. Returns null when there is nothing to send. */
function trackBuildEmail_(res, settings, sheetUrl) {
  var n = res.items.length;
  var biz = settings['Business name (optional)'];
  var sendEmpty = String(settings['Email when nothing is stuck (Yes/No)']).toLowerCase().indexOf('y') === 0;
  var extras = res.needsDate.length + res.unknownStage.length;
  if (n === 0 && extras === 0 && !sendEmpty) return null;

  var subject = n === 0
    ? 'TRACK: no stuck jobs today'
    : 'TRACK: ' + n + (n === 1 ? ' job needs' : ' jobs need') + ' you today';
  if (biz) subject += ' (' + biz + ')';

  var lines = [];
  var groups = [
    ['done_not_invoiced', 'DONE, NOT INVOICED (more than ' + settings['Done, not invoiced: days'] + ' day' + (settings['Done, not invoiced: days'] === 1 ? '' : 's') + ')'],
    ['unpaid_late', 'INVOICED, UNPAID (more than ' + settings['Invoiced, unpaid (late): days'] + ' days)'],
    ['unpaid', 'INVOICED, UNPAID (more than ' + settings['Invoiced, unpaid: days'] + ' days)'],
    ['quote_no_reply', 'QUOTE, NO REPLY (more than ' + settings['Quote, no reply: days'] + ' days)']
  ];
  var total = 0, withAmount = 0;
  if (n === 0) lines.push('Nothing is stuck past your limits today. ' + res.openCount + ' open job' + (res.openCount === 1 ? '' : 's') + ' on your sheet.');
  groups.forEach(function (g) {
    var items = res.items.filter(function (j) { return j.rule === g[0]; });
    if (!items.length) return;
    lines.push('');
    lines.push(g[1]);
    items.forEach(function (j) {
      var amt = j.amount !== null ? ' · ' + trackMoney_(j.amount) : '';
      if (j.amount !== null) { total += j.amount; withAmount++; }
      var crew = j.crew ? ' · ' + j.crew : '';
      var verb = { Done: 'done', Quote: 'quoted', Invoiced: 'invoiced' }[j.stage] || j.stage.toLowerCase();
      lines.push('- ' + trackJobName_(j) + ': ' + verb + ' ' + j.days + ' day' + (j.days === 1 ? '' : 's') + ' ago' + amt + crew + ' (row ' + j.row + ')');
    });
  });
  if (withAmount > 0) {
    lines.push('');
    lines.push('Value on your sheet for these jobs: ' + trackMoney_(total) +
      (withAmount < n ? ' (' + withAmount + ' of ' + n + ' have an amount)' : ''));
  }
  if (res.needsDate.length) {
    lines.push('');
    lines.push('CHECK THESE ROWS: no stage date, so TRACK can\'t tell how long they\'ve waited');
    res.needsDate.forEach(function (j) { lines.push('- ' + trackJobName_(j) + ' (row ' + j.row + ')'); });
  }
  if (res.unknownStage.length) {
    lines.push('');
    lines.push('CHECK THESE ROWS: the Stage isn\'t one of ' + TRACK.STAGES.join(', '));
    res.unknownStage.forEach(function (j) { lines.push('- ' + trackJobName_(j) + ' (row ' + j.row + ')'); });
  }
  lines.push('');
  if (sheetUrl) lines.push('Open your sheet: ' + sheetUrl);
  lines.push('To snooze a job, put a date in its "Snooze until" column. Change the limits on the Settings tab.');
  lines.push('');
  lines.push('This email was sent by the TRACK script in your own Google Sheet, only to you. Turn it off from the TRACK menu.');

  return { subject: subject, body: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Google Sheets glue
// ---------------------------------------------------------------------------

function trackTz_() {
  return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

function trackFmt_(d, tz, pattern) { return Utilities.formatDate(d, tz, pattern); }

function trackReadSettings_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TRACK.SETTINGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return trackParseSettings_([]);
  return trackParseSettings_(sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues());
}

function trackReadJobs_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TRACK.JOBS_SHEET);
  if (!sh) throw new Error('TRACK: no tab called "' + TRACK.JOBS_SHEET + '". Rename your jobs tab to "Jobs".');
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, TRACK.COLUMNS.length).getValues();
}

/** Builds today's check without sending. */
function trackRunCheck_() {
  var tz = trackTz_();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var settings = trackReadSettings_();
  var res = trackFindStuck_(trackReadJobs_(), settings, todayKey, tz, trackFmt_);
  var email = trackBuildEmail_(res, settings, SpreadsheetApp.getActive().getUrl());
  return { res: res, email: email };
}

/** The daily email. Runs from the time trigger. Sends only to you. */
function sendMorningEmail() {
  var out = trackRunCheck_();
  if (!out.email) return;
  var me = Session.getEffectiveUser().getEmail();
  if (!me) throw new Error('TRACK: could not read your own email address, so nothing was sent.');
  MailApp.sendEmail(me, out.email.subject, out.email.body, { name: 'TRACK (your sheet)' });
}

/** Menu: send today's email now (even if nothing is stuck). */
function trackSendTestEmail() {
  var out = trackRunCheck_();
  var email = out.email || trackBuildEmail_(out.res, (function () {
    var s = trackReadSettings_(); s['Email when nothing is stuck (Yes/No)'] = 'Yes'; return s;
  })(), SpreadsheetApp.getActive().getUrl());
  var me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, '[Test] ' + email.subject, email.body, { name: 'TRACK (your sheet)' });
  SpreadsheetApp.getUi().alert('Test email sent to ' + me + '. Check your inbox (and spam, the first time).');
}

/** Menu: turn on the daily email at the hour on the Settings tab. */
function trackTurnOnEmail() {
  trackRemoveTriggers_();
  var hour = trackReadSettings_()['Email hour (0-23)'];
  ScriptApp.newTrigger(TRACK.HANDLER).timeBased().everyDays(1).atHour(hour).inTimezone(trackTz_()).create();
  SpreadsheetApp.getUi().alert('Morning email is ON. It arrives once a day between ' + hour + ':00 and ' +
    ((hour + 1) % 24) + ':00 (' + trackTz_() + '), only to ' + Session.getEffectiveUser().getEmail() + '.');
}

/** Menu: turn the daily email off. */
function trackTurnOffEmail() {
  var n = trackRemoveTriggers_();
  SpreadsheetApp.getUi().alert(n ? 'Morning email is OFF.' : 'The morning email was already off.');
}

function trackRemoveTriggers_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRACK.HANDLER) { ScriptApp.deleteTrigger(t); n++; }
  });
  return n;
}

/** Simple trigger: adds the TRACK menu. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('TRACK')
    .addItem('Turn on morning email', 'trackTurnOnEmail')
    .addItem('Send me a test email now', 'trackSendTestEmail')
    .addSeparator()
    .addItem('Turn off morning email', 'trackTurnOffEmail')
    .addToUi();
}

/** Simple trigger: stamps "Stage date" when "Stage" changes on the Jobs tab. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== TRACK.JOBS_SHEET) return;
  var stageCol = TRACK.COLUMNS.indexOf('Stage') + 1;
  var dateCol = TRACK.COLUMNS.indexOf('Stage date') + 1;
  var r0 = e.range.getRow(), c0 = e.range.getColumn();
  var nr = e.range.getNumRows(), nc = e.range.getNumColumns();
  if (stageCol < c0 || stageCol > c0 + nc - 1) return;
  var today = new Date();
  for (var r = Math.max(r0, TRACK.HEADER_ROW + 1); r < r0 + nr; r++) {
    var stage = sh.getRange(r, stageCol).getValue();
    if (stage === '' || stage === null) continue;
    sh.getRange(r, dateCol).setValue(today);
  }
}

// Node test export (ignored by Apps Script).
if (typeof module !== 'undefined') {
  module.exports = {
    TRACK: TRACK, trackDayKey_: trackDayKey_, trackDaysBetween_: trackDaysBetween_,
    trackParseSettings_: trackParseSettings_, trackFindStuck_: trackFindStuck_,
    trackBuildEmail_: trackBuildEmail_, trackMoney_: trackMoney_,
    sendMorningEmail: sendMorningEmail, onEdit: onEdit, onOpen: onOpen,
    trackTurnOnEmail: trackTurnOnEmail, trackTurnOffEmail: trackTurnOffEmail, trackSendTestEmail: trackSendTestEmail
  };
}
