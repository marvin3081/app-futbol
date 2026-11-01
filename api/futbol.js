export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiKey = process.env.SPORTAPI_KEY || process.env.API_FOOTBALL_KEY || '';

    if (!apiKey) {
        return res.status(500).json({ error: 'No se encontró la variable SPORTAPI_KEY ni API_FOOTBALL_KEY en Vercel.' });
    }

    // Ruta de prueba base para validar conexión y credenciales
    const testUrl = 'https://sportapi.ai/api/v1/football/fixtures/date/' + new Date().toISOString().split('T')[0];

    try {
        const response = await fetch('https://sportapi.ai/api/v1/status', {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'Accept': 'application/json'
            }
        });

        const statusText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(statusText); } catch(e) {}

        return res.status(200).json({
            mensaje: 'Prueba de conexión con SportAPI',
            http_status_sportapi: response.status,
            ok: response.ok,
            respuesta_sportapi: parsed || statusText
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Fallo al intentar contactar a SportAPI',
            detalle: error.message
        });
    }
}
