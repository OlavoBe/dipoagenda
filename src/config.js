require('dotenv').config();

function apenasDigitos(valor) {
  return (valor || '').replace(/\D/g, '');
}

const config = {
  porta: process.env.PORT || 3000,

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelo: process.env.OPENAI_MODEL || 'gpt-4o',

  // Evolution API
  evolution: {
    url: (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY,
    instancia: process.env.EVOLUTION_INSTANCE,
  },

  // WhatsApp - grupo dos assessores e numero do vereador
  grupoAssessoresJid: process.env.GRUPO_ASSESSORES_JID,
  vereadorNumero: apenasDigitos(process.env.VEREADOR_NUMERO),
  vereadorNome: process.env.VEREADOR_NOME || 'Vereador',

  // Numero do chip do bot (Dipo) conectado na Evolution, usado para detectar mencao no grupo
  botNumero: apenasDigitos(process.env.BOT_NUMERO),

  // Token simples para proteger o webhook (opcional)
  webhookToken: process.env.WEBHOOK_TOKEN || null,
};

// Avisos de configuracao faltando (nao derruba o servidor, so alerta)
function validar() {
  const faltando = [];
  if (!config.openaiApiKey) faltando.push('OPENAI_API_KEY');
  if (!config.evolution.url) faltando.push('EVOLUTION_API_URL');
  if (!config.evolution.apiKey) faltando.push('EVOLUTION_API_KEY');
  if (!config.evolution.instancia) faltando.push('EVOLUTION_INSTANCE');
  if (!config.grupoAssessoresJid) faltando.push('GRUPO_ASSESSORES_JID');
  if (!config.vereadorNumero) faltando.push('VEREADOR_NUMERO');
  if (!config.botNumero) faltando.push('BOT_NUMERO');
  if (faltando.length) {
    console.warn('[config] Variaveis de ambiente faltando:', faltando.join(', '));
  }
}

module.exports = { config, apenasDigitos, validar };
