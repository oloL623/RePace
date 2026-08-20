import { useEffect, useRef, useState } from "react";

const DEFAULT_LATITUDE = 37.5665;
const DEFAULT_LONGITUDE = 126.978;

function KakaoMap({
  latitude,
  longitude,
  path,
  pastPath,
  fitPath = false,
  height = 260,
}) {
  const mapRef = useRef(null);

  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const polylineInstance = useRef(null);
  const pastPolylineInstance = useRef(null);

  // ref 값의 변경만으로는 React가 다시 렌더링하지 않는다.
  // SDK가 늦게 로드돼도 전달받은 경로를 다시 적용할 수 있도록 준비 상태를 별도로 둔다.
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let isLoadRequested = false;

    const initializeMap = () => {
      if (!window.kakao?.maps || isLoadRequested) {
        return;
      }

      isLoadRequested = true;

      window.kakao.maps.load(() => {
        if (isCancelled || !mapRef.current) {
          return;
        }

        const initialPosition = new window.kakao.maps.LatLng(
          DEFAULT_LATITUDE,
          DEFAULT_LONGITUDE
        );

        const map = new window.kakao.maps.Map(mapRef.current, {
          center: initialPosition,
          level: 3,
        });

        mapInstance.current = map;

        // 현재 러너 위치를 표시하는 마커
        const marker = new window.kakao.maps.Marker({
          position: initialPosition,
        });
        marker.setMap(map);
        markerInstance.current = marker;

        // RePace 초록 실선: 현재 러닝 경로
        const polyline = new window.kakao.maps.Polyline({
          path: [],
          strokeWeight: 5,
          strokeColor: "#08B76B",
          strokeOpacity: 0.8,
          strokeStyle: "solid",
        });
        polyline.setMap(map);
        polylineInstance.current = polyline;

        // 파란 점선: 비교 대상으로 선택한 과거 러닝 경로
        const pastPolyline = new window.kakao.maps.Polyline({
          path: [],
          strokeWeight: 5,
          strokeColor: "#007AFF",
          strokeOpacity: 0.7,
          strokeStyle: "shortdash",
        });
        pastPolyline.setMap(map);
        pastPolylineInstance.current = pastPolyline;

        // 아래의 위치/경로 effect를 다시 실행해 최신 props를 지도에 반영한다.
        setIsMapReady(true);
      });
    };

    initializeMap();

    // index.html의 카카오 SDK가 아직 도착하지 않았다면 짧게 기다렸다가 초기화한다.
    const timer = setInterval(() => {
      initializeMap();

      if (isLoadRequested) {
        clearInterval(timer);
      }
    }, 100);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (
      !isMapReady ||
      !mapInstance.current ||
      !markerInstance.current ||
      latitude == null ||
      longitude == null
    ) {
      return;
    }

    const position = new window.kakao.maps.LatLng(
      latitude,
      longitude
    );

    markerInstance.current.setPosition(position);
    mapInstance.current.setCenter(position);
  }, [isMapReady, latitude, longitude]);

  useEffect(() => {
    if (!isMapReady || !polylineInstance.current) {
      return;
    }

    const linePath = (path ?? []).map(
      (point) =>
        new window.kakao.maps.LatLng(
          point.latitude,
          point.longitude
        )
    );

    // 빈 배열도 적용해야 새 러닝 시작 시 이전 선이 지도에 남지 않는다.
    polylineInstance.current.setPath(linePath);

    if (fitPath && linePath.length > 1 && mapInstance.current) {
      const bounds = new window.kakao.maps.LatLngBounds();

      linePath.forEach((point) => bounds.extend(point));

      // 결과 화면에서는 선택한 기록의 GPS 경로 전체가 한눈에 보이도록 지도를 맞춘다.
      mapInstance.current.setBounds(bounds);
    }
  }, [fitPath, isMapReady, path]);

  useEffect(() => {
    if (!isMapReady || !pastPolylineInstance.current) {
      return;
    }

    const pastLinePath = (pastPath ?? []).map(
      (point) =>
        new window.kakao.maps.LatLng(
          point.latitude,
          point.longitude
        )
    );

    // 선택 기록이 바뀌거나 해제될 때 파란 경로도 즉시 교체/제거한다.
    pastPolylineInstance.current.setPath(pastLinePath);
  }, [isMapReady, pastPath]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: `${height}px`,
      }}
    />
  );
}

export default KakaoMap;
