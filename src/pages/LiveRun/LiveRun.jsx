import { useEffect, useState, useRef } from "react";
import KakaoMap from "../../components/KakaoMap";
import { startRun, finishRun } from "../../api/runApi";

function LiveRun() {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: null,
  });

  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("GPS 대기 중...");

  // 백엔드에서 받아온 러닝 ID (예: 123)
  const [currentRunId, setCurrentRunId] = useState(null);

  // 선택한 과거 러닝 기록 (페이스메이커)
  const [selectedPacer, setSelectedPacer] = useState(null);

  // 과거 러닝과 현재 러닝 비교 결과
  const [pacerDifference, setPacerDifference] = useState(null);

  // GPS 이동 경로
  const [path, setPath] = useState([]);

  // 러닝 진행 여부
  const [isRunning, setIsRunning] = useState(true);

  const previousPosition = useRef(null);
  const totalDistance = useRef(0);
  const startTime = useRef(null);
  const watchIdRef = useRef(null);

  // 1. 러닝 시작 API 호출 (/runs/start)
  useEffect(() => {
    const initRun = async () => {
      try {
        const courseId = 1;
        const res = await startRun(courseId);
        console.log("===== 백엔드 러닝 시작 완료 =====", res);

        // res.data.id 형태에서 러닝 ID 추출
        if (res && res.data && res.data.id) {
          setCurrentRunId(res.data.id);
        }
      } catch (error) {
        console.error("백엔드 러닝 시작 실패:", error);
      }
    };

    initRun();
  }, []);

  // 2. LocalStorage에서 선택된 과거 러닝 기록 불러오기
  useEffect(() => {
    const savedPacer = localStorage.getItem("selectedPacerRecord");
    if (savedPacer) {
      try {
        const parsedPacer = JSON.parse(savedPacer);
        console.log("===== 선택된 과거 러닝 =====", parsedPacer);
        setSelectedPacer(parsedPacer);
      } catch (error) {
        console.log("과거 러닝 기록 불러오기 실패:", error);
      }
    }
  }, []);

  // 3. GPS 추적
  useEffect(() => {
    startTime.current = Date.now();

    if (!navigator.geolocation) {
      setGpsStatus("이 브라우저는 GPS를 지원하지 않습니다.");
      return;
    }

    setGpsStatus("GPS 연결 시도 중...");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus("GPS 연결 성공");

        const currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setPath((prevPath) => [
          ...prevPath,
          {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
          },
        ]);

        if (previousPosition.current) {
          const movedDistance = calculateDistance(
            previousPosition.current.latitude,
            previousPosition.current.longitude,
            currentPosition.latitude,
            currentPosition.longitude
          );

          if (movedDistance > 5) {
            totalDistance.current += movedDistance;
            setDistance(totalDistance.current);
            setPace(calculatePace(totalDistance.current));
          }
        }

        previousPosition.current = currentPosition;

        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
        });
      },
      (error) => {
        let message = "";
        switch (error.code) {
          case 1:
            message = "위치 권한이 거부되었습니다.";
            break;
          case 2:
            message = "현재 위치를 가져올 수 없습니다.";
            break;
          case 3:
            message = "GPS 요청 시간이 초과되었습니다.";
            break;
          default:
            message = error.message;
        }
        setGpsStatus(`GPS 오류 (${error.code}) : ${message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 4. 과거 기록과 현재 GPS 비교
  useEffect(() => {
    if (
      !selectedPacer ||
      !selectedPacer.path ||
      selectedPacer.path.length < 2 ||
      !location.latitude ||
      !location.longitude ||
      distance <= 0
    ) {
      return;
    }

    compareWithPastRun(location, distance, selectedPacer);
  }, [location, distance, selectedPacer]);

  function compareWithPastRun(currentPosition, currentDistance, pastRun) {
    const pastPath = pastRun.path;
    if (!pastPath || pastPath.length < 2) return;

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < pastPath.length; i++) {
      const dist = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        pastPath[i].latitude,
        pastPath[i].longitude
      );

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }

    let pastProgressDistance = 0;
    for (let i = 1; i <= nearestIndex; i++) {
      pastProgressDistance += calculateDistance(
        pastPath[i - 1].latitude,
        pastPath[i - 1].longitude,
        pastPath[i].latitude,
        pastPath[i].longitude
      );
    }

    const difference = currentDistance - pastProgressDistance;

    setPacerDifference({
      difference: difference,
      pastDistance: pastProgressDistance,
      nearestDistance: nearestDistance,
    });
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculatePace(distanceVal) {
    if (distanceVal < 100) return null;
    const time = (Date.now() - startTime.current) / 1000;
    const km = distanceVal / 1000;
    return time / 60 / km;
  }

  // 5. 러닝 종료 처리 함수
  async function handleStopRunning() {
    if (!isRunning) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const endTime = Date.now();
    const elapsedTime = Math.floor((endTime - startTime.current) / 1000);

    // LocalStorage 저장용 데이터
    const runRecord = {
      id: currentRunId || Date.now(),
      startTime: startTime.current,
      endTime: endTime,
      elapsedTime: elapsedTime,
      distance: totalDistance.current,
      pace: calculatePace(totalDistance.current),
      path: path,
      createdAt: new Date().toISOString(),
    };

    const existingRecords = JSON.parse(localStorage.getItem("runningRecords")) || [];
    existingRecords.push(runRecord);
    localStorage.setItem("runningRecords", JSON.stringify(existingRecords));

    // 백엔드 API 전송용 Payload
    const apiPayload = {
      end_time: new Date().toISOString(),
      total_distance: totalDistance.current,
      total_time: elapsedTime,
      gps_path: path.map((p) => [p.latitude, p.longitude]),
      splits: [],
      ghost_run_id: selectedPacer ? selectedPacer.id : 0,
      is_public: true,
    };

    // 백엔드로 러닝 종료 데이터 보내기 (/runs/{run_id}/finish)
    try {
      const targetRunId = currentRunId || 1;
      const res = await finishRun(targetRunId, apiPayload);
      console.log("===== 백엔드 기록 저장 완료 =====", res);
    } catch (error) {
      console.error("백엔드 기록 저장 실패:", error);
    }

    setIsRunning(false);
    setGpsStatus("러닝 종료 및 기록 저장 완료");
  }

  return (
    <div>
      <h1>Live Run</h1>
      <h3>{gpsStatus}</h3>

      {selectedPacer && (
        <>
          <hr />
          <h2>🏃 과거의 나</h2>
          <p>과거 총 거리 : {(selectedPacer.distance / 1000).toFixed(2)} km</p>
          <p>
            과거 평균 페이스 :{" "}
            {selectedPacer.pace ? selectedPacer.pace.toFixed(2) : "-"} 분/km
          </p>
        </>
      )}

      {pacerDifference && (
        <>
          <hr />
          <h2>📊 과거의 나와 비교</h2>
          <p>현재 거리 : {(distance / 1000).toFixed(2)} km</p>
          <p>
            과거 경로 진행 거리 :{" "}
            {(pacerDifference.pastDistance / 1000).toFixed(2)} km
          </p>
          <h3>
            {pacerDifference.difference > 10
              ? `🟢 과거의 나보다 ${pacerDifference.difference.toFixed(0)}m 앞서고 있습니다!`
              : pacerDifference.difference < -10
              ? `🔴 과거의 나보다 ${Math.abs(pacerDifference.difference).toFixed(0)}m 뒤처져 있습니다.`
              : "🟡 과거의 나와 비슷한 위치입니다."}
          </h3>
          <p>
            과거 경로와 현재 위치 거리 :{" "}
            {pacerDifference.nearestDistance.toFixed(1)} m
          </p>
        </>
      )}

      <hr />

      <KakaoMap
        latitude={location.latitude}
        longitude={location.longitude}
        path={path}
      />

      <hr />

      <p>위도 : {location.latitude ?? "-"}</p>
      <p>경도 : {location.longitude ?? "-"}</p>
      <p>속도 : {location.speed ? location.speed.toFixed(2) : "-"} m/s</p>

      <hr />

      <h2>총 거리 : {(distance / 1000).toFixed(2)} km</h2>
      <h2>평균 페이스 : {pace ? pace.toFixed(2) : "-"} 분/km</h2>

      <hr />

      {isRunning ? (
        <button
          onClick={handleStopRunning}
          style={{
            padding: "12px 24px",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          러닝 종료
        </button>
      ) : (
        <h2>러닝 기록이 저장되었습니다.</h2>
      )}
    </div>
  );
}

export default LiveRun;