// Gemini에게 JSON 스키마에 맞는 답을 받는 공통 함수.
// 키는 환경변수 GEMINI_API_KEY (Vercel 환경변수 / 로컬 .env.local).
// 모델은 GEMINI_MODEL로 바꿀 수 있다. 기본은 빠르고 싼 Flash-Lite.
import { GoogleGenAI } from '@google/genai';

let client = null;

/** 스키마에 맞춘 객체를 돌려준다. 키가 없거나 답이 비면 예외. */
export async function askJson({ system, prompt, schema }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const interaction = await client.interactions.create({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    system_instruction: system,
    input: prompt,
    response_format: { type: 'text', mime_type: 'application/json', schema },
    store: false,
  });
  if (!interaction.output_text) throw new Error('Gemini 응답이 비어 있습니다');
  return JSON.parse(interaction.output_text);
}
