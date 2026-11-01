let cacheDatos = {};
let ultimaActualizacion = {};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'search', query = '', id = '', date = '' } = req.query;
    const cleanKey = `${type}_${query || id || date}`.toLowerCase().trim();
    const AHORA = Date.now();

    const TIEMPO_CACHE = type === 'today_matches' ? 15 * 60 * 1000 : (type === 'search' ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000);

    if (cacheDatos[cleanKey] && (AHORA - ultimaActualizacion[cleanKey] < TIEMPO_CACHE)) {
        return res.status(200).json({ origen: 'cache', data: cacheDatos[cleanKey] });
    }

    const apiKey = process.env.SPORTAPI_KEY || process.env.API_FOOTBALL_KEY || '';

    if (!apiKey) {
        return res.status(500).json({ error: 'Falta configurar la variable SPORTAPI_KEY en Vercel.' });
    }

    let endpointUrl = '';
    if (type === 'today_matches') {
        const fecha = date || new Date().toISOString().split('T')[0];
        endpointUrl = `https://sportapi.ai/api/v1/matches?date=${fecha}`;
    } else if (type === 'search') {
        if (!query.trim()) return res.status(400).json({ error: 'Ingresa un término a buscar.' });
        endpointUrl = `https://sportapi.ai/api/v1/teams?search=${encodeURIComponent(query)}`;
    } else if (type === 'matches') {
        if (!id) return res.status(400).json({ error: 'Falta el ID del equipo.' });
        endpointUrl = `https://sportapi.ai/api/v1/teams/${id}/matches?limit=5`;
    } else {
        return res.status(400).json({ error: 'Tipo de consulta no soportado.' });
    }

    try {
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://sportapi.ai/',
                'Origin': 'https://sportapi.ai'
            }
        });

        const rawText = await response.text();
        let dataJson;
        try {
            dataJson = JSON.parse(rawText);
        } catch (e) {
            return res.status(response.status).json({
                error: `HTTP ${response.status}: Respuesta inesperada`,
                respuesta: rawText.substring(0, 200)
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: dataJson.message || `Error del servicio (HTTP ${response.status})`,
                detalles: dataJson
            });
        }

        const resultados = dataJson.data || dataJson.matches || dataJson.teams || dataJson;

        cacheDatos[cleanKey] = resultados;
        ultimaActualizacion[cleanKey] = AHORA;

        return res.status(200).json({ origen: 'api_real', data: resultados });
    } catch (error) {
        return res.status(500).json({ error: 'Fallo al conectar', detalle: error.message });
    }
}
