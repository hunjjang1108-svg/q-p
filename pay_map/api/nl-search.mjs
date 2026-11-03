// POST /api/nl-search  { q: "동성로 근처 한식집" }
// → { area: "동성로", mcls: ["한식"], scls: [], keywords: [] }
// 화면은 area로 search_area를 부르고, 업종·키워드로 식당 목록을 거른다.
import { CATEGORIES } from '../ai.js';
import { askJson } from '../lib/gemini.mjs';

const SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string', description: '구획 이름 하나. 도로명(동성로), 동(범어동), 역(반월당역), 건물(현대백화점) 등. 없으면 빈 문자열.' },
    mcls: { type: 'array', items: { type: 'string', enum: Object.keys(CATEGORIES) } },
    scls: { type: 'array', items: { type: 'string', enum: Object.values(CATEGORIES).flat() } },
    keywords: { type: 'array', items: { type: 'string' }, description: '업종 분류로 표현 안 되는 메뉴·상호 키워드 (예: 삼겹살, 짬뽕)' },
  },
  required: ['area', 'mcls', 'scls', 'keywords'],
  additionalProperties: false,
};

const SYSTEM = `대구 식당 지도 서비스의 검색어를 구조화한다.
사용자는 "동성로 근처 한식집", "범어동 고기집", "반월당역 국밥" 같은 자연어로 검색한다.

- area: 검색어에서 장소(구획) 이름만 그대로 뽑는다. "근처", "주변", "쪽", "에서" 같은 말은 뺀다. "대구", "대구시"는 지역 전체라 area가 아니다.
- mcls / scls: 음식 종류를 아래 분류에 맞춘다. 결과는 mcls 또는 scls 중 하나라도 맞으면 보여 주므로,
  중분류 전체(한식집, 중식, 일식집)를 뜻할 때만 mcls를 쓰고, 특정 음식을 말하면 scls만 쓰고 mcls는 비운다.
  예) 한식집 → mcls [한식], scls [] / 고기집 → mcls [], scls [돼지고기 구이/찜, 소고기 구이/찜, 닭/오리고기 구이/찜] / 국밥집 → mcls [], scls [국/탕/찌개류]
- keywords: 분류로 좁히기 어려운 메뉴·상호 단어만 넣는다. 분류로 충분하면 비워 둔다.
- 음식 조건이 없으면 mcls, scls, keywords 모두 빈 배열.

분류:
${Object.entries(CATEGORIES).map(([m, s]) => `${m}: ${s.join(', ')}`).join('\n')}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const q = String(req.body?.q ?? '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: 'q가 비어 있습니다' });
  try {
    return res.status(200).json(await askJson({ system: SYSTEM, prompt: q, schema: SCHEMA }));
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'AI 호출 실패: ' + (e.message ?? e) });
  }
}
