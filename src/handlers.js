const { prisma } = require('./db');
const { classificar } = require('./ai');
const { enviarTexto } = require('./whatsapp');
const { montarDataHora } = require('./datas');
const { criarLembreteCompromisso } = require('./notificacoes');

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

  // Ambiguo ou sem dado suficiente: pede confirmacao, nao grava.
  if (tipo === 'IGNORAR') return;
  if (precisaConfirmar) {
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
    } else if (tipo === 'DEMANDA' && resultado.demanda) {
      const d = resultado.demanda;
      await prisma.demanda.create({
        data: {
          cidadaoNome: d.cidadao_nome || 'Cidadao',
          bairro: d.bairro || null,
          logradouro: d.logradouro || null,
          tipo: d.tipo || null,
          descricao: d.descricao || texto,
          criadoPor: remetente.nome || remetente.numero || null,
        },
      });
    } else if (tipo === 'INDICACAO' && resultado.indicacao) {
      const i = resultado.indicacao;
      await prisma.pedidoIndicacao.create({
        data: {
          assunto: i.assunto || 'Indicacao',
          logradouro: i.logradouro || null,
          bairro: i.bairro || null,
          cep: i.cep || null,
          referencia: i.referencia || null,
          descricao: i.descricao || texto,
          criadoPor: remetente.nome || remetente.numero || null,
        },
      });
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
