// 소상공인 상가(상권)정보 API → Supabase
// 대구(27) 음식점(I2) 전체와 대구 주요상권 폴리곤을 받아 daegu_stores / daegu_zones 에 저장한다.
// 데이터가 분기별로 갱신되니 분기마다 한 번 실행하면 된다:  node scripts/sync_sdsc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const { SDSC_SERVICE_KEY, SYNC_TOKEN } = { ...env, ...process.env };
const SUPABASE_URL = 'https://zykkrfqeutjukffryjeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R69VC2k6AfMuHPi8keFcbA_Vds7wcJw';
const API = 'https://apis.data.go.kr/B553077/api/open/sdsc2/';

async function sdsc(op, params) {
  const qs = new URLSearchParams({ ...params, type: 'json' });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${op}?${qs}&serviceKey=${SDSC_SERVICE_KEY}`);
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (j.header?.resultCode !== '00') throw new Error(`${j.header?.resultCode} ${j.header?.resultMsg}`);
      return j.body;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${op} 실패: ${e.message} ${text.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function rpc(fn, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: SYNC_TOKEN, rows }),
  });
  if (!res.ok) throw new Error(`${fn} 실패: ${res.status} ${await res.text()}`);
  return res.json();
}

// 1) 주요상권 폴리곤
const zones = (await sdsc('storeZoneInAdmi', { divId: 'ctprvnCd', key: '27' })).items;
await rpc('upsert_daegu_zones', zones.map((z) => ({ trar_no: z.trarNo, name: z.mainTrarNm, signgu: z.signguNm, wkt: z.coords })));
console.log(`상권 ${zones.length}곳 저장`);

// 2) 음식점 전체 (페이지당 1000건)
const PAGE = 1000;
let page = 1, total = Infinity, saved = 0;
while ((page - 1) * PAGE < total) {
  const body = await sdsc('storeListInDong', { divId: 'ctprvnCd', key: '27', indsLclsCd: 'I2', numOfRows: PAGE, pageNo: page });
  total = body.totalCount;
  const rows = (body.items ?? []).filter((s) => s.lon && s.lat).map((s) => ({
    bizes_id: s.bizesId, name: s.bizesNm, branch: s.brchNm, mcls: s.indsMclsNm, scls: s.indsSclsNm,
    signgu: s.signguNm, adong: s.adongNm, ldong: s.ldongNm,
    road: (s.rdnm || '').split(' ').pop(), road_addr: s.rdnmAdr, bld_name: s.bldNm, floor: s.flrNo,
    lon: s.lon, lat: s.lat,
  }));
  saved += await rpc('upsert_daegu_stores', rows);
  process.stdout.write(`\r음식점 ${saved} / ${total}`);
  page++;
}
console.log('\n완료');
