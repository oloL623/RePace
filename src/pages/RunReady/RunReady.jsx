import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import {
  DEFAULT_RUN_PREFERENCES,
  isValidTargetDistanceInput,
  loadRunPreferences,
  parseTargetPaceMinutes,
  saveRunPreferences,
} from "../../utils/runPreferences";
import "./RunReady.css";

function loadSelectedPacer() {
  try {
    const saved = localStorage.getItem("selectedPacerRecord");

    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("선택한 비교 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

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

  return `${minutes}'${String(seconds).padStart(2, "0")}''`;
}

function splitPace(pace) {
  const safePace = Number.isFinite(pace)
    ? pace
    : DEFAULT_RUN_PREFERENCES.targetPaceMinutes;
  let minutes = Math.floor(safePace);
  let seconds = Math.round((safePace - minutes) * 60);

  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return {
    minutes: String(minutes),
    seconds: String(seconds).padStart(2, "0"),
  };
}

// 준비 화면에서도 오늘의 목표와 비교 기록을 바탕으로 바로 실행할 수 있는 조언을 보여준다.
function createTodayStrategy({ targetDistanceKilometers, targetPaceMinutes, selectedPacer }) {
  const targetPace = `${formatPace(targetPaceMinutes)}/km`;
  const targetDistance = `${Number(targetDistanceKilometers.toFixed(2))}km`;

  return [
    `첫 5분은 목표 페이스 ${targetPace}보다 천천히 시작해 몸을 풀어보세요.`,
    selectedPacer
      ? `${selectedPacer.isSharedCourse ? "공유 코스" : "과거 기록"}의 ${formatPace(selectedPacer.pace)} 페이스를 기준으로 무리하지 않고 리듬을 맞춰보세요.`
      : `${targetDistance}를 완주할 수 있도록 중간에도 대화가 가능한 호흡을 유지해보세요.`,
    "마지막 구간에 힘이 남으면 보폭보다 팔치기를 먼저 가볍게 끌어올려 보세요.",
  ];
}

function RunReady() {
  const navigate = useNavigate();
  const [selectedPacer, setSelectedPacer] = useState(loadSelectedPacer);
  const [preferences, setPreferences] = useState(loadRunPreferences);
  const [targetDistanceInput, setTargetDistanceInput] = useState(
    () => String(preferences.targetDistanceKilometers)
  );
  const [targetPaceInput, setTargetPaceInput] = useState(
    () => splitPace(preferences.targetPaceMinutes)
  );
  const targetDistanceKilometers = Number(targetDistanceInput) || 0;
  const parsedTargetPaceMinutes = parseTargetPaceMinutes(
    targetPaceInput.minutes,
    targetPaceInput.seconds
  );
  const canStartRunning =
    targetDistanceKilometers > 0 && parsedTargetPaceMinutes !== null;
  const todayStrategy = createTodayStrategy({
    targetDistanceKilometers:
      targetDistanceKilometers || DEFAULT_RUN_PREFERENCES.targetDistanceKilometers,
    targetPaceMinutes:
      parsedTargetPaceMinutes ?? DEFAULT_RUN_PREFERENCES.targetPaceMinutes,
    selectedPacer,
  });

  function updatePreference(name, value) {
    setPreferences((current) => ({ ...current, [name]: value }));
  }

  function handleRemovePacer() {
    localStorage.removeItem("selectedPacerRecord");
    sessionStorage.removeItem("selectedSharedCourse");
    setSelectedPacer(null);
  }

  function handleDistanceChange(value) {
    const nextValue = value.replace(",", ".");

    if (isValidTargetDistanceInput(nextValue)) {
      setTargetDistanceInput(nextValue);
    }
  }

  function handlePacePartChange(name, value) {
    if (!/^\d{0,2}$/.test(value)) {
      return;
    }

    if (name === "seconds" && value !== "" && Number(value) > 59) {
      return;
    }

    setTargetPaceInput((current) => ({ ...current, [name]: value }));
  }

  function handleStartRunning() {
    if (!canStartRunning) {
      return;
    }

    saveRunPreferences({
      ...preferences,
      targetDistanceKilometers,
      targetPaceMinutes: parsedTargetPaceMinutes,
    });
    navigate("/live-run");
  }

  return (
    <PageShell className="ready-screen">
      <p className="page-kicker">READY TO RUN</p>
      <h1 className="page-title">달리기 준비 완료</h1>
      <p className="page-description">오늘의 목표를 확인하고 나만의 페이스로 출발하세요.</p>

      <section className="ready-goals" aria-label="러닝 목표 설정">
        <label>
          <span>목표 거리</span>
          <div className="ready-distance-input">
            <input
              type="text"
              inputMode="decimal"
              maxLength={5}
              aria-label="목표 거리 킬로미터"
              value={targetDistanceInput}
              onChange={(event) => handleDistanceChange(event.target.value)}
            />
            <span className="ready-goal-unit">km</span>
          </div>
        </label>
        <label>
          <span>목표 페이스</span>
          <div className="ready-pace-inputs">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              aria-label="목표 페이스 분"
              value={targetPaceInput.minutes}
              onChange={(event) =>
                handlePacePartChange("minutes", event.target.value)
              }
            />
            <span className="ready-pace-mark" aria-hidden="true">′</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              aria-label="목표 페이스 초"
              value={targetPaceInput.seconds}
              onChange={(event) =>
                handlePacePartChange("seconds", event.target.value)
              }
              onBlur={() => {
                if (targetPaceInput.seconds !== "") {
                  handlePacePartChange(
                    "seconds",
                    String(Number(targetPaceInput.seconds)).padStart(2, "0")
                  );
                }
              }}
            />
            <span className="ready-goal-unit">″/km</span>
          </div>
        </label>
      </section>

      <section className="ready-strategy-card" aria-labelledby="today-strategy-title">
        <div>
          <span>AI RUN PLAN</span>
          <h2 id="today-strategy-title">오늘의 달리기 전략</h2>
        </div>
        <ol>
          {todayStrategy.map((strategy, index) => (
            <li key={strategy}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{strategy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ready-card">
        <div className="ready-card__heading">
          <div>
            <span>{selectedPacer?.isSharedCourse ? "SHARED COURSE" : "PACE MAKER"}</span>
            <h2>
              {selectedPacer?.isSharedCourse
                ? `${selectedPacer.title}에 도전해요`
                : selectedPacer
                  ? "과거의 나와 함께 달려요"
                  : "새로운 기록을 만들어요"}
            </h2>
          </div>
          <span className="ready-card__icon" aria-hidden="true">🐯</span>
        </div>

        {selectedPacer ? (
          <>
            <div className="ready-pacer-stats">
              <div><strong>{(selectedPacer.distance / 1000).toFixed(2)}</strong><span>km</span></div>
              <div><strong>{Math.floor(selectedPacer.elapsedTime / 60)}</strong><span>분</span></div>
              <div><strong>{formatPace(selectedPacer.pace)}</strong><span>페이스</span></div>
            </div>
            <button className="ready-link-button" type="button" onClick={handleRemovePacer}>
              {selectedPacer.isSharedCourse ? "공유 코스 선택 해제" : "과거 기록 비교 해제"}
            </button>
          </>
        ) : (
          <p>비교 기록 없이 자유롭게 달립니다. 종료 후 오늘 기록을 다음 페이스메이커로 선택할 수 있어요.</p>
        )}
      </section>

      <section className="ready-voice-card">
        <div>
          <span aria-hidden="true">🔊</span>
          <div>
            <strong>음성 페이스 코칭</strong>
            <p>기록 차이와 페이스 변화를 달리는 중 알려드려요.</p>
          </div>
        </div>
        <label className="switch" aria-label="음성 코칭 사용">
          <input
            type="checkbox"
            checked={preferences.voiceCoachingEnabled}
            onChange={(event) => updatePreference("voiceCoachingEnabled", event.target.checked)}
          />
          <span />
        </label>
      </section>

      <button
        className="primary-button full-button ready-start"
        type="button"
        disabled={!canStartRunning}
        onClick={handleStartRunning}
      >
        달리기 시작
      </button>
    </PageShell>
  );
}

export default RunReady;
