const { prisma } = require('./db');
const {
  inicioDoDiaSP,
  fimDoDiaSP,
  daquiADias,
  formatarData,
  formatarHora,
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
    '`!semana` — próximos 7 dias',
    '`!resumo` — hoje + os próximos 7 dias',
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

  const linhas = compromissos.map((c) => {
    const hora = c.hora || formatarHora(c.data);
    const local = c.local ? ` - ${c.local}` : '';
    return `- ${hora} ${c.titulo}${local}`;
  });
  return `*Agenda de hoje*\n${linhas.join('\n')}`;
}

async function textoAgendaSemana() {
  const inicio = inicioDoDiaSP();
  const fim = daquiADias(7, fimDoDiaSP());
  const compromissos = await prisma.compromisso.findMany({
    where: { data: { gte: inicio, lt: fim } },
    orderBy: { data: 'asc' },
  });

  if (compromissos.length === 0) {
    return '*Agenda dos proximos 7 dias*\nNenhum compromisso no periodo.';
  }

  // Agrupa por dia
  const porDia = new Map();
  for (const c of compromissos) {
    const chave = formatarData(c.data);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push(c);
  }

  const blocos = [];
  for (const [dia, itens] of porDia) {
    const linhas = itens.map((c) => {
      const hora = c.hora || formatarHora(c.data);
      const local = c.local ? ` - ${c.local}` : '';
      return `- ${hora} ${c.titulo}${local}`;
    });
    blocos.push(`*${dia}*\n${linhas.join('\n')}`);
  }
  return `*Agenda dos proximos 7 dias*\n\n${blocos.join('\n\n')}`;
}

// Panorama: o dia de hoje e o que vem pela frente. Enquanto demanda e
// indicacao estao desligadas, e isso que faz sentido num "resumo".
async function textoResumo() {
  const [hoje, semana] = await Promise.all([textoAgendaHoje(), textoAgendaSemana()]);
  return `${hoje}\n\n${semana}`;
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
