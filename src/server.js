const express = require('express');
const { config, apenasDigitos, validar } = require('./config');
const { prisma } = require('./db');
const { enviarTexto } = require('./whatsapp');
const {
  identificarComando,
  ehPedidoDeAjuda,
  textoAjuda,
  executarConsulta,
} = require('./queries');
const { processarMensagemGrupo } = require('./handlers');
const { detectarGatilho } = require('./gatilho');
const { pegarPendente, limparPendente } = require('./conversa');
const { estadoAtual } = require('./monitor');
const { iniciarCron } = require('./cron');

validar();

// No Node 18+ uma promise rejeitada sem tratamento derruba o processo. Num bot
// que fica esperando webhook isso vira reinicio silencioso: a Railway avisa
// "crash" por e-mail e nao sobra rastro do motivo. Aqui a gente registra o erro
// e segue de pe - uma falha ao responder uma mensagem nao justifica derrubar o
// servico inteiro.
process.on('unhandledRejection', (motivo) => {
  console.error('[processo] promise rejeitada sem tratamento:', motivo);
});

// Excecao nao capturada deixa o processo em estado duvidoso: registra e sai,
// para a Railway subir um container limpo em vez de seguir meio quebrado.
process.on('uncaughtException', (err) => {
  console.error('[processo] excecao nao capturada:', err);
  process.exit(1);
});

const app = express();
app.use(express.json({ limit: '2mb' }));

// Healthcheck do servico. Responde 200 enquanto o processo estiver de pe,
// mesmo com o WhatsApp caido - se devolvesse erro aqui, a Railway acharia
// que o container esta doente e ficaria reiniciando a toa.
app.get('/', (_req, res) => res.send('Sistema de Gabinete - online'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Estado do WhatsApp, para monitor externo (UptimeRobot e afins).
// Devolve 503 quando a sessao cai, que e o que faz o monitor disparar o
// alerta por e-mail/push - o unico caminho que funciona quando justamente
// o WhatsApp esta fora do ar.
app.get('/status', (_req, res) => {
  const estado = estadoAtual();
  res.status(estado.noAr === false ? 503 : 200).json(estado);
});

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

// Compara dois numeros tolerando o DDI ausente de um dos lados.
// Nao usar "endsWith" solto aqui: como o numero do vereador tem 13 digitos,
// qualquer numero terminado nesses 13 digitos (ex.: 99 + 5513955518906) seria
// aceito como se fosse ele. Por isso descartamos o que for maior que um
// numero brasileiro valido e comparamos DDD + numero.
function mesmoNumero(a, b) {
  const da = apenasDigitos(a);
  const db = apenasDigitos(b);
  if (!da || !db) return false;
  if (da === db) return true;
  // 55 + DDD (2) + numero (8 ou 9) = no maximo 13 digitos.
  if (da.length > 13 || db.length > 13) return false;
  return da.length >= 11 && db.length >= 11 && da.slice(-11) === db.slice(-11);
}

// Esconde o miolo do numero antes de logar, para nao deixar telefone
// completo de terceiros espalhado no log.
function mascarar(jid) {
  const d = apenasDigitos(jid);
  if (d.length < 8) return '(desconhecido)';
  return `${d.slice(0, 4)}*****${d.slice(-4)}`;
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

    const texto = extrairTexto(msg.message);
    if (!texto || !texto.trim()) return;

    const remoteJid = msg.key?.remoteJid || '';
    const remetenteNumero = numeroDoRemetente(msg.key);

    const ehVereador = mesmoNumero(remetenteNumero, config.vereadorNumero);
    // Quem acompanha o sistema consulta no privado igual ao vereador.
    const ehAcompanhante = config.adminNumeros.some((n) => mesmoNumero(remetenteNumero, n));
    const ehGrupoAutorizado =
      Boolean(config.grupoAssessoresJid) && remoteJid === config.grupoAssessoresJid;

    // PROTECAO CONTRA NUMEROS DESCONHECIDOS
    // Se o numero do Dipo vazar, estranhos vao mandar mensagem. Responder
    // automaticamente a quem nao conhecemos e o caminho mais rapido para o
    // numero ser denunciado como spam e banido pelo WhatsApp. Entao qualquer
    // origem que nao seja o grupo autorizado ou o vereador e descartada em
    // SILENCIO: sem resposta, sem chamada a IA, sem gravar nada.
    // A checagem vem antes de qualquer acesso ao banco de proposito: assim um
    // flood de numero desconhecido custa zero query e nao enche a tabela de dedup.
    if (!ehGrupoAutorizado && !ehVereador && !ehAcompanhante) {
      console.log(
        `[webhook] ignorado (origem nao autorizada): ${mascarar(remoteJid)}`,
      );
      return;
    }

    const id = msg.key?.id;
    if (await jaProcessada(id)) return;
    await marcarProcessada(id);

    // 1) Ajuda: liberada para qualquer pessoa do grupo autorizado, porque
    // quem mais precisa da lista de comandos e o assessor, nao o vereador.
    if (ehPedidoDeAjuda(texto)) {
      await enviarTexto(remoteJid, textoAjuda());
      return;
    }

    // 2) Consulta (!hoje, !semana, !pendentes, !resumo).
    // Liberada para o grupo inteiro: o assessor precisa saber a agenda do dia
    // tanto quanto o vereador. A checagem de origem la em cima ja garante que
    // so chega aqui quem e do grupo autorizado ou o proprio vereador.
    const comando = identificarComando(texto);
    if (comando) {
      const resposta = await executarConsulta(comando);
      if (resposta) await enviarTexto(remoteJid, resposta);
      return;
    }

    // 3) Mensagem do grupo de assessores -> so processa se foi dirigida ao bot
    if (remoteJid === config.grupoAssessoresJid) {
      const remetente = {
        numero: remetenteNumero,
        nome: msg.pushName || null,
        jid: remoteJid,
      };

      const textoLimpo = detectarGatilho(texto, msg.message);

      if (textoLimpo === null) {
        // Sem gatilho. Pode ainda ser a resposta a uma pergunta que o Dipo
        // acabou de fazer a essa pessoa - nesse caso ele mesmo puxou a
        // conversa, entao exigir "!dipo" de novo seria burocracia.
        const pendente = pegarPendente(remoteJid, remetenteNumero);
        if (!pendente) return; // conversa normal do grupo: ignora em silencio

        limparPendente(remoteJid, remetenteNumero);
        // Reenvia o pedido original junto com a resposta, senao a IA recebe
        // so "quinta as 16h" e nao sabe do que se trata.
        await processarMensagemGrupo(`${pendente.textoOriginal}\n${texto}`, remetente);
        return;
      }

      // Foi chamado mas nao disse nada util (ex.: so "!dipo"): pede o conteudo.
      if (!textoLimpo) {
        await enviarTexto(
          remoteJid,
          'Pois não. Escreva o compromisso depois do !dipo. Use !ajuda para ver os comandos.'
        );
        return;
      }

      // "!dipo !resumo" tambem e consulta, nao registro: checa o comando
      // depois de remover o gatilho, senao o texto iria parar na IA.
      const comandoAposGatilho = identificarComando(textoLimpo);
      if (comandoAposGatilho) {
        const resposta = await executarConsulta(comandoAposGatilho);
        if (resposta) await enviarTexto(remoteJid, resposta);
        return;
      }

      await processarMensagemGrupo(textoLimpo, remetente);
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
