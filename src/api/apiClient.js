import { refreshAccessToken } from "../lib/supabase.js";

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

export async function retryUnauthorizedResponse(
  response,
  { accessToken, request, refresh = refreshAccessToken }
) {
  if (response.status !== 401 || !accessToken) {
    return response;
  }

  try {
    const refreshedToken = await refresh();
    return refreshedToken ? request(refreshedToken) : response;
  } catch {
    return response;
  }
}

export async function apiRequest(
  path,
  { method = "GET", accessToken, body, signal } = {}
) {
  if (!isBackendConfigured) {
    throw new ApiError("백엔드 주소가 설정되지 않았습니다.");
  }

  const request = async (token) => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method,
        signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }

      throw new ApiError(
        "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        { code: "NETWORK_ERROR" }
      );
    }
  };

  let response = await request(accessToken);
  response = await retryUnauthorizedResponse(response, {
    accessToken,
    request,
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
