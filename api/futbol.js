let cacheDatos = {};
let ultimaActualizacion = {};

// Convierte texto como "Real Madrid" a "real-madrid"
function formatearSlug(texto) {
    return texto
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita tildes
        .replace(/[^a-z0-9]+/g, '-')     // Cambia espacios o signos por guiones
        .replace(/^-+|-+$/g, '');        // Quita guiones sobrantes
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'today_matches', query = '', id = '', date = '' } = req.query;
    const cleanKey = `${type}_${query || id || date}`.toLowerCase().trim();
    const AHORA = Date.now();

    const TIEMPO_CACHE = type === 'today_matches' ? 15 * 60 * 1000 : 6 * 60 * 60 * 1000;

    if (cacheDatos[cleanKey] && (AHORA - ultimaActualizacion[cleanKey] < TIEMPO_CACHE)) {
        return res.status(200).json({ origen: 'cache', data: cacheDatos[cleanKey] });
    }

    const apiKey = process.env.SPORTAPI_KEY || process.env.API_FOOTBALL_KEY || '';
    if (!apiKey) {
        return res.status(500).json({ error: 'Falta configurar SPORTAPI_KEY en Vercel.' });
    }

    let endpointUrl = '';

    if (type === 'today_matches') {
        const fecha = date || new Date().toISOString().split('T')[0];
        endpointUrl = `https://sportapi.ai/api/matches?date=${fecha}`;
    } else if (type === 'search') {
        if (!query.trim()) return res.status(400).json({ error: 'Ingresa un nombre para buscar.' });
        const slug = formatearSlug(query);
        endpointUrl = `https://sportapi.ai/api/teams/slug/${slug}`;
    } else if (type === 'matches') {
        if (!id) return res.status(400).json({ error: 'Falta el ID del equipo.' });
        endpointUrl = `https://sportapi.ai/api/teams/${id}/matches`;
    } else {
        const fecha = date || new Date().toISOString().split('T')[0];
        endpointUrl = `https://sportapi.ai/api/matches?date=${fecha}`;
    }

    try {
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'Accept': 'application/json'
            }
        });

        const rawText = await response.text();
        let json;
        try {
            json = JSON.parse(rawText);
        } catch (e) {
            return res.status(response.status).json({
                error: `HTTP ${response.status}: Respuesta no válida`,
                detalle: rawText.substring(0, 160)
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: json.message || `Error HTTP ${response.status}`,
                detalles: json
            });
        }

        // Si devuelve un solo equipo (objeto), se empaqueta en lista para que la interfaz lo dibuje
        let lista = [];
        if (Array.isArray(json)) {
            lista = json;
        } else if (Array.isArray(json.data)) {
            lista = json.data;
        } else if (Array.isArray(json.matches)) {
            lista = json.matches;
        } else if (typeof json === 'object') {
            lista = [json.data || json];
        }

        cacheDatos[cleanKey] = lista;
        ultimaActualizacion[cleanKey] = AHORA;

        return res.status(200).json({ origen: 'api_real', data: lista });
    } catch (error) {
        return res.status(500).json({ error: 'Fallo al conectar', detalle: error.message });
    }
}
