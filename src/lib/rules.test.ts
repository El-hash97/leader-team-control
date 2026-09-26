// Run: node --test src/lib/rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupWorkdays, memberWorkdays, performance, tenure, dueLabel, daysLeft,
  isMultiSkill, overallLevel, backupCount, displayStatus, monthEnd, addMonths, contractKind, contractEndFor,
  isMemberLogin, nextFailState, LOCK_MS,
} from "./rules.ts";

const WD = [1, 2, 3, 4, 5];

test("workdays", () => {
  assert.equal(monthEnd("2026-02"), "2026-02-28");
  assert.equal(groupWorkdays("2026-09-01", "2026-09-30", WD), 22);
  assert.equal(groupWorkdays("2026-09-01", "2026-09-30", WD, ["2026-09-01"]), 21);
  assert.equal(groupWorkdays("2026-09-01", "2026-09-30", [1, 2, 3, 4, 5, 6]), 26);
  const cfg = { workWeekdays: WD, holidays: [], today: "2026-09-10" };
  assert.equal(memberWorkdays("2026-09", { joinDate: "2020-01-01" }, cfg), 8); // cut at today
  assert.equal(memberWorkdays("2026-09", { joinDate: "2026-09-07" }, cfg), 4); // join mid-month
  assert.equal(memberWorkdays("2026-09", { joinDate: "2020-01-01", deactivatedAt: "2026-09-02" }, cfg), 2);
  assert.equal(memberWorkdays("2026-09", { joinDate: "2026-10-01" }, cfg), 0);
});

test("performance", () => {
  assert.equal(performance(5, 0), null);
  assert.equal(performance(21, 20), 100);
  assert.equal(performance(19, 22), 86);
});

test("tenure & due", () => {
  assert.equal(tenure("2020-01-31", "2026-09-30"), "6 th 7 bln");
  assert.equal(tenure("2020-01-15", "2026-09-15"), "6 th 8 bln");
  assert.equal(tenure("2027-01-01", "2026-09-15"), "Belum mulai");
  assert.equal(daysLeft("2026-12-24", "2026-09-25"), 90);
  assert.equal(dueLabel(-3), "Lewat 3 hari");
});

test("skill", () => {
  const P = ["a", "b", "c", "d"];
  assert.equal(isMultiSkill({ a: 3, b: 3, c: 4 }, P), true);
  assert.equal(isMultiSkill({ a: 3, b: 3, c: 2 }, P), false);
  assert.equal(overallLevel({ a: 3, b: 3, c: 4 }, P), 4);
  assert.equal(overallLevel({ a: 3, b: 3, c: 3 }, P), 3);
  assert.equal(overallLevel({ a: 3 }, P), 2);
  assert.equal(overallLevel({}, P), 1);
  assert.equal(isMultiSkill({ a: 3, b: 3, x: 4 }, P), false); // inactive process ignored
  assert.equal(backupCount([{ a: 3 }, { a: 2 }, { a: 4 }], "a"), 2);
});

test("contract length", () => {
  const C = { vokasi: 6, pkwt1: 24, pkwt2Extra: 12 };
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(contractKind("Karyawan Tetap", "Team Member"), null);
  assert.equal(contractKind("PKWT", "PKWT 2"), "pkwt2");
  assert.equal(contractEndFor("vokasi", "2026-01-01", C), "2026-06-30");
  assert.equal(contractEndFor("pkwt1", "2025-01-01", C), "2026-12-31");
  assert.equal(contractEndFor("pkwt2", "2025-01-01", C), "2027-12-31");
  assert.equal(contractEndFor(null, "2025-01-01", C), null);
});

test("plan status", () => {
  assert.equal(displayStatus({ status: "IN_PROGRESS", dueDate: "2026-09-01" }, "2026-09-10"), "OVERDUE");
  assert.equal(displayStatus({ status: "ACHIEVED", dueDate: "2026-09-01" }, "2026-09-10"), "ACHIEVED");
});

test("member login & lockout", () => {
  assert.equal(isMemberLogin("1234567"), true);
  assert.equal(isMemberLogin(" 1234567 "), true);
  assert.equal(isMemberLogin("123456"), false);
  assert.equal(isMemberLogin("12345678"), false);
  assert.equal(isMemberLogin("leader"), false);
  assert.deepEqual(nextFailState(3, 0), { failed: 4, lockedUntil: null });
  assert.deepEqual(nextFailState(4, 1000), { failed: 0, lockedUntil: 1000 + LOCK_MS });
});
