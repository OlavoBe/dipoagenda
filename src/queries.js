const { prisma } = require('./db');
const {
  inicioDoDiaSP,
  fimDoDiaSP,
  daquiADias,
  formatarData,
} = require('./datas');

// ---- Reconhecimento de comandos do vereador ----
// Todo comando comeca com "!". Exigir o prefixo evita que uma conversa
// normal no grupo ("e o resumo da reuniao?") dispare o bot sem querer.
// Retorna 'hoje' | 'semana' | 'resumo' | null
function identificarComando(texto) {
  const t = (texto || '').trim().toLowerCase();
  if (/^!(agenda\s+)?hoje$/.test(t)) return 'hoje';
  if (/^!(agenda\s+)?semana$/.test(t)) return 'semana';
  if (/^!resumo$/.test(t)) return 'resumo';
  return null;
}

// Verifica se a mensagem e um pedido de ajuda ("!ajuda" ou "!comandos").
function ehPedidoDeAjuda(texto) {
  return /^\s*!(ajuda|comandos|help)\s*$/i.test(texto || '');
}

// Texto de ajuda enviado no grupo. Serve de lembrete rapido para quem nao
// quer abrir o guia completo.
function textoAjuda() {
  return [
    '*Dipo — Auxiliar Legislativo*',
    '',
    '*Registrar compromisso:*',
    '`!dipo` + o compromisso. Atalho: `!d`',
    'Ex.: !dipo reunião com a associação sexta às 15h',
    'Se faltar algum dado eu pergunto, e aí é só responder normal.',
    '',
    '*Consultar:*',
    '`!hoje` — compromissos de hoje',
    '`!semana` — hoje e os próximos 7 dias',
    '`!resumo` — a agenda inteira que vem pela frente',
    '',
    '`!ajuda` — mostra esta lista',
    '',
    'Fora esses comandos, eu não leio a conversa do grupo.',
  ].join('\n');
}

// ---- Geradores de texto (negrito nativo do WhatsApp com *asteriscos*) ----

async function textoAgendaHoje() {
  const inicio = inicioDoDiaSP();
  const fim = fimDoDiaSP();
  const compromissos = await prisma.compromisso.findMany({
    where: { data: { gte: inicio, lt: fim } },
    orderBy: { data: 'asc' },
  });

  if (compromissos.length === 0) {
    return '*Agenda de hoje*\nNenhum compromisso para hoje.';
  }

  return `*Agenda de hoje*\n${compromissos.map(linhaAgenda).join('\n')}`;
}

// Uma linha da agenda. Quando o compromisso veio sem horario, dizemos isso
// em vez de exibir a hora derivada da data: como a data e gravada a meia-noite
// nesse caso, sairia um "00:00" que parece horario de verdade e nao e.
function linhaAgenda(c) {
  const local = c.local ? ` - ${c.local}` : '';
  return c.hora ? `- ${c.hora} ${c.titulo}${local}` : `- ${c.titulo} (horário a definir)${local}`;
}

// Monta a listagem agrupada por dia. Usada pelas consultas que cobrem mais
// de um dia, para as duas sairem no mesmo formato.
function agruparPorDia(compromissos) {
  const porDia = new Map();
  for (const c of compromissos) {
    const chave = formatarData(c.data);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push(c);
  }

  const blocos = [];
  for (const [dia, itens] of porDia) {
    blocos.push(`*${dia}*\n${itens.map(linhaAgenda).join('\n')}`);
  }
  return blocos.join('\n\n');
}

// Hoje mais os proximos 7 dias. O periodo comeca a 00:00 de hoje, entao os
// compromissos de hoje entram aqui tambem.
async function textoAgendaSemana() {
  const inicio = inicioDoDiaSP();
  const fim = daquiADias(7, fimDoDiaSP());
  const compromissos = await prisma.compromisso.findMany({
    where: { data: { gte: inicio, lt: fim } },
    orderBy: { data: 'asc' },
  });

  if (compromissos.length === 0) {
    return '*Agenda: hoje e proximos 7 dias*\nNenhum compromisso no periodo.';
  }
  return `*Agenda: hoje e proximos 7 dias*\n\n${agruparPorDia(compromissos)}`;
}

// Tudo o que vem pela frente, sem limite de data. Sem isso um compromisso
// marcado para daqui a tres meses ficava invisivel: era salvo, disparava o
// lembrete na hora certa, mas nao aparecia em nenhuma consulta.
async function textoResumo() {
  const compromissos = await prisma.compromisso.findMany({
    where: { data: { gte: inicioDoDiaSP() } },
    orderBy: { data: 'asc' },
  });

  if (compromissos.length === 0) {
    return '*Agenda completa*\nNenhum compromisso agendado.';
  }
  return `*Agenda completa* (${compromissos.length})\n\n${agruparPorDia(compromissos)}`;
}

async function executarConsulta(comando) {
  switch (comando) {
    case 'hoje':
      return textoAgendaHoje();
    case 'semana':
      return textoAgendaSemana();
    case 'resumo':
      return textoResumo();
    default:
      return null;
  }
}

module.exports = {
  identificarComando,
  ehPedidoDeAjuda,
  textoAjuda,
  executarConsulta,
  textoAgendaHoje,
  textoResumo,
};
