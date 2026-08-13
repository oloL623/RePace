import client from './client';

// 1. 러닝 시작 (POST /runs/start)
export const startRun = async (courseId) => {
  const response = await client.post('/runs/start', {
    course_id: courseId,
  });
  return response.data;
};

// 2. 내 최고 기록 조회 (GET /runs/me/best)
export const getMyBestRun = async (courseId) => {
  const response = await client.get('/runs/me/best', {
    params: { course_id: courseId }, // ?course_id=1 형태의 쿼리 스트링으로 전송
  });
  return response.data;
};

// 3. 고스트 러닝 정보 조회 (GET /runs/{run_id}/ghost)
export const getGhostRun = async (runId) => {
  const response = await client.get(`/runs/${runId}/ghost`);
  return response.data;
};

// 4. 러닝 종료/기록 저장 (POST /runs/{run_id}/finish)
export const finishRun = async (runId, runData) => {
  // runData 예시:
  // {
  //   end_time: "2026-08-12T12:36:40.301Z",
  //   total_distance: 5.2,
  //   total_time: 1800,
  //   gps_path: [[37.123, 127.123], ...],
  //   splits: [...],
  //   ghost_run_id: 0,
  //   is_public: true
  // }
  const response = await client.post(`/runs/${runId}/finish`, runData);
  return response.data;
};

// 5. 피드백 조회 (GET /runs/{run_id}/feedback)
export const getRunFeedback = async (runId) => {
  const response = await client.get(`/runs/${runId}/feedback`);
  return response.data;
};