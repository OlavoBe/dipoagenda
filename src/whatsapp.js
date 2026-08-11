const { config } = require('./config');

// Envia texto via Evolution API.
// "destino" pode ser um numero (5513999998888) ou um JID de grupo
// (xxxxxxxxxxxx@g.us). Usa o formato da Evolution API v2.
async function enviarTexto(destino, texto) {
  if (!config.evolution.url || !config.evolution.instancia) {
    console.warn('[whatsapp] Evolution nao configurada; mensagem nao enviada:', texto);
    return false;
  }

  const url = `${config.evolution.url}/message/sendText/${config.evolution.instancia}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.evolution.apiKey,
      },
      body: JSON.stringify({ number: destino, text: texto }),
    });
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => '');
      console.error('[whatsapp] falha ao enviar:', resp.status, corpo);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[whatsapp] erro de rede ao enviar:', err.message);
    return false;
  }
}

// Consulta o estado da instancia na Evolution.
// Devolve 'open' (pareada), 'close'/'connecting' (fora do ar) ou null quando
// nem deu para perguntar - a diferenca importa: null e "nao sei", nao e "caiu".
async function estadoConexao() {
  if (!config.evolution.url || !config.evolution.instancia) return null;

  const url = `${config.evolution.url}/instance/connectionState/${config.evolution.instancia}`;
  try {
    const resp = await fetch(url, { headers: { apikey: config.evolution.apiKey } });
    if (!resp.ok) return null;
    const corpo = await resp.json();
    return corpo?.instance?.state || null;
  } catch (err) {
    console.error('[whatsapp] erro ao consultar estado:', err.message);
    return null;
  }
}

module.exports = { enviarTexto, estadoConexao };
