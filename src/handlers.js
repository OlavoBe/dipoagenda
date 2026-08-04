const { prisma } = require('./db');
const { classificar } = require('./ai');
const { enviarTexto } = require('./whatsapp');
const { montarDataHora } = require('./datas');
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

  const { tipo, precisa_confirmar: precisaConfirmar, resposta } = resultado;

  if (tipo === 'IGNORAR') return;

  // Funcionalidade ainda nao disponivel: avisa e nao grava.
  if (RECADO_DESATIVADO[tipo]) {
    await enviarTexto(remetente.jid, RECADO_DESATIVADO[tipo]);
    return;
  }

  // Ambiguo ou sem dado suficiente: pergunta e nao grava. Guarda a pendencia
  // para a resposta poder vir solta, sem repetir o "!dipo".
  if (precisaConfirmar) {
    registrarPergunta(remetente.jid, remetente.numero, texto);
    if (resposta) await enviarTexto(remetente.jid, resposta);
    return;
  }

  try {
    if (tipo === 'AGENDA' && resultado.compromisso) {
      const c = resultado.compromisso;
      const data = montarDataHora(c.data, c.hora);
      if (!data) {
        await enviarTexto(remetente.jid, '[AGENDA] Preciso da data do compromisso para registrar.');
        return;
      }
      const compromisso = await prisma.compromisso.create({
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
      await criarLembreteCompromisso(compromisso);
    } else {
      // tipo declarado mas sem objeto correspondente: nao grava
      return;
    }
  } catch (err) {
    console.error('[handlers] erro ao salvar:', err.message);
    await enviarTexto(remetente.jid, 'Houve um erro ao registrar. Tente novamente.');
    return;
  }

  // Confirmacao no grupo
  if (resposta) await enviarTexto(remetente.jid, resposta);
}

module.exports = { processarMensagemGrupo };
