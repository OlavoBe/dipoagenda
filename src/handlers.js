const { prisma } = require('./db');
const { classificar } = require('./ai');
const { enviarTexto } = require('./whatsapp');
const { montarDataHora, formatarData } = require('./datas');
const { criarLembreteCompromisso } = require('./notificacoes');
const { registrarPergunta } = require('./conversa');

// Demanda e indicacao ficam desligadas por enquanto: vao viver no Dipo
// Indicacoes. A IA continua reconhecendo os dois para o Dipo poder avisar
// que ainda nao faz isso - avisar e melhor que ficar mudo, senao o assessor
// acha que registrou e o pedido se perde.
const RECADO_DESATIVADO = {
  DEMANDA: '[DEMANDA] Ainda não registro demandas de cidadãos. Por enquanto eu cuido só da agenda.',
  INDICACAO: '[INDICAÇÃO] Ainda não registro pedidos de indicação. Por enquanto eu cuido só da agenda.',
};

// Uma linha da confirmacao, montada a partir do registro que foi realmente
// gravado - e nao do texto que a IA sugeriu. Isso evita o pior tipo de erro
// aqui: confirmar no grupo um compromisso que nao entrou no banco.
function linhaCompromisso(c) {
  const partes = [formatarData(c.data)];
  partes.push(c.hora || 'horário a definir');
  if (c.local) partes.push(c.local);
  return `• ${c.titulo} — ${partes.join(', ')}`;
}

function montarConfirmacao(salvos, semData) {
  const blocos = [];

  if (salvos.length === 1) {
    blocos.push(`[AGENDA] ${linhaCompromisso(salvos[0]).replace(/^• /, '')}`);
  } else if (salvos.length > 1) {
    blocos.push(`[AGENDA] ${salvos.length} compromissos registrados:`);
    blocos.push(salvos.map(linhaCompromisso).join('\n'));
  }

  if (semData.length) {
    const nomes = semData.map((c) => c.titulo || 'compromisso sem título').join(', ');
    blocos.push(
      salvos.length
        ? `Faltou a data de: ${nomes}. Me diga que eu registro.`
        : `[AGENDA] Preciso da data de: ${nomes}.`,
    );
  }

  return blocos.join('\n\n');
}

// Processa uma mensagem vinda do grupo de assessores:
// classifica via IA, persiste o que for concreto e confirma no grupo.
async function processarMensagemGrupo(texto, remetente) {
  let resultado;
  try {
    resultado = await classificar(texto);
  } catch (err) {
    console.error('[handlers] erro na classificacao:', err.message);
    return;
  }

  const { tipo, resposta } = resultado;

  if (tipo === 'IGNORAR') return;

  // Funcionalidade ainda nao disponivel: avisa e nao grava.
  if (RECADO_DESATIVADO[tipo]) {
    await enviarTexto(remetente.jid, RECADO_DESATIVADO[tipo]);
    return;
  }

  if (tipo !== 'AGENDA') return;

  const itens = Array.isArray(resultado.compromissos) ? resultado.compromissos : [];
  if (!itens.length) {
    // Sem nada aproveitavel: se a IA fez uma pergunta, repassa e guarda a
    // pendencia para a resposta poder vir solta, sem repetir o "!dipo".
    if (resposta) {
      registrarPergunta(remetente.jid, remetente.numero, texto);
      await enviarTexto(remetente.jid, resposta);
    }
    return;
  }

  // Um compromisso sem data nao impede os outros de entrarem: registra o que
  // da para registrar e cobra so o que faltou.
  const salvos = [];
  const semData = [];

  try {
    for (const c of itens) {
      const data = montarDataHora(c.data, c.hora);
      if (!data) {
        semData.push(c);
        continue;
      }
      const salvo = await prisma.compromisso.create({
        data: {
          titulo: c.titulo || 'Compromisso',
          data,
          hora: c.hora || null,
          local: c.local || null,
          tipo: c.tipo || null,
          descricao: c.descricao || null,
          criadoPor: remetente.nome || remetente.numero || null,
        },
      });
      await criarLembreteCompromisso(salvo);
      salvos.push(salvo);
    }
  } catch (err) {
    console.error('[handlers] erro ao salvar:', err.message);
    await enviarTexto(
      remetente.jid,
      salvos.length
        ? `Registrei ${salvos.length} compromisso(s), mas houve um erro no restante. Confira com !semana.`
        : 'Houve um erro ao registrar. Tente novamente.',
    );
    return;
  }

  // Ficou faltando data: deixa a conversa aberta para a resposta vir solta.
  if (semData.length) {
    registrarPergunta(remetente.jid, remetente.numero, texto);
  }

  await enviarTexto(remetente.jid, montarConfirmacao(salvos, semData));
}

module.exports = { processarMensagemGrupo };
