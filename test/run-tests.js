// Node harness for Code.gs: mocks SpreadsheetApp, Session, MailApp, ScriptApp, Utilities.
// Run: node test/run-tests.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

function fmtDate(d, tz, pattern) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).map(x => [x.type, x.value]));
  if (pattern !== 'yyyy-MM-dd') throw new Error('mock only supports yyyy-MM-dd');
  return `${p.year}-${p.month}-${p.day}`;
}

function makeEnv({ jobs, settings, tz = 'America/Los_Angeles', now, me = 'owner@example.com' }) {
  const sent = [], triggers = [], alerts = [];
  const RealDate = Date;
  const FakeDate = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return new RealDate(now).getTime(); } };
  function sheet(name, rows) {
    return {
      rows, getName: () => name,
      getLastRow: () => rows.length,
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValues: () => rows.slice(r - 1, r - 1 + nr).map(row => { const o = row.slice(c - 1, c - 1 + nc); while (o.length < nc) o.push(''); return o; }),
          getValue: () => (rows[r - 1] || [])[c - 1],
          setValue: v => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
          getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc, getSheet: () => sheets[name]
        };
      }
    };
  }
  const sheets = {
    Jobs: sheet('Jobs', [['Job ID', 'Customer', 'Job', 'Stage', 'Stage date', 'Amount', 'Crew', 'Snooze until'], ...jobs]),
    Settings: sheet('Settings', [['Setting', 'Value'], ...(settings || [])])
  };
  const ctx = {
    Date: FakeDate, Intl, Math, JSON, String, Number, isNaN, isFinite, Error, console,
    SpreadsheetApp: {
      getActive: () => ({ getSheetByName: n => sheets[n] || null, getSpreadsheetTimeZone: () => tz, getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST' }),
      getUi: () => ({ alert: m => alerts.push(m), createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => { alerts.push('menu'); } }; return m; } })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => me }), getScriptTimeZone: () => tz },
    MailApp: { sendEmail: (to, subject, body, opts) => sent.push({ to, subject, body, opts }) },
    Utilities: { formatDate: fmtDate },
    ScriptApp: {
      newTrigger: h => { const t = { h }; const b = { timeBased: () => b, everyDays: n => (t.every = n, b), atHour: x => (t.hour = x, b), inTimezone: z => (t.tz = z, b), create: () => { const tr = { getHandlerFunction: () => h, ...t }; triggers.push(tr); return tr; } }; return b; },
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1)
    }
  };
  // Forbidden services: any use fails the test (the FloHub version must make no outside calls).
  for (const name of ['UrlFetchApp', 'GmailApp', 'DriveApp', 'PropertiesService']) {
    Object.defineProperty(ctx, name, { get() { throw new Error(`Code.gs used forbidden service ${name}`); } });
  }
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  return { ctx, sent, triggers, alerts, sheets };
}

// "Today" = Fri 2026-10-09 07:05 PT
const NOW = '2026-10-09T14:05:00Z';
const d = s => new Date(s + 'T12:00:00Z'); // noon UTC → same calendar day in PT

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { console.log('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } }

test('stuck rules at the exact boundaries (more than N days)', () => {
  const jobs = [
    ['J1', 'Smith', 'Water heater', 'Done', d('2026-10-08'), 450, '', ''],     // 1 day  → not stuck (needs >1)
    ['J2', 'Lee', 'Panel swap', 'Done', d('2026-10-07'), 1200, 'Ana', ''],     // 2 days → stuck
    ['J3', 'Lopez', 'Quote: fence', 'Quote', d('2026-10-06'), '', '', ''],     // 3 days → not stuck
    ['J4', 'Kim', 'Quote: deck', 'Quote', d('2026-10-05'), '', '', ''],        // 4 days → stuck
    ['J5', 'Patel', 'Rewire', 'Invoiced', d('2026-09-25'), 900, '', ''],       // 14 days → not stuck
    ['J6', 'Nguyen', 'Drain', 'Invoiced', d('2026-09-24'), 300, '', ''],       // 15 → unpaid
    ['J7', 'Ortiz', 'Roof', 'Invoiced', d('2026-09-09'), 5000, '', ''],        // 30 → unpaid (not late)
    ['J8', 'Brown', 'Gutter', 'Invoiced', d('2026-09-08'), 250, '', ''],       // 31 → late
    ['J9', 'Gray', 'Tile', 'Booked', d('2026-09-01'), 800, '', ''],            // booked → never flagged
    ['J10', 'White', 'AC', 'Paid', d('2026-08-01'), 700, '', ''],              // closed
    ['J11', 'Black', 'Old quote', 'Lost', d('2026-08-01'), '', '', '']         // closed
  ];
  const { ctx } = makeEnv({ jobs, now: NOW });
  const s = ctx.trackParseSettings_([]);
  const res = ctx.trackFindStuck_(ctx.trackReadJobs_(), s, '2026-10-09', 'America/Los_Angeles', ctx.trackFmt_);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res.items.map(j => j.id + ':' + j.rule))),
    ['J2:done_not_invoiced', 'J8:unpaid_late', 'J7:unpaid', 'J6:unpaid', 'J4:quote_no_reply']);
  assert.strictEqual(res.openCount, 9);
});

test('settings override defaults; bad values fall back', () => {
  const { ctx } = makeEnv({ jobs: [], now: NOW });
  const s = ctx.trackParseSettings_([['Quote, no reply: days', 7], ['Done, not invoiced: days', 'abc'], ['Email hour (0-23)', 40], ['Unknown', 5]]);
  assert.strictEqual(s['Quote, no reply: days'], 7);
  assert.strictEqual(s['Done, not invoiced: days'], 1);
  assert.strictEqual(s['Email hour (0-23)'], 7);
});

test('snooze, missing dates, unknown stages, case-insensitive stages, text dates', () => {
  const jobs = [
    ['A', 'Snoozed', 'x', 'Done', d('2026-10-01'), '', '', d('2026-10-09')],  // snoozed through today
    ['B', 'Snooze over', 'x', 'Done', d('2026-10-01'), '', '', d('2026-10-08')],// snooze ended → stuck
    ['C', 'No date', 'x', 'Invoiced', '', '', '', ''],
    ['D', 'Typo', 'x', 'Invoced', d('2026-10-01'), '', '', ''],
    ['E', 'lower', 'x', 'done', '2026-10-01', '', '', ''],                     // text ISO date
    ['F', 'US date', 'x', 'QUOTE', '10/1/2026', '', '', ''],                   // text US date
    ['', '', '', '', '', '', '', '']                                            // blank row ignored
  ];
  const { ctx } = makeEnv({ jobs, now: NOW });
  const res = ctx.trackFindStuck_(ctx.trackReadJobs_(), ctx.trackParseSettings_([]), '2026-10-09', 'America/Los_Angeles', ctx.trackFmt_);
  assert.deepStrictEqual([...res.items.map(j => j.id)].sort(), ['B', 'E', 'F']);
  assert.deepStrictEqual([...res.needsDate.map(j => j.id)], ['C']);
  assert.deepStrictEqual([...res.unknownStage.map(j => j.id)], ['D']);
});

test('timezone: a late-evening PT date stays on the PT calendar day', () => {
  // 2026-10-07 23:30 PT = 2026-10-08 06:30Z. In PT that is the 7th → 2 days → stuck.
  const jobs = [['T', 'TZ', 'x', 'Done', new Date('2026-10-08T06:30:00Z'), '', '', '']];
  const { ctx } = makeEnv({ jobs, now: NOW });
  const res = ctx.trackFindStuck_(ctx.trackReadJobs_(), ctx.trackParseSettings_([]), '2026-10-09', 'America/Los_Angeles', ctx.trackFmt_);
  assert.strictEqual(res.items.length, 1);
  assert.strictEqual(res.items[0].days, 2);
});

test('sendMorningEmail emails only the owner, with real numbers and value line', () => {
  const jobs = [
    ['J2', 'Lee', 'Panel swap', 'Done', d('2026-10-07'), 1200, 'Ana', ''],
    ['J4', 'Kim', 'Quote: deck', 'Quote', d('2026-10-05'), '', '', ''],
    ['J8', 'Brown', 'Gutter', 'Invoiced', d('2026-09-08'), '1,250.50', '', '']
  ];
  const { ctx, sent } = makeEnv({ jobs, now: NOW, settings: [['Business name (optional)', 'Lee Electric']] });
  ctx.sendMorningEmail();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'owner@example.com');
  assert.strictEqual(sent[0].subject, 'TRACK: 3 jobs need you today (Lee Electric)');
  assert.match(sent[0].body, /Kim – Quote: deck: quoted 4 days ago \(row 3\)/);
  assert.match(sent[0].body, /Lee – Panel swap: done 2 days ago · \$1,200 · Ana \(row 2\)/);
  assert.match(sent[0].body, /Value on your sheet for these jobs: \$2,450\.50 \(2 of 3 have an amount\)/);
  assert.doesNotMatch(sent[0].body, /recover|saved|caught/i);
  console.log('\n----- sample email -----\nSubject: ' + sent[0].subject + '\n' + sent[0].body + '\n------------------------\n');
});

test('no email when nothing is stuck (default), email when setting says Yes', () => {
  const jobs = [['J1', 'Smith', 'x', 'Done', d('2026-10-09'), '', '', '']];
  let env = makeEnv({ jobs, now: NOW });
  env.ctx.sendMorningEmail();
  assert.strictEqual(env.sent.length, 0);
  env = makeEnv({ jobs, now: NOW, settings: [['Email when nothing is stuck (Yes/No)', 'Yes']] });
  env.ctx.sendMorningEmail();
  assert.strictEqual(env.sent.length, 1);
  assert.strictEqual(env.sent[0].subject, 'TRACK: no stuck jobs today');
});

test('turn on/off creates exactly one daily trigger in the sheet time zone', () => {
  const { ctx, triggers } = makeEnv({ jobs: [], now: NOW, tz: 'America/Chicago', settings: [['Email hour (0-23)', 6]] });
  ctx.trackTurnOnEmail(); ctx.trackTurnOnEmail();
  assert.strictEqual(triggers.length, 1);
  assert.deepStrictEqual([triggers[0].h, triggers[0].every, triggers[0].hour, triggers[0].tz], ['sendMorningEmail', 1, 6, 'America/Chicago']);
  ctx.trackTurnOffEmail();
  assert.strictEqual(triggers.length, 0);
});

test('onEdit stamps Stage date only for Stage edits on the Jobs tab', () => {
  const jobs = [['J1', 'Smith', 'x', 'Quote', d('2026-10-01'), '', '', ''], ['J2', 'Lee', 'y', '', '', '', '', '']];
  const { ctx, sheets } = makeEnv({ jobs, now: NOW });
  const J = sheets.Jobs;
  J.rows[1][3] = 'Done';
  ctx.onEdit({ range: J.getRange(2, 4) });
  assert.strictEqual(fmtDate(J.rows[1][4], 'America/Los_Angeles', 'yyyy-MM-dd'), '2026-10-09');
  ctx.onEdit({ range: J.getRange(3, 4) });            // empty stage → no stamp
  assert.strictEqual(J.rows[2][4], '');
  const before = J.rows[1][4]; J.rows[1][4] = 'keep';
  ctx.onEdit({ range: J.getRange(2, 2) });            // other column → no stamp
  assert.strictEqual(J.rows[1][4], 'keep'); J.rows[1][4] = before;
  ctx.onEdit({ range: sheets.Settings.getRange(2, 4) }); // other tab → nothing
});

test('static checks: no outside calls, manifest scopes are the narrow set', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  for (const bad of ['UrlFetchApp', 'GmailApp', 'DriveApp', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), 'Code.gs contains ' + bad);
  }
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
  assert.deepStrictEqual(m.oauthScopes.slice().sort(), [
    'https://www.googleapis.com/auth/script.container.ui',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ]);
});

test('template CSVs load and parse (example rows: 1001 done 2d, 1002 quote 4d, 1003 invoiced 19d)', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', 'template', f), 'utf8').trim().split('\n').map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')).slice(0, -0 || undefined));
  const jobs = read('track-jobs.csv'), sets = read('track-settings.csv');
  const { ctx } = makeEnv({ jobs: jobs.slice(1).map(r => r.slice(0, 8)), now: NOW, settings: sets.slice(1).map(r => r.slice(0, 2)) });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.trackReadJobs_()[0])).slice(0, 4), ['1001', 'Example: Smith', 'Water heater swap', 'Done']);
  const s = ctx.trackParseSettings_(sets.slice(1));
  assert.strictEqual(s['Invoiced, unpaid: days'], 14);
  const res = ctx.trackFindStuck_(ctx.trackReadJobs_(), s, '2026-10-09', 'America/Los_Angeles', ctx.trackFmt_);
  assert.deepStrictEqual([...res.items.map(j => j.id + ':' + j.rule)], ['1001:done_not_invoiced', '1003:unpaid', '1002:quote_no_reply']);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
