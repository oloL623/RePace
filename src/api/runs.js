import { apiRequest } from "./apiClient";

export function startServerRun({ accessToken, courseId = null }) {
  return apiRequest("/runs/start", {
    method: "POST",
    accessToken,
    body: { course_id: courseId },
  });
}

export function finishServerRun({
  accessToken,
  runId,
  endTime,
  totalDistance,
  totalTime,
  gpsPath,
  splits,
  ghostRunId = null,
  isPublic = false,
}) {
  return apiRequest(`/runs/${runId}/finish`, {
    method: "POST",
    accessToken,
    body: {
      end_time: endTime,
      total_distance: totalDistance,
      total_time: totalTime,
      gps_path: gpsPath,
      splits,
      ghost_run_id: ghostRunId,
      is_public: isPublic,
    },
  });
}

export function getServerRunFeedback(runId) {
  return apiRequest(`/runs/${runId}/feedback`);
}

export function getMyBestRun({ accessToken, courseId = null }) {
  const query = Number.isInteger(courseId)
    ? `?course_id=${courseId}`
    : "";

  return apiRequest(`/runs/me/best${query}`, { accessToken });
}
