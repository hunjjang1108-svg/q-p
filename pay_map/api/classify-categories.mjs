// POST /api/classify-categories  { cats: [{ mcls, scls }] }
// → { decisions: [{ index, is_restaurant, reason }] }
// admin.html이 업종마다 "식당인지" Gemini에게 묻는다. 운영자 PC의 로컬 개발 서버에서만 동작한다.
import { askJson } from '../lib/gemini.mjs';

const SYSTEM = `대구 "비플페이 결제 가능 식당 지도"에 올릴 업종을 고른다.
이 지도는 사람들이 끼니를 해결하러 가는 식당을 찾는 용도다.

식당으로 본다: 식사를 파는 곳 (한식·중식·일식·양식·분식·치킨·피자·버거, 요리를 주로 파는 요리 주점, 일반에 열린 뷔페).
식당이 아니다: 음료·디저트가 중심인 곳(카페, 아이스크림, 떡/한과처럼 포장 판매 위주), 술과 접객이 중심인 유흥 주점·무도장,
일반인이 이용하기 어려운 곳(회사·기관 구내식당).
애매하면 식당 쪽으로 판단하고, reason에 한국어 한 문장으로 이유를 적는다.`;

const SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, is_restaurant: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['index', 'is_restaurant', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['decisions'],
  additionalProperties: false,
};

export default async function handler(req, res) {
  if (process.env.VERCEL) return res.status(404).json({ error: '로컬 개발 서버에서만 쓸 수 있습니다' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const cats = Array.isArray(req.body?.cats) ? req.body.cats : [];
  const list = cats.map((c, i) => `${i}. ${c.mcls} > ${c.scls}`).join('\n');
  try {
    const out = await askJson({ system: SYSTEM, prompt: `아래 업종 각각에 대해 판단해 줘. 번호(index)를 그대로 써.\n\n${list}`, schema: SCHEMA });
    return res.status(200).json({ decisions: (out.decisions ?? []).filter((d) => cats[d.index]) });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'AI 호출 실패: ' + (e.message ?? e) });
  }
}
