import test from "node:test";
import assert from "node:assert/strict";
import { getLiveMascotState } from "./liveMascot.js";

test("러닝 비교 상태에 맞는 캐릭터를 고른다", () => {
  assert.equal(getLiveMascotState({ isPaused: true, timeDifference: 7 }), "resting");
  assert.equal(getLiveMascotState({ isPaused: false, timeDifference: 7 }), "ahead");
  assert.equal(getLiveMascotState({ isPaused: false, timeDifference: -7 }), "tired");
  assert.equal(getLiveMascotState({ isPaused: false, timeDifference: 0 }), "steady");
});
