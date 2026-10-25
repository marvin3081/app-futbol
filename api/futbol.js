let cacheDatos = {};
let ultimaActualizacion = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type = 'standings', league = '261', team, season = '2026' } = req.query;
  const cacheKey = `${type}_${league}_${team || ''}_${season}`;
  const AHORA = Date.now();
  const CUATRO_HORAS = 4 * 60 * 60 * 1000;

  if (cacheDatos[cacheKey] && ultimaActualizacion[cacheKey] && (AHORA - ultimaActualizacion[cacheKey] < CUATRO_HORAS)) {
    return res.status(200).json({ origen: 'cache', data: cacheDatos[cacheKey] });
  }

  let apiUrl = '';
  if (type === 'standings') {
    apiUrl = `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`;
  } else if (type === 'next_matches') {
    apiUrl = `https://v3.football.api-sports.io/fixtures?team=${team}&next=5`;
  } else {
    return res.status(400).json({ error: 'Tipo de consulta no válido' });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
      }
    });

    const data = await response.json();

    if (data.response) {
      cacheDatos[cacheKey] = data.response;
      ultimaActualizacion[cacheKey] = AHORA;
      return res.status(200).json({ origen: 'api_real', data: data.response });
    } else {
      return res.status(500).json({ error: 'Error en la respuesta de API', detalles: data });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error de conexión', details: error.message });
  }
}
