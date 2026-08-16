import { Buffer } from "node:buffer";
import process from "node:process";
import { loadEnv } from "vite";
import {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_VOICE,
  GeminiTtsError,
  generateGeminiTtsAudio,
} from "./geminiTts.js";

const TTS_ROUTE = "/api/voice-coach/tts";
const MAX_REQUEST_BYTES = 4_096;
const REQUEST_TIMEOUT_MILLISECONDS = 45_000;
const MAX_CACHE_ENTRIES = 40;

async function readJsonBody(request) {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;

    if (receivedBytes > MAX_REQUEST_BYTES) {
      throw new GeminiTtsError("음성 생성 요청이 너무 큽니다.", {
        status: 413,
        code: "REQUEST_TOO_LARGE",
      });
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GeminiTtsError("올바른 JSON 요청이 아닙니다.", {
      status: 400,
      code: "INVALID_JSON",
    });
  }
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendAudio(response, audio) {
  response.statusCode = 200;
  response.setHeader("Content-Type", audio.mimeType);
  response.setHeader("Content-Length", audio.buffer.length);
  response.setHeader("Cache-Control", "private, max-age=300");
  response.end(audio.buffer);
}

function addToCache(cache, key, audio) {
  cache.set(key, audio);

  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function createTtsMiddleware({ apiKey, model, voice }) {
  const cache = new Map();

  return async function geminiTtsMiddleware(request, response, next) {
    const pathname = new URL(request.url, "http://localhost").pathname;

    if (pathname !== TTS_ROUTE) {
      next();
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, {
        error: { code: "METHOD_NOT_ALLOWED", message: "POST 요청만 지원합니다." },
      });
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      REQUEST_TIMEOUT_MILLISECONDS
    );

    try {
      const body = await readJsonBody(request);
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const cacheKey = `${model}\n${voice}\n${message}`;
      const cachedAudio = cache.get(cacheKey);

      if (cachedAudio) {
        sendAudio(response, cachedAudio);
        return;
      }

      const audio = await generateGeminiTtsAudio({
        message,
        apiKey,
        model,
        voice,
        signal: abortController.signal,
      });

      addToCache(cache, cacheKey, audio);
      sendAudio(response, audio);
    } catch (error) {
      const isTimeout = error?.name === "AbortError";
      const status = isTimeout ? 504 : error?.status ?? 500;
      const code = isTimeout ? "GEMINI_TTS_TIMEOUT" : error?.code ?? "GEMINI_TTS_ERROR";
      const message = isTimeout
        ? "Gemini 음성 생성 시간이 초과되었습니다."
        : error?.message ?? "음성 생성 중 오류가 발생했습니다.";

      sendJson(response, status, { error: { code, message } });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export function createGeminiTtsPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const middleware = createTtsMiddleware({
    apiKey: (env.GEMINI_API_KEY || env.GOOGLE_API_KEY)?.trim(),
    model: env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL,
    voice: env.GEMINI_TTS_VOICE?.trim() || DEFAULT_GEMINI_TTS_VOICE,
  });

  return {
    name: "repace-gemini-voice-coach",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
