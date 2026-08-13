import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import KakaoMap from "../../components/KakaoMap";
import {
  calculateDistanceMeters,
  calculatePacemakerComparison,
  calculateRollingPace,
  createPacemakerProfile,
} from "../../utils/pacemaker";
import {
  createComparisonCoachMessage,
  createFinishCoachMessage,
  createKilometerCoachMessage,
  createProgressCoachMessage,
  getTimeComparisonState,
} from "../../utils/voiceCoach";

const MIN_MOVEMENT_METERS = 3;
const MAX_GPS_ACCURACY_METERS = 300;
const MAX_RUNNING_SPEED_METERS_PER_SECOND = 12;
const VOICE_PROGRESS_INTERVAL_SECONDS = 5 * 60;
const COMPARISON_ANNOUNCEMENT_COOLDOWN_SECONDS = 60;

function isSpeechSynthesisSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function formatElapsedTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

// 러닝 페이스의 소수는 10진수가 아니라 60초 단위로 바꿔 표시한다.
function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  let minutes = Math.floor(pace);
  let seconds = Math.round((pace - minutes) * 60);

  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")} 분/km`;
}

function formatTimeDifference(seconds) {
  const absoluteSeconds = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}초`;
  }

  return `${minutes}분 ${remainingSeconds}초`;
}

function getInitialGpsStatus() {
  return typeof navigator !== "undefined" && navigator.geolocation
    ? "GPS 연결 시도 중..."
    : "이 브라우저는 GPS를 지원하지 않습니다.";
}

function loadSelectedPacer() {
  const savedPacer = localStorage.getItem("selectedPacerRecord");

  if (!savedPacer) {
    return null;
  }

  try {
    return JSON.parse(savedPacer);
  } catch (error) {
    console.error("과거 러닝 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

function loadRunningRecords() {
  try {
    const records = JSON.parse(
      localStorage.getItem("runningRecords")
    );

    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error("저장된 러닝 기록을 불러오지 못했습니다.", error);
    return [];
  }
}

function calculateAveragePace(distance, elapsedSeconds) {
  if (distance < 100 || elapsedSeconds <= 0) {
    return null;
  }

  return (elapsedSeconds / 60) / (distance / 1000);
}

function getGpsErrorMessage(error) {
  const messages = {
    1: "위치 권한이 거부되었습니다.",
    2: "현재 위치를 가져올 수 없습니다.",
    3: "GPS 요청 시간이 초과되었습니다.",
  };

  return messages[error.code] ?? error.message;
}

function LiveRun() {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: null,
    accuracy: null,
  });
  const [distance, setDistance] = useState(0);
  const [averagePace, setAveragePace] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(getInitialGpsStatus);
  const [selectedPacer] = useState(loadSelectedPacer);
  const [path, setPath] = useState([]);
  const [isRunning, setIsRunning] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime] = useState(Date.now);
  const [voiceCoachingEnabled, setVoiceCoachingEnabled] = useState(false);
  const [lastVoiceCoachMessage, setLastVoiceCoachMessage] = useState("");

  const lastAcceptedPosition = useRef(null);
  const totalDistance = useRef(0);
  const watchIdRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const lastProgressIntervalRef = useRef(0);
  const lastKilometerRef = useRef(0);
  const comparisonStateRef = useRef(null);
  const lastComparisonAnnouncementAtRef = useRef(0);
  const offCourseStateRef = useRef(false);

  const voiceCoachingSupported = isSpeechSynthesisSupported();

  const pacemakerProfile = useMemo(
    () => createPacemakerProfile(selectedPacer),
    [selectedPacer]
  );

  const currentPace = useMemo(
    () => calculateRollingPace(path, elapsedSeconds),
    [path, elapsedSeconds]
  );

  const pacemakerComparison = useMemo(() => {
    if (
      distance <= 0 ||
      location.latitude == null ||
      location.longitude == null
    ) {
      return null;
    }

    return calculatePacemakerComparison({
      profile: pacemakerProfile,
      currentPosition: location,
      currentDistance: distance,
      currentElapsedSeconds: elapsedSeconds,
    });
  }, [
    distance,
    elapsedSeconds,
    location,
    pacemakerProfile,
  ]);

  const routeWarningDistance = Math.max(
    30,
    (location.accuracy ?? 0) * 1.5
  );
  const isOffCourse =
    pacemakerComparison?.routeDistance != null &&
    pacemakerComparison.routeDistance > routeWarningDistance;

  // 새 안내가 이전 안내를 계속 끊지 않도록 일반 안내는 재생 중일 때 건너뛴다.
  // 코스 이탈과 종료처럼 중요한 안내만 interrupt 옵션으로 즉시 전달한다.
  const speakCoachMessage = useCallback((message, { interrupt = false } = {}) => {
    if (!message || !isSpeechSynthesisSupported()) {
      return false;
    }

    const speechSynthesis = window.speechSynthesis;

    if (interrupt) {
      speechSynthesis.cancel();
    } else if (speechSynthesis.speaking || speechSynthesis.pending) {
      return false;
    }

    const utterance = new window.SpeechSynthesisUtterance(message);
    const koreanVoice = speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ko"));

    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.pitch = 1;

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    // 일부 모바일 브라우저에서 객체가 일찍 정리되어 음성이 끊기는 것을 막는다.
    activeUtteranceRef.current = utterance;
    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
    };
    utterance.onerror = utterance.onend;

    speechSynthesis.resume();
    speechSynthesis.speak(utterance);
    setLastVoiceCoachMessage(message);

    return true;
  }, []);

  // GPS 정확도가 낮거나 순간이동으로 판단되는 좌표는 경로와 거리에 반영하지 않는다.
  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const timestamp = position.timestamp || Date.now();
        const currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
          timestamp,
        };

        setLocation(currentPosition);

        if (currentPosition.accuracy > MAX_GPS_ACCURACY_METERS) {
          setGpsStatus(
            `GPS 정확도 낮음 (±${currentPosition.accuracy.toFixed(0)}m)`
          );
          return;
        }

        setGpsStatus("GPS 연결 성공");

        let nextDistance = totalDistance.current;
        const previousPosition = lastAcceptedPosition.current;

        if (previousPosition) {
          const movedDistance = calculateDistanceMeters(
            previousPosition,
            currentPosition
          );
          const movedSeconds = Math.max(
            0.001,
            (timestamp - previousPosition.timestamp) / 1000
          );
          const measuredSpeed = movedDistance / movedSeconds;

          // 짧은 이동은 마지막 승인 위치를 유지해 다음 좌표와 합산되도록 한다.
          if (movedDistance < MIN_MOVEMENT_METERS) {
            return;
          }

          // 사람의 러닝 속도를 벗어난 순간이동은 GPS 튐으로 간주한다.
          if (measuredSpeed > MAX_RUNNING_SPEED_METERS_PER_SECOND) {
            setGpsStatus("GPS 위치가 불안정해 이동값을 제외했습니다.");
            return;
          }

          nextDistance += movedDistance;
        }

        const pointElapsedSeconds = Math.max(
          0,
          (timestamp - startTime) / 1000
        );
        const pathPoint = {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          timestamp,
          elapsedSeconds: pointElapsedSeconds,
          cumulativeDistance: nextDistance,
          accuracy: currentPosition.accuracy,
        };

        lastAcceptedPosition.current = currentPosition;
        totalDistance.current = nextDistance;
        setPath((previousPath) => [...previousPath, pathPoint]);
        setDistance(nextDistance);
        setAveragePace(
          calculateAveragePace(nextDistance, pointElapsedSeconds)
        );
      },
      (error) => {
        setGpsStatus(
          `GPS 오류 (${error.code}) : ${getGpsErrorMessage(error)}`
        );
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
  }, [startTime]);

  // interval은 화면 갱신 신호로만 사용하고 실제 시간은 시작 시각과의 차이로 계산한다.
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timerId = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTime) / 1000)
      );
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [isRunning, startTime]);

  // 5분마다 시간·거리·페이스와 과거 기록 비교를 한 번에 요약한다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning) {
      return;
    }

    const completedIntervals = Math.floor(
      elapsedSeconds / VOICE_PROGRESS_INTERVAL_SECONDS
    );

    if (
      completedIntervals <= 0 ||
      completedIntervals <= lastProgressIntervalRef.current
    ) {
      return;
    }

    const message = createProgressCoachMessage({
      elapsedSeconds,
      distance,
      currentPace,
      averagePace,
      comparison: pacemakerComparison,
    });

    if (speakCoachMessage(message)) {
      lastProgressIntervalRef.current = completedIntervals;
    }
  }, [
    averagePace,
    currentPace,
    distance,
    elapsedSeconds,
    isRunning,
    pacemakerComparison,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 거리 이정표는 1km마다 알려 화면을 보지 않고도 진행 상황을 확인하게 한다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning) {
      return;
    }

    const completedKilometers = Math.floor(distance / 1000);

    if (
      completedKilometers <= 0 ||
      completedKilometers <= lastKilometerRef.current
    ) {
      return;
    }

    const message = createKilometerCoachMessage({
      completedKilometers,
      elapsedSeconds,
      averagePace,
      comparison: pacemakerComparison,
    });

    if (speakCoachMessage(message)) {
      lastKilometerRef.current = completedKilometers;
    }
  }, [
    averagePace,
    distance,
    elapsedSeconds,
    isRunning,
    pacemakerComparison,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 앞섬·비슷함·뒤처짐 상태가 바뀐 경우에만 알려 반복 안내를 줄인다.
  useEffect(() => {
    if (
      !voiceCoachingEnabled ||
      !isRunning ||
      !pacemakerComparison
    ) {
      return;
    }

    const nextComparisonState = getTimeComparisonState(
      pacemakerComparison.timeDifference
    );

    if (comparisonStateRef.current === null) {
      comparisonStateRef.current = nextComparisonState;
      return;
    }

    if (
      nextComparisonState === comparisonStateRef.current ||
      elapsedSeconds - lastComparisonAnnouncementAtRef.current <
        COMPARISON_ANNOUNCEMENT_COOLDOWN_SECONDS
    ) {
      return;
    }

    const message = createComparisonCoachMessage(pacemakerComparison);

    if (speakCoachMessage(message)) {
      comparisonStateRef.current = nextComparisonState;
      lastComparisonAnnouncementAtRef.current = elapsedSeconds;
    }
  }, [
    elapsedSeconds,
    isRunning,
    pacemakerComparison,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 코스 이탈은 즉시 안내하고, 다시 코스로 돌아왔을 때도 복귀를 알려준다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning) {
      return;
    }

    if (isOffCourse === offCourseStateRef.current) {
      return;
    }

    const message = isOffCourse
      ? "과거 코스에서 벗어났습니다. 주변을 살피고 경로를 확인하세요."
      : "과거 코스로 복귀했습니다.";

    if (speakCoachMessage(message, { interrupt: isOffCourse })) {
      offCourseStateRef.current = isOffCourse;
    }
  }, [
    elapsedSeconds,
    isOffCourse,
    isRunning,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 페이지를 벗어날 때 남아 있는 음성 재생도 함께 정리한다.
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleToggleVoiceCoaching() {
    if (!voiceCoachingSupported) {
      return;
    }

    if (voiceCoachingEnabled) {
      window.speechSynthesis.cancel();
      activeUtteranceRef.current = null;
      setVoiceCoachingEnabled(false);
      setLastVoiceCoachMessage("음성 코칭을 껐습니다.");
      return;
    }

    // 사용자가 켠 시점 이전의 이정표를 뒤늦게 읽지 않도록 기준값을 맞춘다.
    lastProgressIntervalRef.current = Math.floor(
      elapsedSeconds / VOICE_PROGRESS_INTERVAL_SECONDS
    );
    lastKilometerRef.current = Math.floor(distance / 1000);
    comparisonStateRef.current = pacemakerComparison
      ? getTimeComparisonState(pacemakerComparison.timeDifference)
      : null;
    lastComparisonAnnouncementAtRef.current = elapsedSeconds;
    offCourseStateRef.current = isOffCourse;

    setVoiceCoachingEnabled(true);
    speakCoachMessage(
      selectedPacer && pacemakerProfile.mode !== "unavailable"
        ? "음성 코칭을 시작합니다. 과거의 나와 비교하며 안내하겠습니다. 안전하게 달리세요."
        : "음성 코칭을 시작합니다. 거리와 페이스를 안내하겠습니다. 안전하게 달리세요.",
      { interrupt: true }
    );
  }

  function handleTestVoiceCoaching() {
    speakCoachMessage(
      createProgressCoachMessage({
        elapsedSeconds,
        distance,
        currentPace,
        averagePace,
        comparison: pacemakerComparison,
      }),
      { interrupt: true }
    );
  }

  function handleStopRunning() {
    if (!isRunning) {
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const endTime = Date.now();
    const finalElapsedSeconds = Math.floor(
      (endTime - startTime) / 1000
    );
    const finalAveragePace = calculateAveragePace(
      totalDistance.current,
      finalElapsedSeconds
    );
    const lastPoint = path.at(-1);
    const recordedPath = lastPoint
      ? [
          ...path,
          {
            ...lastPoint,
            timestamp: endTime,
            elapsedSeconds: finalElapsedSeconds,
          },
        ]
      : path;
    const runRecord = {
      recordVersion: 2,
      id: Date.now(),
      startTime,
      endTime,
      elapsedTime: finalElapsedSeconds,
      distance: totalDistance.current,
      pace: finalAveragePace,
      path: recordedPath,
      createdAt: new Date().toISOString(),
    };
    const existingRecords = loadRunningRecords();

    existingRecords.push(runRecord);
    localStorage.setItem(
      "runningRecords",
      JSON.stringify(existingRecords)
    );

    setElapsedSeconds(finalElapsedSeconds);
    setIsRunning(false);
    setGpsStatus("러닝 종료 및 기록 저장 완료");

    if (voiceCoachingEnabled) {
      speakCoachMessage(
        createFinishCoachMessage({
          elapsedSeconds: finalElapsedSeconds,
          distance: totalDistance.current,
          averagePace: finalAveragePace,
        }),
        { interrupt: true }
      );
      setVoiceCoachingEnabled(false);
    }
  }

  return (
    <div>
      <h1>Live Run</h1>

      <h3>{gpsStatus}</h3>

      <hr />

      <h2>🔊 TTS 음성 코칭</h2>

      {voiceCoachingSupported ? (
        <>
          <button type="button" onClick={handleToggleVoiceCoaching}>
            {voiceCoachingEnabled ? "음성 코칭 끄기" : "음성 코칭 켜기"}
          </button>{" "}
          <button type="button" onClick={handleTestVoiceCoaching}>
            현재 상태 듣기
          </button>
          <p>
            자동 안내 : 1km 통과, 5분 진행 요약, 과거 기록과의 상태 변화,
            코스 이탈·복귀, 러닝 종료
          </p>
          <p>
            상태 : {voiceCoachingEnabled ? "자동 안내 켜짐" : "자동 안내 꺼짐"}
          </p>
          {lastVoiceCoachMessage && (
            <p>마지막 음성 안내 : {lastVoiceCoachMessage}</p>
          )}
        </>
      ) : (
        <p>이 브라우저는 음성 합성 기능을 지원하지 않습니다.</p>
      )}

      {selectedPacer && (
        <>
          <hr />

          <h2>🏃 과거의 나</h2>

          <p>
            과거 총 거리 :{" "}
            {(selectedPacer.distance / 1000).toFixed(2)} km
          </p>

          <p>
            과거 평균 페이스 : {formatPace(selectedPacer.pace)}
          </p>

          {pacemakerProfile.mode === "estimated" && (
            <p>
              기존 기록에는 좌표별 시간이 없어 전체 기록으로
              페이스를 추정합니다.
            </p>
          )}
        </>
      )}

      {selectedPacer && pacemakerProfile.mode === "unavailable" && (
        <>
          <hr />
          <p>선택한 기록에는 페이스메이커 계산에 필요한 경로가 없습니다.</p>
        </>
      )}

      {pacemakerComparison && (
        <>
          <hr />

          <h2>⏱ 실시간 페이스메이커</h2>

          <p>현재 페이스 : {formatPace(currentPace)}</p>
          <p>
            같은 시각 과거 페이스 :{" "}
            {formatPace(pacemakerComparison.ghostPace)}
          </p>
          <p>
            현재 거리 : {(distance / 1000).toFixed(2)} km
          </p>
          <p>
            같은 시각 과거 거리 :{" "}
            {(pacemakerComparison.ghostDistance / 1000).toFixed(2)} km
          </p>
          <p>
            남은 코스 :{" "}
            {(pacemakerComparison.remainingDistance / 1000).toFixed(2)} km
          </p>

          <h3>
            {pacemakerComparison.distanceDifference > 10
              ? `🟢 과거의 나보다 ${pacemakerComparison.distanceDifference.toFixed(0)}m 앞서고 있습니다.`
              : pacemakerComparison.distanceDifference < -10
                ? `🔴 과거의 나보다 ${Math.abs(pacemakerComparison.distanceDifference).toFixed(0)}m 뒤처져 있습니다.`
                : "🟡 과거의 나와 비슷한 거리입니다."}
          </h3>

          <h3>
            {pacemakerComparison.timeDifference > 1
              ? `과거의 나보다 ${formatTimeDifference(pacemakerComparison.timeDifference)} 빠릅니다.`
              : pacemakerComparison.timeDifference < -1
                ? `과거의 나보다 ${formatTimeDifference(pacemakerComparison.timeDifference)} 느립니다.`
                : "과거의 나와 비슷한 시간입니다."}
          </h3>

          <p>
            과거 코스와 현재 위치 거리 :{" "}
            {pacemakerComparison.routeDistance?.toFixed(1) ?? "-"} m
          </p>

          {isOffCourse && (
            <h3>⚠️ 과거 코스에서 벗어났습니다. 경로를 확인하세요.</h3>
          )}
        </>
      )}

      <hr />

      {/* 빨간 실선은 현재 경로, 파란 점선은 비교할 과거 경로다. */}
      <KakaoMap
        latitude={location.latitude}
        longitude={location.longitude}
        path={path}
        pastPath={selectedPacer?.path ?? []}
      />

      <hr />

      <p>위도 : {location.latitude ?? "-"}</p>
      <p>경도 : {location.longitude ?? "-"}</p>
      <p>
        속도 :{" "}
        {location.speed != null ? location.speed.toFixed(2) : "-"} m/s
      </p>
      <p>
        GPS 정확도 :{" "}
        {location.accuracy != null
          ? `±${location.accuracy.toFixed(0)}m`
          : "-"}
      </p>

      <hr />

      <h2>경과 시간 : {formatElapsedTime(elapsedSeconds)}</h2>
      <h2>총 거리 : {(distance / 1000).toFixed(2)} km</h2>
      <h2>현재 페이스 : {formatPace(currentPace)}</h2>
      <h2>평균 페이스 : {formatPace(averagePace)}</h2>

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
