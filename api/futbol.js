let cacheDatos = {};
let ultimaActualizacion = {};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'search', query = '', id = '', date = '' } = req.query;
    const cleanKey = `${type}_${query || id || date}`.toLowerCase().trim();
    const AHORA = Date.now();

    // Caché: 15 minutos para partidos de hoy, 6 horas para búsquedas
    const TIEMPO_CACHE = type === 'today_matches' ? 15 * 60 * 1000 : (type === 'search' ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000);

    if (cacheDatos[cleanKey] && (AHORA - ultimaActualizacion[cleanKey] < TIEMPO_CACHE)) {
        return res.status(200).json({ origen: 'cache', data: cacheDatos[cleanKey] });
    }

    let apiUrl = '';
    if (type === 'today_matches') {
        const fechaConsulta = date || new Date().toISOString().split('T')[0];
        apiUrl = `https://api.sportapi.ai/v1/matches?date=${fechaConsulta}`;
    } else if (type === 'search') {
        if (!query.trim()) return res.status(400).json({ error: 'Ingresa un término a buscar' });
        apiUrl = `https://api.sportapi.ai/v1/teams?search=${encodeURIComponent(query)}`;
    } else if (type === 'matches') {
        if (!id) return res.status(400).json({ error: 'Falta el identificador' });
        apiUrl = `https://api.sportapi.ai/v1/teams/${id}/matches?limit=5`;
    } else {
        return res.status(400).json({ error: 'Tipo de consulta no soportado' });
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': process.env.SPORTAPI_KEY || process.env.API_FOOTBALL_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ 
                error: errData.message || `Error del proveedor (HTTP ${response.status})` 
            });
        }

        const data = await response.json();
        const resultados = data.data || data.matches || data.teams || data;

        cacheDatos[cleanKey] = resultados;
        ultimaActualizacion[cleanKey] = AHORA;

        return res.status(200).json({ origen: 'api_real', data: resultados });
    } catch (error) {
        return res.status(500).json({ error: 'Fallo de conexión', details: error.message });
    }
}
