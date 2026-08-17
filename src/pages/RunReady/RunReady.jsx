import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import { loadRunPreferences, saveRunPreferences } from "../../utils/runPreferences";
import runningCat from "../../assets/runningcat.png";
import "./RunReady.css";

function loadSelectedPacer() {
  try {
    const saved = localStorage.getItem("selectedPacerRecord");

    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("선택한 과거 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

function loadSelectedCourse() {
  try {
    const saved = sessionStorage.getItem("selectedSharedCourse");
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("선택한 공유 코스를 불러오지 못했습니다.", error);
    return null;
  }
}

function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);

  return `${minutes}'${String(seconds).padStart(2, "0")}`;
}

function RunReady() {
  const navigate = useNavigate();
  const [selectedPacer, setSelectedPacer] = useState(loadSelectedPacer);
  const [selectedCourse, setSelectedCourse] = useState(loadSelectedCourse);
  const [preferences, setPreferences] = useState(loadRunPreferences);
  const hasPastRecord = Boolean(selectedPacer);
  const hasSelectedCourse = Boolean(selectedCourse);
  // 백엔드의 사전 AI 분석 API가 연결되면 이 필드에 전략 문장 배열을 넣어 표시한다.
  const aiStrategy = selectedPacer?.preRunStrategy ?? selectedCourse?.preRunStrategy ?? null;

  function updatePreference(name, value) {
    setPreferences((current) => ({ ...current, [name]: value }));
  }

  function handleRemovePacer() {
    localStorage.removeItem("selectedPacerRecord");
    setSelectedPacer(null);
  }

  function handleStartRunning() {
    saveRunPreferences(preferences);
    navigate("/live-run");
  }

  function handleRemoveCourse() {
    sessionStorage.removeItem("selectedSharedCourse");
    setSelectedCourse(null);
  }

  return (
    <PageShell className="ready-screen">
      <p className="page-kicker">READY TO RUN</p>
      <h1 className="page-title">달리기 준비 완료</h1>
      <span className="ready-location">● 위치 확인 완료</span>

      <section className="ready-card">
        <div className="ready-card__heading">
          <div>
            <span>지난 기록과 달리기</span>
            <h2>{selectedCourse?.title ?? (selectedPacer ? "과거의 나와 함께 달려요" : "나만의 페이스로 달려요")}</h2>
          </div>
          <img className="ready-card__icon" src={runningCat} alt="" aria-hidden="true" />
        </div>
        {(hasPastRecord || hasSelectedCourse) ? <div className="ready-pacer-stats">
          <div><span>거리</span><strong>{hasSelectedCourse ? `${selectedCourse.distanceKilometers?.toFixed?.(2) ?? selectedCourse.distanceKilometers}km` : `${(selectedPacer.distance / 1000).toFixed(2)}km`}</strong></div>
          <div><span>{hasSelectedCourse ? "기준 기록" : "지난 기록"}</span><strong>{hasPastRecord ? `${Math.floor(selectedPacer.elapsedTime / 60)}:${String(selectedPacer.elapsedTime % 60).padStart(2, "0")}` : selectedCourse.recordTime ?? "기록 없음"}</strong></div>
          <div><span>평균 페이스</span><strong>{hasPastRecord ? `${formatPace(selectedPacer.pace)}/km` : selectedCourse.targetPace ?? "기록 없음"}</strong></div>
        </div> : <p className="ready-first-run-copy">아직 비교할 지난 기록이 없어요. 첫 러닝을 완주하면 다음부터 과거의 나와 페이스를 비교할 수 있어요.</p>}
        {selectedPacer && <button className="ready-link-button" type="button" onClick={handleRemovePacer}>과거 기록 비교 해제</button>}
      </section>

      <section className="ready-strategy-card"><h2>AI 오늘의 달리기 전략</h2>{Array.isArray(aiStrategy) && aiStrategy.length ? aiStrategy.map((message, index) => <p key={message}><b>{String(index + 1).padStart(2, "0")}</b>{message}</p>) : <p className="ready-first-run-copy">AI 사전 분석이 연결되면 선택한 기록과 목표를 바탕으로 오늘의 전략이 표시됩니다.</p>}</section>

      {selectedCourse && <button className="ready-link-button" type="button" onClick={handleRemoveCourse}>선택한 코스 해제</button>}

      <section className="ready-voice-card">
        <div>
          <span aria-hidden="true">🔊</span>
          <div>
            <strong>음성 코치</strong>
            <p>필요한 순간에만 알려드려요.</p>
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

      <button className="primary-button full-button ready-start" type="button" onClick={handleStartRunning}>
        달리기 시작
      </button>
    </PageShell>
  );
}

export default RunReady;


