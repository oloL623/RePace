import { useEffect, useState, useRef } from "react";
import KakaoMap from "../../components/KakaoMap";

function LiveRun() {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: null,
  });

  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState(null);
  const [gpsStatus, setGpsStatus] =
    useState("GPS 대기 중...");

  // ⭐ 선택한 과거 러닝 기록
  const [selectedPacer, setSelectedPacer] =
    useState(null);

  // ⭐ 과거 러닝과 현재 러닝 비교 결과
  const [pacerDifference, setPacerDifference] =
    useState(null);

  // GPS 이동 경로
  const [path, setPath] = useState([]);

  // 러닝 종료 여부
  const [isRunning, setIsRunning] =
    useState(true);

  const previousPosition =
    useRef(null);

  const totalDistance =
    useRef(0);

  const startTime =
    useRef(null);

  const watchIdRef =
    useRef(null);

  // ⭐ 선택한 과거 기록 가져오기
  useEffect(() => {
    const savedPacer =
      localStorage.getItem(
        "selectedPacerRecord"
      );

    if (savedPacer) {
      try {
        const parsedPacer =
          JSON.parse(savedPacer);

        console.log(
          "===== 선택된 과거 러닝 ====="
        );

        console.log(parsedPacer);

        setSelectedPacer(
          parsedPacer
        );
      } catch (error) {
        console.log(
          "과거 러닝 기록 불러오기 실패:",
          error
        );
      }
    }
  }, []);

  // ⭐ GPS 추적
  useEffect(() => {
    startTime.current =
      Date.now();

    // GPS 지원 확인
    if (!navigator.geolocation) {
      setGpsStatus(
        "이 브라우저는 GPS를 지원하지 않습니다."
      );
      return;
    }

    setGpsStatus(
      "GPS 연결 시도 중..."
    );

    const watchId =
      navigator.geolocation.watchPosition(
        // GPS 성공
        (position) => {
          console.log(
            "GPS 성공"
          );

          console.log(
            position
          );

          setGpsStatus(
            "GPS 연결 성공"
          );

          const currentPosition = {
            latitude:
              position.coords.latitude,

            longitude:
              position.coords.longitude,
          };

          // 현재 GPS 경로 저장
          setPath((prevPath) => [
            ...prevPath,
            {
              latitude:
                currentPosition.latitude,

              longitude:
                currentPosition.longitude,
            },
          ]);

          // 이전 위치가 있으면 거리 계산
          if (
            previousPosition.current
          ) {
            const movedDistance =
              calculateDistance(
                previousPosition.current
                  .latitude,

                previousPosition.current
                  .longitude,

                currentPosition.latitude,

                currentPosition.longitude
              );

            console.log(
              "이동 거리:",
              movedDistance
            );

            // GPS 흔들림 제거
            if (
              movedDistance > 5
            ) {
              totalDistance.current +=
                movedDistance;

              console.log(
                "총 거리:",
                totalDistance.current
              );

              setDistance(
                totalDistance.current
              );

              setPace(
                calculatePace(
                  totalDistance.current
                )
              );
            }
          }

          previousPosition.current =
            currentPosition;

          setLocation({
            latitude:
              position.coords.latitude,

            longitude:
              position.coords.longitude,

            speed:
              position.coords.speed,
          });
        },

        // GPS 실패
        (error) => {
          console.log(
            "===== GPS ERROR ====="
          );

          console.log(error);

          console.log(
            "error.code :",
            error.code
          );

          console.log(
            "error.message :",
            error.message
          );

          let message = "";

          switch (error.code) {
            case 1:
              message =
                "위치 권한이 거부되었습니다.";
              break;

            case 2:
              message =
                "현재 위치를 가져올 수 없습니다.";
              break;

            case 3:
              message =
                "GPS 요청 시간이 초과되었습니다.";
              break;

            default:
              message =
                error.message;
          }

          setGpsStatus(
            `GPS 오류 (${error.code}) : ${message}`
          );
        },

        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );

    watchIdRef.current =
      watchId;

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      );
    };
  }, []);

  // ⭐ 현재 GPS 위치와 과거 러닝 경로 비교
  useEffect(() => {
    if (
      !selectedPacer ||
      !selectedPacer.path ||
      selectedPacer.path.length < 2 ||
      !location.latitude ||
      !location.longitude
    ) {
      return;
    }

    if (distance <= 0) {
      return;
    }

    compareWithPastRun(
      location,
      distance,
      selectedPacer
    );
  }, [
    location,
    distance,
    selectedPacer,
  ]);

  // ⭐ 과거 러닝과 현재 위치 비교
  function compareWithPastRun(
    currentPosition,
    currentDistance,
    pastRun
  ) {
    const pastPath =
      pastRun.path;

    if (
      !pastPath ||
      pastPath.length < 2
    ) {
      return;
    }

    let nearestIndex = 0;

    let nearestDistance =
      Infinity;

    // 현재 위치와 가장 가까운
    // 과거 GPS 좌표 찾기
    for (
      let i = 0;
      i < pastPath.length;
      i++
    ) {
      const distance =
        calculateDistance(
          currentPosition.latitude,
          currentPosition.longitude,
          pastPath[i].latitude,
          pastPath[i].longitude
        );

      if (
        distance <
        nearestDistance
      ) {
        nearestDistance =
          distance;

        nearestIndex =
          i;
      }
    }

    // 과거 경로에서
    // 가장 가까운 지점까지의 거리
    let pastProgressDistance =
      0;

    for (
      let i = 1;
      i <= nearestIndex;
      i++
    ) {
      pastProgressDistance +=
        calculateDistance(
          pastPath[i - 1].latitude,
          pastPath[i - 1].longitude,
          pastPath[i].latitude,
          pastPath[i].longitude
        );
    }

    // 현재 거리 - 과거 경로상의 거리
    const difference =
      currentDistance -
      pastProgressDistance;

    console.log(
      "===== 과거 러닝 비교 ====="
    );

    console.log(
      "현재 거리:",
      currentDistance
    );

    console.log(
      "과거 경로 진행 거리:",
      pastProgressDistance
    );

    console.log(
      "거리 차이:",
      difference
    );

    console.log(
      "과거 경로 가장 가까운 지점:",
      nearestIndex
    );

    console.log(
      "현재 위치와 과거 경로 거리:",
      nearestDistance
    );

    setPacerDifference({
      difference:
        difference,

      pastDistance:
        pastProgressDistance,

      nearestDistance:
        nearestDistance,
    });
  }

  // 두 GPS 좌표 사이 거리 계산
  function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
  ) {
    const R = 6371000;

    const dLat =
      ((lat2 - lat1) *
        Math.PI) /
      180;

    const dLon =
      ((lon2 - lon1) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(
        (lat1 * Math.PI) /
          180
      ) *
        Math.cos(
          (lat2 * Math.PI) /
            180
        ) *
        Math.sin(
          dLon / 2
        ) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  }

  // 평균 페이스 계산
  function calculatePace(
    distance
  ) {
    // 100m 전에는 표시 안 함
    if (
      distance < 100
    ) {
      return null;
    }

    const time =
      (Date.now() -
        startTime.current) /
      1000;

    const km =
      distance / 1000;

    const result =
      (time / 60) / km;

    return result;
  }

  // ⭐ 러닝 종료
  function handleStopRunning() {
    if (!isRunning) {
      return;
    }

    // GPS 추적 중지
    if (
      watchIdRef.current !==
      null
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );
    }

    const endTime =
      Date.now();

    const elapsedTime =
      Math.floor(
        (endTime -
          startTime.current) /
          1000
      );

    // 러닝 기록 객체 생성
    const runRecord = {
      id: Date.now(),

      startTime:
        startTime.current,

      endTime:
        endTime,

      elapsedTime:
        elapsedTime,

      distance:
        totalDistance.current,

      pace: calculatePace(
        totalDistance.current
      ),

      path:
        path,

      createdAt:
        new Date().toISOString(),
    };

    console.log(
      "===== 러닝 기록 저장 ====="
    );

    console.log(
      runRecord
    );

    // 기존 러닝 기록 가져오기
    const existingRecords =
      JSON.parse(
        localStorage.getItem(
          "runningRecords"
        )
      ) || [];

    // 새로운 기록 추가
    existingRecords.push(
      runRecord
    );

    // localStorage 저장
    localStorage.setItem(
      "runningRecords",
      JSON.stringify(
        existingRecords
      )
    );

    console.log(
      "러닝 기록 저장 완료!"
    );

    setIsRunning(
      false
    );

    setGpsStatus(
      "러닝 종료 및 기록 저장 완료"
    );
  }

  return (
    <div>
      <h1>
        Live Run
      </h1>

      <h3>
        {gpsStatus}
      </h3>

      {/* ⭐ 과거 러닝 기록 */}
      {selectedPacer && (
        <>
          <hr />

          <h2>
            🏃 과거의 나
          </h2>

          <p>
            과거 총 거리 :{" "}
            {(
              selectedPacer.distance /
              1000
            ).toFixed(2)}{" "}
            km
          </p>

          <p>
            과거 평균 페이스 :{" "}
            {selectedPacer.pace
              ? selectedPacer.pace.toFixed(
                  2
                )
              : "-"}{" "}
            분/km
          </p>
        </>
      )}

      {/* ⭐ 과거 러닝 비교 결과 */}
      {pacerDifference && (
        <>
          <hr />

          <h2>
            📊 과거의 나와 비교
          </h2>

          <p>
            현재 거리 :{" "}
            {(
              distance / 1000
            ).toFixed(2)}{" "}
            km
          </p>

          <p>
            과거 경로 진행 거리 :{" "}
            {(
              pacerDifference.pastDistance /
              1000
            ).toFixed(2)}{" "}
            km
          </p>

          <h3>
            {pacerDifference.difference >
            10
              ? `🟢 과거의 나보다 ${pacerDifference.difference.toFixed(
                  0
                )}m 앞서고 있습니다!`
              : pacerDifference.difference <
                -10
              ? `🔴 과거의 나보다 ${Math.abs(
                  pacerDifference.difference
                ).toFixed(
                  0
                )}m 뒤처져 있습니다.`
              : "🟡 과거의 나와 비슷한 위치입니다."}
          </h3>

          <p>
            과거 경로와 현재 위치 거리 :{" "}
            {pacerDifference.nearestDistance.toFixed(
              1
            )}{" "}
            m
          </p>
        </>
      )}

      <hr />

      {/* 카카오맵 */}
      <KakaoMap
        latitude={
          location.latitude
        }
        longitude={
          location.longitude
        }
        path={
          path
        }
      />

      <hr />

      <p>
        위도 :{" "}
        {location.latitude ??
          "-"}
      </p>

      <p>
        경도 :{" "}
        {location.longitude ??
          "-"}
      </p>

      <p>
        속도 :{" "}
        {location.speed
          ? location.speed.toFixed(
              2
            )
          : "-"}{" "}
        m/s
      </p>

      <hr />

      <h2>
        총 거리 :{" "}
        {(
          distance / 1000
        ).toFixed(2)}{" "}
        km
      </h2>

      <h2>
        평균 페이스 :{" "}
        {pace
          ? pace.toFixed(2)
          : "-"}{" "}
        분/km
      </h2>

      <hr />

      {/* ⭐ 러닝 종료 버튼 */}
      {isRunning ? (
        <button
          onClick={
            handleStopRunning
          }
          style={{
            padding:
              "12px 24px",

            fontSize:
              "18px",

            cursor:
              "pointer",
          }}
        >
          러닝 종료
        </button>
      ) : (
        <h2>
          러닝 기록이
          저장되었습니다.
        </h2>
      )}
    </div>
  );
}

export default LiveRun;