import { useEffect, useRef } from "react";

function KakaoMap({
  latitude,
  longitude,
  path,
}) {
  const mapRef = useRef(null);

  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const polylineInstance = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {

      if (
        window.kakao &&
        window.kakao.maps
      ) {
        clearInterval(timer);

        window.kakao.maps.load(() => {

          const container = mapRef.current;

          if (!container) {
            return;
          }

          const initialPosition =
            new window.kakao.maps.LatLng(
              latitude || 37.5665,
              longitude || 126.9780
            );

          const options = {
            center: initialPosition,
            level: 3,
          };

          // 지도 생성
          const map =
            new window.kakao.maps.Map(
              container,
              options
            );

          mapInstance.current = map;

          // 현재 위치 마커 생성
          const marker =
            new window.kakao.maps.Marker({
              position: initialPosition,
            });

          marker.setMap(map);

          markerInstance.current = marker;

          // ⭐ 러닝 경로 선 생성
          const polyline =
            new window.kakao.maps.Polyline({
              path: [],
              strokeWeight: 5,
              strokeColor: "#FF0000",
              strokeOpacity: 0.8,
              strokeStyle: "solid",
            });

          polyline.setMap(map);

          polylineInstance.current =
            polyline;

          console.log(
            "카카오맵 생성 완료"
          );
        });
      }

    }, 100);

    return () => {
      clearInterval(timer);
    };

  }, []);


  // ⭐ 현재 위치가 변경될 때
  useEffect(() => {

    if (
      !mapInstance.current ||
      !markerInstance.current ||
      !latitude ||
      !longitude
    ) {
      return;
    }

    const position =
      new window.kakao.maps.LatLng(
        latitude,
        longitude
      );

    // 현재 위치 마커 이동
    markerInstance.current.setPosition(
      position
    );

    // 지도 중심 이동
    mapInstance.current.setCenter(
      position
    );

  }, [latitude, longitude]);


  // ⭐ 러닝 경로가 변경될 때
  useEffect(() => {

    if (
      !polylineInstance.current ||
      !window.kakao ||
      !window.kakao.maps
    ) {
      return;
    }

    if (!path || path.length === 0) {
      return;
    }

    const linePath =
      path.map((point) => {

        return new window.kakao.maps.LatLng(
          point.latitude,
          point.longitude
        );

      });

    // Polyline에 좌표 적용
    polylineInstance.current.setPath(
      linePath
    );

    console.log(
      "현재 경로 좌표 개수:",
      linePath.length
    );

  }, [path]);


  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "400px",
      }}
    />
  );
}

export default KakaoMap;