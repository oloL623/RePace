import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import { getMyBestRun } from "../../api/runs";
import { isBackendConfigured } from "../../api/apiClient";
import { getAccessToken, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { normalizeServerRunRecord } from "../../utils/serverRunRecord";
import { loadRunPreferences, saveRunPreferences } from "../../utils/runPreferences";
import restingCat from "../../assets/cat-resting.png";
import "./Home.css";

function loadRunningRecords() {
  try {
    const records = JSON.parse(localStorage.getItem("runningRecords"));

    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error("저장된 러닝 기록을 불러오지 못했습니다.", error);
    return [];
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

function formatRunTime(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function RunSummary({ eyebrow, title, record, onSelect }) {
  if (!record) {
    return null;
  }

  return (
    <article className="home-record-card">
      <div>
        <span className="home-record-card__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="home-record-card__stats">
        <div>
          <strong>{formatRunTime(record.elapsedTime)}</strong>
          <span>시간</span>
        </div>
        <div>
          <strong>{(record.distance / 1000).toFixed(2)}</strong>
          <span>km</span>
        </div>
        <div>
          <strong>{formatPace(record.pace)}</strong>
          <span>평균 페이스</span>
        </div>
      </div>
      <button className="secondary-button full-button" type="button" onClick={() => onSelect(record)}>
        이 기록에 다시 도전하기
      </button>
    </article>
  );
}

function Home() {
  const navigate = useNavigate();
  const [records] = useState(loadRunningRecords);
  const [serverBestRecord, setServerBestRecord] = useState(null);
  const [serverMessage, setServerMessage] = useState("");
  const [runMode, setRunMode] = useState("new");
  const [targetDistance, setTargetDistance] = useState(5);

  const recentRecord = records.at(-1) ?? null;
  const localBestRecord = useMemo(
    () =>
      records
        .filter((record) => Number.isFinite(record.pace))
        .sort((recordA, recordB) => recordA.pace - recordB.pace)[0] ?? null,
    [records]
  );

  useEffect(() => {
    let isActive = true;

    if (!isBackendConfigured || !isSupabaseConfigured) {
      return undefined;
    }

    (async () => {
      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          return;
        }

        const serverRun = await getMyBestRun({ accessToken });
        const normalizedRecord = normalizeServerRunRecord(serverRun);

        if (isActive && normalizedRecord) {
          setServerBestRecord(normalizedRecord);
        }
      } catch (error) {
        if (isActive) {
          if (
            error.status === 404 &&
            error.message === "완료된 러닝 기록이 없습니다"
          ) {
            return;
          }

          if (error.code === "NETWORK_ERROR") {
            setServerMessage("서버 연결 대기 중 · 로컬 기록을 표시하고 있습니다.");
            return;
          }

          console.error("서버 최고 기록을 불러오지 못했습니다.", error);
          setServerMessage(`서버 기록 조회 실패: ${error.message}`);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  function prepareRun(record = null) {
    if (record) {
      localStorage.setItem("selectedPacerRecord", JSON.stringify(record));
    } else {
      localStorage.removeItem("selectedPacerRecord");
    }

    navigate("/run-ready");
  }

  function prepareNewRun() {
    saveRunPreferences({
      ...loadRunPreferences(),
      targetDistanceKilometers:
        targetDistance === "free" ? null : Number(targetDistance),
    });
    prepareRun();
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    navigate("/login");
  }

  const featuredRecord = serverBestRecord ?? localBestRecord ?? recentRecord;

  return (
    <PageShell
      className="home-screen"
      headerAction={
        <button className="home-logout" type="button" onClick={handleSignOut}>
          로그아웃
        </button>
      }
    >
      <section className="home-hero">
        <p className="page-kicker">TODAY&apos;S RUN</p>
        <h1 className="page-title">어떤 방식으로<br />달려볼까요?</h1>

        <div className="home-run-options">
          <button
            className={runMode === "new" ? "is-active" : ""}
            type="button"
            onClick={() => setRunMode("new")}
          >
            <span aria-hidden="true">▶</span>
            <strong>새로운 러닝</strong>
            <small>나만의 목표로 시작</small>
          </button>
          <button
            className={runMode === "past" ? "is-active" : ""}
            type="button"
            onClick={() => setRunMode("past")}
          >
            <span aria-hidden="true">↻</span>
            <strong>과거의 나</strong>
            <small>이전 기록에 도전</small>
          </button>
        </div>

        {runMode === "new" ? (
          <section className="home-goal-card">
            <div>
              <span>오늘의 목표</span>
              <strong>어느 정도 달려볼까요?</strong>
            </div>
            <div className="home-goal-options">
              {[3, 5, 10, "free"].map((distance) => (
                <button
                  key={distance}
                  className={targetDistance === distance ? "is-selected" : ""}
                  type="button"
                  onClick={() => setTargetDistance(distance)}
                >
                  {distance === "free" ? "자유 달리기" : `${distance}km`}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="home-past-card">
            <strong>과거의 나에게 도전해 볼까요?</strong>
            <p>저장된 러닝 기록을 고르면 그날의 페이스와 비교하며 달릴 수 있어요.</p>
          </section>
        )}
      </section>

      {featuredRecord ? (
        <RunSummary
          eyebrow={serverBestRecord ? "SERVER BEST" : "MY BEST"}
          title={serverBestRecord ? "서버 최고 기록" : "나의 좋은 페이스"}
          record={featuredRecord}
          onSelect={prepareRun}
        />
      ) : (
        <div className="home-first-run">
          <img src={restingCat} alt="" aria-hidden="true" />
          <div>
            <strong>첫 러닝을 기다리고 있어요.</strong>
            <p>달리기를 마치면 나만의 페이스가 여기에 쌓입니다.</p>
          </div>
        </div>
      )}

      {recentRecord && featuredRecord?.id !== recentRecord.id && (
        <RunSummary
          eyebrow="RECENT RUN"
          title="가장 최근 러닝"
          record={recentRecord}
          onSelect={prepareRun}
        />
      )}

      {serverMessage && <p className="status-message">{serverMessage}</p>}

      <button
        className="primary-button full-button home-start-button"
        type="button"
        onClick={runMode === "new" ? prepareNewRun : () => navigate("/my-page")}
      >
        {runMode === "new" ? "목표 설정하고 달리기 준비" : "지난 기록 선택하기"}
      </button>
    </PageShell>
  );
}

export default Home;
