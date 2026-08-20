import test from "node:test";
import assert from "node:assert/strict";
import { sortRunningRecords } from "./runningRecordSort.js";

const records = [
  { id: "old-fast", startTime: "2026-08-16", pace: 4.5, distance: 3000 },
  { id: "new-long", startTime: "2026-08-18", pace: 6, distance: 10000 },
  { id: "no-pace", startTime: "2026-08-17", pace: null, distance: 0 },
];

test("전체 러닝 기록을 선택한 기준으로 정렬한다", () => {
  assert.deepEqual(sortRunningRecords(records).map(({ id }) => id), [
    "new-long", "no-pace", "old-fast",
  ]);
  assert.deepEqual(sortRunningRecords(records, "pace").map(({ id }) => id), [
    "old-fast", "new-long", "no-pace",
  ]);
  assert.deepEqual(sortRunningRecords(records, "distance").map(({ id }) => id), [
    "new-long", "old-fast", "no-pace",
  ]);
});
