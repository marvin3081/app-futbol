const SEASONS = { '261': 2026, '140': 2025, '39': 2025, '2': 2025 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type = 'standings', league = '261', team } = req.query;

  if (!process.env.API_FOOTBALL_KEY) {
    return res.status(500).json({ error: 'Falta API_FOOTBALL_KEY en Vercel' });
  }
  if (
    !/^\d+$/.test(league) ||
    (team && !/^\d+$/.test(team)) ||
    (req.query.season && !/^\d{4}$/.test(req.query.season))
  ) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }
  if (type !== 'standings' && type !== 'next_matches') {
    return res.status(400).json({ error: 'Tipo de consulta no válido' });
  }
  if (type === 'next_matches' && !team) {
    return res.status(400).json({ error: 'Falta team' });
  }

  const first = Number(req.query.season || SEASONS[league] || 2025);
  const candidates = type === 'standings' ? [first, first - 1] : [null];
  let lastErrors = null;
  let remaining = null;

  try {
    for (const season of candidates) {
      const apiUrl =
        type === 'standings'
          ? `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`
          : `https://v3.football.api-sports.io/fixtures?team=${team}&next=5`;

      const r = await fetch(apiUrl, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
      });
      remaining = r.headers.get('x-ratelimit-requests-remaining');
      const json = await r.json();

      const hayErrores = Array.isArray(json.errors)
        ? json.errors.length > 0
        : !!json.errors && Object.keys(json.errors).length > 0;

      if (r.ok && !hayErrores && json.response?.length) {
        res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=3600'); // 12 horas
        return res.status(200).json({ origen: 'api_real', season, remaining, data: json.response });
      }
      lastErrors = json.errors;
    }

    // Sin Cache-Control: los errores no se guardan en caché
    return res.status(200).json({ origen: 'api_real', remaining, errors: lastErrors, data: [] });
  } catch (error) {
    return res.status(500).json({ error: 'Error de conexión', details: error.message });
  }
}

