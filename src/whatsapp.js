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

module.exports = { enviarTexto };
