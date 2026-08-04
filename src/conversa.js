// Guarda as perguntas que o Dipo deixou em aberto.
//
// Quando falta um dado (ex.: a data de um compromisso), o Dipo pergunta. Sem
// isso, a pessoa teria que repetir o "!dipo" na resposta, o que e chato e
// pouco natural. Com o registro da pendencia, a proxima mensagem daquela
// pessoa naquele chat e tratada como continuacao.
//
// Fica em memoria de proposito: sao pendencias de minutos, o servico roda com
// uma replica so, e um redeploy perder isso e irrelevante perto do custo de
// mais uma tabela. Se um dia rodar com varias replicas, precisa ir pro banco.

const PENDENTES = new Map();

// Depois disso a pergunta e considerada esquecida: se a pessoa voltar ao
// assunto meia hora depois, e mais seguro exigir o !dipo de novo do que
// grudar a mensagem nova num contexto velho.
const VALIDADE_MS = 10 * 60 * 1000;

function chave(jid, numero) {
  return `${jid}|${numero}`;
}

// Marca que o Dipo perguntou algo e esta esperando a resposta.
// "textoOriginal" e o que a pessoa tinha escrito, para reenviar a IA junto
// com a resposta e a classificacao ter o contexto inteiro.
function registrarPergunta(jid, numero, textoOriginal) {
  if (!jid || !numero) return;
  PENDENTES.set(chave(jid, numero), { textoOriginal, criadoEm: Date.now() });
}

// Devolve a pendencia ainda valida, ou null.
function pegarPendente(jid, numero) {
  if (!jid || !numero) return null;
  const k = chave(jid, numero);
  const pendente = PENDENTES.get(k);
  if (!pendente) return null;
  if (Date.now() - pendente.criadoEm > VALIDADE_MS) {
    PENDENTES.delete(k);
    return null;
  }
  return pendente;
}

function limparPendente(jid, numero) {
  if (!jid || !numero) return;
  PENDENTES.delete(chave(jid, numero));
}

module.exports = { registrarPergunta, pegarPendente, limparPendente };
