import assert from "node:assert/strict";
import test from "node:test";
import { retryUnauthorizedResponse } from "./apiClient.js";

test("401이면 토큰을 갱신해 요청을 한 번 재시도한다", async () => {
  const firstResponse = { status: 401 };
  const successResponse = { status: 200 };
  let retryCount = 0;

  const response = await retryUnauthorizedResponse(firstResponse, {
    accessToken: "expired-token",
    refresh: async () => "refreshed-token",
    request: async (token) => {
      assert.equal(token, "refreshed-token");
      retryCount += 1;
      return successResponse;
    },
  });

  assert.equal(response, successResponse);
  assert.equal(retryCount, 1);
});
