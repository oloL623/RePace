const env = import.meta.env ?? {};
const configuredBaseUrl = env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredBaseUrl?.replace(/\/$/, "") ?? "";
export const isBackendConfigured = Boolean(API_BASE_URL);

export class ApiError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(
  path,
  { method = "GET", accessToken, body, signal } = {}
) {
  if (!isBackendConfigured) {
    throw new ApiError("백엔드 주소가 설정되지 않았습니다.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      Accept: "application/json",
      // 무료 ngrok 주소의 브라우저 경고 페이지 대신 API 응답을 받는다.
      "ngrok-skip-browser-warning": "1",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    // JSON이 아닌 오류 응답도 사용자에게 상태 코드와 함께 전달한다.
  }

  if (!response.ok || payload?.success === false) {
    const backendError = payload?.error;
    const message =
      backendError?.message ??
      payload?.detail ??
      `서버 요청에 실패했습니다. (${response.status})`;

    throw new ApiError(message, {
      status: response.status,
      code: backendError?.code ?? null,
    });
  }

  // 백엔드 공통 응답 형식의 data만 페이지에서 사용하도록 통일한다.
  return payload?.success === true ? payload.data : payload;
}
