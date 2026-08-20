import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStartLocation,
  UNKNOWN_START_LOCATION,
} from "./startLocation.js";

test("카카오 주소 결과에서 시군구와 도로명을 분리한다", () => {
  const location = formatStartLocation([
    {
      address: {
        region_1depth_name: "서울특별시",
        region_2depth_name: "영등포구",
      },
      road_address: {
        address_name: "서울특별시 영등포구 영중로 1",
        road_name: "영중로",
      },
    },
  ]);

  assert.equal(location, "서울특별시 영등포구, 영중로");
  assert.equal(formatStartLocation([]), UNKNOWN_START_LOCATION);
});

test("도로명 주소가 없으면 전체 지번 주소만 반환한다", () => {
  assert.equal(
    formatStartLocation([
      {
        address: {
          address_name: "서울특별시 영등포구 영등포동 123",
          region_1depth_name: "서울특별시",
          region_2depth_name: "영등포구",
        },
        road_address: null,
      },
    ]),
    "서울특별시 영등포구 영등포동 123"
  );
});
