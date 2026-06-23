const { config, apenasDigitos } = require('./config');

// Prefixo "Dipo:"/"Dipo,"/"Dipo " no inicio do texto (tolerante a acentos e case).
const REGEX_PREFIXO = /^\s*dipo\b[\s:,-]*/i;

// Verifica se algum JID mencionado na mensagem corresponde ao numero do bot.
function temMencaoAoBot(message) {
  const mentionedJid = message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (!Array.isArray(mentionedJid) || !config.botNumero) return false;
  return mentionedJid.some((jid) => apenasDigitos(jid).endsWith(config.botNumero));
}

// Verifica se o texto comeca com o prefixo "Dipo".
function temPrefixoDipo(texto) {
  return REGEX_PREFIXO.test(texto || '');
}

// Detecta se a mensagem foi dirigida ao bot (mencao real ou prefixo "Dipo")
// e retorna o texto ja limpo do gatilho, pronto para ir pra IA.
// Retorna null quando a mensagem nao foi dirigida ao bot (deve ser ignorada).
function detectarGatilho(texto, message) {
  const porMencao = temMencaoAoBot(message);
  const porPrefixo = temPrefixoDipo(texto);

  if (!porMencao && !porPrefixo) return null;

  let limpo = texto || '';

  // Remove o prefixo "Dipo:"/"Dipo,"/"Dipo " do inicio, se houver.
  limpo = limpo.replace(REGEX_PREFIXO, '');

  // Remove mencoes "@numero" que se referem ao bot (a Evolution manda o texto
  // visivel com "@<numero>" no lugar da mencao).
  if (config.botNumero) {
    const regexMencaoTexto = new RegExp(`@${config.botNumero}\\b`, 'g');
    limpo = limpo.replace(regexMencaoTexto, '');
  }

  return limpo.trim();
}

module.exports = { detectarGatilho };
