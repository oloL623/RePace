import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getServerRunFeedback } from "../../api/runs";
import { isBackendConfigured } from "../../api/apiClient";
import PageShell from "../../components/PageShell";
import { createSegmentAnalysisSummary } from "../../utils/runSplits";
import "./AiCoaching.css";

function loadRecord(recordId) {
  try {
    const records = JSON.parse(localStorage.getItem("runningRecords"));

    if (!Array.isArray(records)) {
      return null;
    }

    return records.find((record) => String(record.id) === recordId) ??
      records.find((record) => record.serverRunId || record.aiFeedback) ??
      null;
  } catch (error) {
    console.error("AI 코칭 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

function saveFeedback(recordId, feedback) {
  try {
    const records = JSON.parse(localStorage.getItem("runningRecords"));

    if (!Array.isArray(records)) {
      return;
    }

    localStorage.setItem(
      "runningRecords",
      JSON.stringify(
        records.map((record) =>
          record.id === recordId
            ? {
                ...record,
                aiFeedback: feedback.ai_feedback_text ?? "",
                segmentAnalysis: feedback.segment_analysis ?? [],
              }
            : record
        )
      )
    );
  } catch (error) {
    console.error("AI 코칭 결과를 저장하지 못했습니다.", error);
  }
}

function AiCoaching() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [record, setRecord] = useState(() =>
    loadRecord(searchParams.get("record") ?? "")
  );
  const [feedbackStatus, setFeedbackStatus] = useState(() =>
    isBackendConfigured && Number.isInteger(Number(record?.serverRunId))
      ? "loading"
      : "idle"
  );
  const summary = useMemo(
    () => createSegmentAnalysisSummary(record?.segmentAnalysis),
    [record?.segmentAnalysis]
  );

  useEffect(() => {
    const runId = Number(record?.serverRunId);
    const recordId = record?.id;

    if (!Number.isInteger(runId) || !isBackendConfigured) {
      return undefined;
    }

    let isActive = true;

    getServerRunFeedback(runId)
      .then((feedback) => {
        if (!isActive) {
          return;
        }

        setRecord((current) => ({
          ...current,
          aiFeedback: feedback?.ai_feedback_text ?? "",
          segmentAnalysis: feedback?.segment_analysis ?? [],
        }));
        saveFeedback(recordId, feedback ?? {});
        setFeedbackStatus("ready");
      })
      .catch((error) => {
        if (isActive) {
          console.error("서버 AI 코칭을 불러오지 못했습니다.", error);
          setFeedbackStatus("error");
        }
      });

    return () => {
      isActive = false;
    };
  }, [record?.id, record?.serverRunId]);

  const headerAction = (
    <button
      className="ai-coaching-back"
      type="button"
      aria-label="러닝 기록으로 돌아가기"
      onClick={() => navigate("/result")}
    >
      ←
    </button>
  );

  if (!record) {
    return (
      <PageShell className="ai-coaching-screen" headerAction={headerAction} showNav={false}>
        <div className="empty-state ai-coaching-empty">
          <div>
            <p>분석할 러닝 기록을 찾지 못했어요.</p>
            <button className="primary-button" type="button" onClick={() => navigate("/result")}>
              러닝 기록 보기
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const analyzedDistance = Math.round(
    record.distance || (summary.segments.at(-1)?.km ?? 0) * 1000
  );
  const feedbackMessage = record.aiFeedback ||
    (!record.serverRunId
      ? "이 기록은 로컬에만 저장되어 백엔드 AI 분석이 없어요. 로그인과 서버 연결 상태에서 새 러닝을 완료하면 AI 코칭을 받을 수 있어요."
      : feedbackStatus === "loading"
      ? "AI 코칭 피드백을 불러오고 있어요."
      : "서버에 저장된 AI 코칭 피드백이 아직 없어요.");

  return (
    <PageShell className="ai-coaching-screen" headerAction={headerAction} showNav={false}>
      <p className="page-kicker ai-coaching-kicker">AI 코칭 가이드</p>
      <h1 className="page-title">구간별 페이스 분석</h1>
      <p className="page-description">
        {summary.hasGhostComparison
          ? "이전 기록을 바탕으로 페이스를 잃기 쉬운 구간을 분석했어요."
          : "이번 러닝의 구간별 페이스 변화를 분석했어요."}
      </p>

      <section className="ai-segment-card" aria-labelledby="segment-chart-title">
        <div className="ai-segment-card__header">
          <h2 id="segment-chart-title">구간 페이스 ({analyzedDistance}m 분석)</h2>
          <span>{summary.comparisonLabel}</span>
        </div>

        {summary.segments.length > 0 ? (
          <div className="ai-segment-chart" role="img" aria-label="킬로미터별 페이스 막대 그래프">
            {summary.segments.map((segment) => (
              <div className="ai-segment-chart__item" key={`${segment.km}-${segment.pace}`}>
                <strong>{segment.paceLabel}</strong>
                <div className="ai-segment-chart__track">
                  <span
                    className={segment.isWeakest ? "is-weakest" : ""}
                    style={{ height: `${segment.height}%` }}
                  />
                </div>
                <small>{segment.km}km</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="ai-segment-card__empty">1km 이상 달리면 구간별 분석이 표시됩니다.</p>
        )}

        {summary.weakestSegment && (
          <p className="ai-segment-warning">
            <span aria-hidden="true">△</span>
            {summary.weakestSegment.km}km 구간 (페이스 저하 구간) 집중 공략 필요!
          </p>
        )}
      </section>

      <section className="ai-feedback-card">
        <div className="ai-feedback-card__header">
          <div><span aria-hidden="true">〽</span><h2>AI 코치 피드백</h2></div>
          <span>LIVE</span>
        </div>
        <p>{feedbackMessage}</p>
        <div className="ai-live-example">
          <strong>🔊 LIVE 코칭 메시지 예시</strong>
          <p>“{summary.coachExample}”</p>
        </div>
      </section>

      {feedbackStatus === "error" && (
        <p className="ai-feedback-error">최신 분석을 불러오지 못해 저장된 결과를 표시하고 있어요.</p>
      )}
    </PageShell>
  );
}

export default AiCoaching;
