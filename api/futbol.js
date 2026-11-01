let cacheDatos = {};
let ultimaActualizacion = {};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'search', query = '', id = '', date = '' } = req.query;
    const cleanKey = `${type}_${query || id || date}`.toLowerCase().trim();
    const AHORA = Date.now();

    const TIEMPO_CACHE = type === 'today_matches' ? 15 * 60 * 1000 : (type === 'search' ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000);

    if (cacheDatos[cleanKey] && (AHORA - ultimaActualizacion[cleanKey] < TIEMPO_CACHE)) {
        return res.status(200).json({ origen: 'cache', data: cacheDatos[cleanKey] });
    }

    const BASE_URL = 'https://sportapi.ai/api/v1';
    let apiUrl = '';

    if (type === 'today_matches') {
        const fecha = date || new Date().toISOString().split('T')[0];
        apiUrl = `${BASE_URL}/matches?date=${fecha}`;
    } else if (type === 'search') {
        if (!query.trim()) return res.status(400).json({ error: 'Ingresa un término a buscar' });
        apiUrl = `${BASE_URL}/teams?search=${encodeURIComponent(query)}`;
    } else if (type === 'matches') {
        if (!id) return res.status(400).json({ error: 'Falta el identificador del equipo' });
        apiUrl = `${BASE_URL}/teams/${id}/matches?limit=5`;
    } else {
        return res.status(400).json({ error: 'Tipo de consulta no soportado' });
    }

    try {
        const apiKey = process.env.SPORTAPI_KEY || process.env.API_FOOTBALL_KEY || '';

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'Accept': 'application/json'
            }
        });

        const rawText = await response.text();
        let jsonResponse;

        try {
            jsonResponse = JSON.parse(rawText);
        } catch (e) {
            return res.status(response.status).json({
                error: `HTTP ${response.status}: Respuesta inesperada del servicio`,
                url: apiUrl,
                preview: rawText.substring(0, 160)
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: jsonResponse.message || `Error del proveedor (HTTP ${response.status})`,
                detalles: jsonResponse,
                url: apiUrl
            });
        }

        // SportAPI suele entregar listas en .data o en el cuerpo raíz
        const dataFinal = jsonResponse.data || jsonResponse.teams || jsonResponse.matches || jsonResponse;

        cacheDatos[cleanKey] = dataFinal;
        ultimaActualizacion[cleanKey] = AHORA;

        return res.status(200).json({ origen: 'api_real', data: dataFinal });
    } catch (error) {
        return res.status(500).json({ error: 'Fallo de conexión', details: error.message });
    }
}
