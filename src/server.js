const express = require('express');
const { config, apenasDigitos, validar } = require('./config');
const { prisma } = require('./db');
const { enviarTexto } = require('./whatsapp');
const { identificarComando, executarConsulta } = require('./queries');
const { processarMensagemGrupo } = require('./handlers');
const { detectarGatilho } = require('./gatilho');
const { iniciarCron } = require('./cron');

validar();

const app = express();
app.use(express.json({ limit: '2mb' }));

// Healthcheck (Render usa isso para saber que o servico esta de pe).
app.get('/', (_req, res) => res.send('Sistema de Gabinete - online'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Extrai o texto de uma mensagem do WhatsApp (varios formatos da Evolution).
function extrairTexto(message) {
  if (!message) return null;
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    null
  );
}

// Descobre o numero real de quem enviou a mensagem.
// O WhatsApp passou a usar LID ("166666726027455@lid") no lugar do numero em
// grupos, por privacidade; nesse modo o numero real vem nos campos "*Alt".
// Em conversa direta, o proprio remoteJid ja e o numero.
function numeroDoRemetente(key) {
  const candidatos = [
    key?.participantAlt, // grupo em modo LID: numero real
    key?.participant, // grupo em modo classico
    key?.remoteJidAlt, // conversa direta em modo LID
    key?.remoteJid, // conversa direta classica
  ];
  const jid = candidatos.find((c) => c && !c.includes('@lid'));
  return apenasDigitos(jid || '');
}

// Dedup: evita reprocessar a mesma mensagem.
async function jaProcessada(id) {
  if (!id) return false;
  const existe = await prisma.mensagemProcessada.findUnique({ where: { id } });
  return Boolean(existe);
}
async function marcarProcessada(id) {
  if (!id) return;
  await prisma.mensagemProcessada.create({ data: { id } }).catch(() => {});
}

app.post('/webhook', async (req, res) => {
  // Responde rapido para a Evolution nao reenviar por timeout.
  res.sendStatus(200);

  try {
    // Token opcional de protecao (?token=... ou header).
    if (config.webhookToken) {
      const token = req.query.token || req.headers['x-webhook-token'];
      if (token !== config.webhookToken) return;
    }

    const evento = req.body?.event;
    if (evento && evento !== 'messages.upsert') return;

    const data = req.body?.data;
    const msg = Array.isArray(data) ? data[0] : data;
    if (!msg) return;

    // Ignora mensagens enviadas pela propria IA (evita loop).
    if (msg.key?.fromMe) return;

    const id = msg.key?.id;
    if (await jaProcessada(id)) return;

    const texto = extrairTexto(msg.message);
    if (!texto || !texto.trim()) return;

    await marcarProcessada(id);

    const remoteJid = msg.key?.remoteJid || '';
    const remetenteNumero = numeroDoRemetente(msg.key);

    const ehVereador =
      config.vereadorNumero && remetenteNumero.endsWith(config.vereadorNumero);

    // 1) Consulta do vereador (comando reconhecido)
    const comando = identificarComando(texto);
    if (ehVereador && comando) {
      const resposta = await executarConsulta(comando);
      if (resposta) await enviarTexto(remoteJid, resposta);
      return;
    }

    // 2) Mensagem do grupo de assessores -> so processa se foi dirigida ao bot
    if (remoteJid === config.grupoAssessoresJid) {
      const textoLimpo = detectarGatilho(texto, msg.message);
      // Nao foi mencao nem prefixo "Dipo": ignora silenciosamente (conversa normal do grupo).
      if (textoLimpo === null) return;

      // Foi chamado mas nao disse nada util (ex.: so "Dipo:"): pede o conteudo.
      if (!textoLimpo) {
        await enviarTexto(
          remoteJid,
          'Pois não. Me diga o compromisso, demanda ou indicação que devo registrar.'
        );
        return;
      }

      // "Dipo: resumo" tambem e consulta, nao registro: checa o comando
      // depois de remover o gatilho, senao o texto iria parar na IA.
      const comandoAposGatilho = identificarComando(textoLimpo);
      if (ehVereador && comandoAposGatilho) {
        const resposta = await executarConsulta(comandoAposGatilho);
        if (resposta) await enviarTexto(remoteJid, resposta);
        return;
      }

      await processarMensagemGrupo(textoLimpo, {
        numero: remetenteNumero,
        nome: msg.pushName || null,
        jid: remoteJid,
      });
      return;
    }

    // Outras origens: ignora.
  } catch (err) {
    console.error('[webhook] erro:', err);
  }
});

app.listen(config.porta, () => {
  console.log(`[server] ouvindo na porta ${config.porta}`);
  iniciarCron();
});
