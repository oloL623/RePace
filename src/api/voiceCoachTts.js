const VOICE_COACH_TTS_ENDPOINT = "/api/voice-coach/tts";

export class VoiceCoachTtsError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.name = "VoiceCoachTtsError";
    this.status = status;
    this.code = code;
  }
}

export async function requestCoachSpeech(message, { signal } = {}) {
  const response = await fetch(VOICE_COACH_TTS_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Accept: "audio/wav",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    let payload = null;

    try {
      payload = await response.json();
    } catch {
      // JSON이 아닌 오류 응답도 상태 코드와 함께 처리한다.
    }

    throw new VoiceCoachTtsError(
      payload?.error?.message ??
        `Gemini 음성 생성 요청에 실패했습니다. (${response.status})`,
      {
        status: response.status,
        code: payload?.error?.code ?? null,
      }
    );
  }

  const audioBlob = await response.blob();

  if (audioBlob.size === 0) {
    throw new VoiceCoachTtsError("생성된 음성 데이터가 비어 있습니다.", {
      status: response.status,
      code: "EMPTY_AUDIO_RESPONSE",
    });
  }

  return audioBlob;
}
