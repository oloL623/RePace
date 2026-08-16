import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import {
  createGeminiTtsRequest,
  extractGeminiAudio,
  generateGeminiTtsAudio,
  pcmToWaveBuffer,
} from "./geminiTts.js";

test("Gemini TTS 요청은 한국어 단일 음성과 오디오 응답을 사용한다", () => {
  const request = createGeminiTtsRequest("3분 58초 동안 달리고 있어요.", {
    voice: "TestVoice",
  });

  assert.deepEqual(request.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(request.generationConfig.speechConfig.languageCode, "ko-KR");
  assert.equal(
    request.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
    "TestVoice"
  );
  assert.match(request.contents[0].parts[0].text, /## THE SCENE/);
  assert.match(request.contents[0].parts[0].text, /### SAMPLE CONTEXT/);
  assert.match(request.contents[0].parts[0].text, /\[brightly, warmly, encouraging\]/);
  assert.match(request.contents[0].parts[0].text, /3분 58초 동안 달리고 있어요/);
});

test("Generate Content 응답의 음성 블록을 찾는다", () => {
  const audio = extractGeminiAudio({
    candidates: [{
      content: {
        parts: [{ inlineData: { data: "cGNt", mimeType: "audio/L16" } }],
      },
    }],
  });

  assert.equal(audio.data, "cGNt");
  assert.equal(audio.mimeType, "audio/L16");
});

test("16비트 PCM을 브라우저가 재생할 수 있는 WAV로 감싼다", () => {
  const pcm = Buffer.from([0, 0, 1, 0]);
  const wave = pcmToWaveBuffer(pcm);

  assert.equal(wave.toString("ascii", 0, 4), "RIFF");
  assert.equal(wave.toString("ascii", 8, 12), "WAVE");
  assert.equal(wave.readUInt32LE(24), 24_000);
  assert.equal(wave.readUInt16LE(34), 16);
  assert.equal(wave.readUInt32LE(40), pcm.length);
  assert.deepEqual(wave.subarray(44), pcm);
});

test("Gemini 오디오 응답을 WAV 데이터로 반환한다", async () => {
  const pcm = Buffer.from([0, 0, 1, 0]);
  let capturedUrl = "";
  let capturedOptions = null;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: pcm.toString("base64"),
                  mimeType: "audio/L16;codec=pcm;rate=24000",
                },
              }],
            },
          }],
        };
      },
    };
  };

  const audio = await generateGeminiTtsAudio({
    message: "현재 상태를 알려드릴게요.",
    apiKey: "test-api-key",
    fetchImpl,
  });

  const requestBody = JSON.parse(capturedOptions.body);

  assert.match(
    capturedUrl,
    /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.1-flash-tts-preview:generateContent$/
  );
  assert.equal(capturedOptions.headers["x-goog-api-key"], "test-api-key");
  assert.deepEqual(requestBody.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(audio.mimeType, "audio/wav");
  assert.equal(audio.buffer.toString("ascii", 0, 4), "RIFF");
});

test("서버용 Gemini 키가 없으면 외부 요청 전에 실패한다", async () => {
  await assert.rejects(
    generateGeminiTtsAudio({
      message: "테스트",
      apiKey: "",
      fetchImpl: () => {
        throw new Error("호출되면 안 됨");
      },
    }),
    (error) => error.code === "GEMINI_API_KEY_MISSING" && error.status === 503
  );
});
