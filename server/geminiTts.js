import { Buffer } from "node:buffer";

export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const DEFAULT_GEMINI_TTS_VOICE = "Sulafat";

const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_MESSAGE_LENGTH = 600;

export class GeminiTtsError extends Error {
  constructor(message, { status = 500, code = "GEMINI_TTS_ERROR" } = {}) {
    super(message);
    this.name = "GeminiTtsError";
    this.status = status;
    this.code = code;
  }
}

function normalizeMessage(message) {
  const normalizedMessage = typeof message === "string" ? message.trim() : "";

  if (!normalizedMessage) {
    throw new GeminiTtsError("읽을 문장이 필요합니다.", {
      status: 400,
      code: "MESSAGE_REQUIRED",
    });
  }

  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new GeminiTtsError(
      `음성 안내는 ${MAX_MESSAGE_LENGTH}자 이하여야 합니다.`,
      { status: 400, code: "MESSAGE_TOO_LONG" }
    );
  }

  return normalizedMessage;
}

export function createGeminiTtsRequest(message, {
  voice = DEFAULT_GEMINI_TTS_VOICE,
} = {}) {
  const transcript = normalizeMessage(message);

  return {
    contents: [{
      parts: [{
        text: [
          "# AUDIO PROFILE",
          "A bright, warm Korean female running coach with a natural, friendly, and encouraging voice.",
          "",
          "## THE SCENE",
          "An outdoor running session is in progress. The runner hears a short real-time update through earbuds.",
          "",
          "### DIRECTOR'S NOTES",
          "Speak clearly at a comfortable pace with moderate upbeat energy, without sounding overly excited.",
          "Keep a gentle smile in the voice. Sound lively, reassuring, and encouraging. Pronounce Korean numbers and running units clearly.",
          "Do not read these instructions or headings aloud.",
          "",
          "### SAMPLE CONTEXT",
          "This is live coaching based on the runner's elapsed time, distance, pace, or previous running record.",
          "",
          "#### TRANSCRIPT",
          "[brightly, warmly, encouraging]",
          "",
          transcript,
        ].join("\n"),
      }],
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        languageCode: "ko-KR",
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };
}

export function extractGeminiAudio(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];

    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part.inlineData;
      }
    }
  }

  throw new GeminiTtsError("Gemini 응답에 음성 데이터가 없습니다.", {
    status: 502,
    code: "AUDIO_DATA_MISSING",
  });
}

export function pcmToWaveBuffer(
  pcmData,
  {
    sampleRate = DEFAULT_SAMPLE_RATE,
    channels = DEFAULT_CHANNELS,
    bitsPerSample = BITS_PER_SAMPLE,
  } = {}
) {
  const pcmBuffer = Buffer.isBuffer(pcmData)
    ? pcmData
    : Buffer.from(pcmData);
  const headerSize = 44;
  const waveBuffer = Buffer.alloc(headerSize + pcmBuffer.length);
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  waveBuffer.write("RIFF", 0);
  waveBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  waveBuffer.write("WAVE", 8);
  waveBuffer.write("fmt ", 12);
  waveBuffer.writeUInt32LE(16, 16);
  waveBuffer.writeUInt16LE(1, 20);
  waveBuffer.writeUInt16LE(channels, 22);
  waveBuffer.writeUInt32LE(sampleRate, 24);
  waveBuffer.writeUInt32LE(byteRate, 28);
  waveBuffer.writeUInt16LE(blockAlign, 32);
  waveBuffer.writeUInt16LE(bitsPerSample, 34);
  waveBuffer.write("data", 36);
  waveBuffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(waveBuffer, headerSize);

  return waveBuffer;
}

function getGeminiErrorMessage(payload, status) {
  return (
    payload?.error?.message ??
    payload?.message ??
    `Gemini 음성 생성 요청에 실패했습니다. (${status})`
  );
}

export async function generateGeminiTtsAudio({
  message,
  apiKey,
  model = DEFAULT_GEMINI_TTS_MODEL,
  voice = DEFAULT_GEMINI_TTS_VOICE,
  signal,
  fetchImpl = fetch,
}) {
  const normalizedApiKey = apiKey?.trim();

  if (!normalizedApiKey) {
    throw new GeminiTtsError("GEMINI_API_KEY가 설정되지 않았습니다.", {
      status: 503,
      code: "GEMINI_API_KEY_MISSING",
    });
  }

  const endpoint = `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": normalizedApiKey,
    },
    body: JSON.stringify(createGeminiTtsRequest(message, { voice })),
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    // JSON이 아닌 오류 응답은 아래에서 상태 코드와 함께 처리한다.
  }

  if (!response.ok) {
    throw new GeminiTtsError(
      getGeminiErrorMessage(payload, response.status),
      { status: 502, code: "GEMINI_UPSTREAM_ERROR" }
    );
  }

  const audio = extractGeminiAudio(payload);
  const decodedAudio = Buffer.from(audio.data, "base64");

  if (decodedAudio.length === 0) {
    throw new GeminiTtsError("Gemini가 빈 음성 데이터를 반환했습니다.", {
      status: 502,
      code: "EMPTY_AUDIO_DATA",
    });
  }

  const mimeType = (audio.mimeType ?? "").toLowerCase();

  if (mimeType.startsWith("audio/wav")) {
    return { buffer: decodedAudio, mimeType: "audio/wav" };
  }

  return {
    buffer: pcmToWaveBuffer(decodedAudio, {
      sampleRate: DEFAULT_SAMPLE_RATE,
      channels: DEFAULT_CHANNELS,
    }),
    mimeType: "audio/wav",
  };
}
