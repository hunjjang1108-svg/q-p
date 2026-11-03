// POST /api/save-categories  { rows: [{ mcls, scls, is_restaurant, reason }] }
// admin.html이 크롬 AI로 판단한 업종 결과를 Supabase에 저장한다.
// 저장 토큰(SYNC_TOKEN)이 필요해서 운영자 PC의 로컬 개발 서버에서만 동작한다.
const SUPABASE_URL = 'https://zykkrfqeutjukffryjeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R69VC2k6AfMuHPi8keFcbA_Vds7wcJw';

export default async function handler(req, res) {
  if (process.env.VERCEL || !process.env.SYNC_TOKEN) return res.status(404).json({ error: '로컬 개발 서버에서만 쓸 수 있습니다' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_category_filter`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: process.env.SYNC_TOKEN, rows }),
  });
  const body = await r.text();
  return res.status(r.ok ? 200 : 502).json(r.ok ? { saved: Number(body) } : { error: body });
}
