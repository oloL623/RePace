export const UNKNOWN_START_LOCATION = "확인할 수 없음";

export function formatStartLocation(result) {
  const address = result?.[0]?.address;
  const roadAddress = result?.[0]?.road_address;
  const district = [
    address?.region_1depth_name ?? roadAddress?.region_1depth_name,
    address?.region_2depth_name ?? roadAddress?.region_2depth_name,
  ]
    .filter(Boolean)
    .join(" ");

  if (!roadAddress?.address_name) {
    return address?.address_name || UNKNOWN_START_LOCATION;
  }

  return [district, roadAddress.road_name].filter(Boolean).join(", ");
}
