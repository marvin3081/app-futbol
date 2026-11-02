const BASE = 'https://sportapi.ai/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = (process.env.SPORTAPI_API_KEY || process.env.SPORTAPI_KEY || '').trim();
  if (!key) return res.status(500).json({ error: 'Falta SPORTAPI_API_KEY en Vercel' });

  const { type = 'leagues', slug = '', id = '', league = '', date = '', a = '', b = '' } = req.query;

  const okSlug = /^[a-z0-9-]+$/;
  let path, ttl;

  if (type === 'leagues') {
    path = '/leagues'; ttl = 86400;
  } else if (type === 'league') {
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'id inválido' });
    path = `/leagues/${id}`; ttl = 21600;
  } else if (type === 'standings') {
    if (!okSlug.test(league)) return res.status(400).json({ error: 'league inválida' });
    path = `/standings/${league}`; ttl = 3600;
  } else if (type === 'team') {
    if (!okSlug.test(slug)) return res.status(400).json({ error: 'slug inválido' });
    path = `/teams/slug/${slug}`; ttl = 3600;
  } else if (type === 'team_id') {
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'id inválido' });
    path = `/teams/${id}`; ttl = 3600;
  } else if (type === 'h2h') {
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return res.status(400).json({ error: 'equipos inválidos' });
    path = `/fixtures/h2h/${a}/${b}`; ttl = 21600;
  } else if (type === 'day') {
    const f = date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return res.status(400).json({ error: 'fecha inválida' });
    path = `/fixtures/date/${f}`; ttl = 900;
  } else {
    return res.status(400).json({ error: 'Tipo no soportado' });
  }

  try {
    const r = await fetch(BASE + path, {
      headers: { 'X-Api-Key': key, 'Accept': 'application/json' }
    });
    const texto = await r.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = null; }

    const remaining = r.headers.get('x-ratelimit-remaining');
    const monthRemaining = r.headers.get('x-ratelimit-month-remaining');

    if (!r.ok || !json || json.success === false) {
      return res.status(r.status === 200 ? 502 : r.status).json({
        error: json?.error || `SportAPI respondió ${r.status}`,
        path, remaining, monthRemaining
      });
    }

    res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=600`);
    return res.status(200).json({ ...json, remaining, monthRemaining });
  } catch (e) {
    return res.status(500).json({ error: 'Error de conexión', details: e.message });
  }
}