import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyBestRun } from "../../api/runs";
import { isBackendConfigured } from "../../api/apiClient";
import {
  getAccessToken,
  isSupabaseConfigured,
  supabase,
} from "../../lib/supabase";
import { normalizeServerRunRecord } from "../../utils/serverRunRecord";

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

  return `${minutes}:${String(seconds).padStart(2, "0")} 분/km`;
}

function RunSummary({ title, record, onSelect }) {
  if (!record) {
    return null;
  }

  return (
    <section>
      <h2>{title}</h2>
      <p>거리 : {(record.distance / 1000).toFixed(2)} km</p>
      <p>시간 : {Math.floor(record.elapsedTime / 60)}분</p>
      <p>평균 페이스 : {formatPace(record.pace)}</p>
      <button type="button" onClick={() => onSelect(record)}>
        이 기록에 도전하기
      </button>
    </section>
  );
}

function Home() {
  const navigate = useNavigate();
  const [records] = useState(loadRunningRecords);
  const [serverBestRecord, setServerBestRecord] = useState(null);
  const [serverMessage, setServerMessage] = useState("");

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

  async function handleSignOut() {
    await supabase?.auth.signOut();
    navigate("/login");
  }

  return (
    <main>
      <h1>GhostRun</h1>
      <p>어떤 방식으로 달려볼까요?</p>

      <button type="button" onClick={() => prepareRun()}>
        새로운 러닝 준비
      </button>{" "}
      <button type="button" onClick={() => navigate("/result")}>
        전체 기록 보기
      </button>{" "}
      <button type="button" onClick={() => navigate("/shared-courses")}>
        공유 코스 보기
      </button>

      <RunSummary
        title="최근 러닝 기록"
        record={recentRecord}
        onSelect={prepareRun}
      />
      <RunSummary
        title={serverBestRecord ? "서버 최고 기록" : "로컬 최고 기록"}
        record={serverBestRecord ?? localBestRecord}
        onSelect={prepareRun}
      />

      {!recentRecord && !serverBestRecord && (
        <p>아직 저장된 러닝 기록이 없습니다. 첫 러닝을 시작해 보세요.</p>
      )}
      {serverMessage && <p>{serverMessage}</p>}

      <hr />
      <button type="button" onClick={handleSignOut}>
        로그아웃
      </button>
    </main>
  );
}

export default Home;
