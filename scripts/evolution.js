// Helper compartilhado pelos scripts operacionais: monta as chamadas na Evolution API
// usando as credenciais do .env.
require('dotenv').config();
const { config } = require('../src/config');

const base = config.evolution.url;
const instancia = config.evolution.instancia;

if (!base || !instancia) {
  console.error('Faltam EVOLUTION_API_URL / EVOLUTION_INSTANCE no .env');
  process.exit(1);
}

// Chama a Evolution e devolve o JSON (ou o texto cru, se nao for JSON).
async function chamar(caminho, opcoes = {}) {
  const resp = await fetch(`${base}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.evolution.apiKey,
      ...(opcoes.headers || {}),
    },
  });
  const texto = await resp.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    corpo = texto;
  }
  if (!resp.ok) {
    const erro = new Error(`Evolution respondeu ${resp.status}`);
    erro.corpo = corpo;
    throw erro;
  }
  return corpo;
}

module.exports = { chamar, instancia, base };
