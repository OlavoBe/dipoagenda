const { prisma } = require('./db');
const {
  inicioDoDiaSP,
  fimDoDiaSP,
  daquiADias,
  formatarData,
  formatarHora,
} = require('./datas');

// ---- Reconhecimento de comandos do vereador ----
// Retorna 'hoje' | 'semana' | 'pendentes' | 'resumo' | null
function identificarComando(texto) {
  const t = (texto || '').trim().toLowerCase();
  if (/^(agenda\s+)?hoje[.!?]?$/.test(t)) return 'hoje';
  if (/^(agenda\s+)?semana[.!?]?$/.test(t)) return 'semana';
  if (/^(pendentes|demandas)[.!?]?$/.test(t)) return 'pendentes';
  if (/^resumo[.!?]?$/.test(t)) return 'resumo';
  return null;
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

async function textoDemandasPendentes() {
  const demandas = await prisma.demanda.findMany({
    where: { status: { not: 'Resolvida' } },
    orderBy: { criadoEm: 'desc' },
  });

  if (demandas.length === 0) {
    return '*Demandas pendentes*\nNenhuma demanda em aberto.';
  }

  const linhas = demandas.map((d) => {
    const bairro = d.bairro ? ` (${d.bairro})` : '';
    const tipo = d.tipo ? `${d.tipo} - ` : '';
    return `- ${tipo}${d.cidadaoNome}${bairro} [${d.status}]`;
  });
  return `*Demandas pendentes* (${demandas.length})\n${linhas.join('\n')}`;
}

async function textoResumo() {
  const [agenda, demandas] = await Promise.all([
    textoAgendaHoje(),
    textoDemandasPendentes(),
  ]);
  return `${agenda}\n\n${demandas}`;
}

async function executarConsulta(comando) {
  switch (comando) {
    case 'hoje':
      return textoAgendaHoje();
    case 'semana':
      return textoAgendaSemana();
    case 'pendentes':
      return textoDemandasPendentes();
    case 'resumo':
      return textoResumo();
    default:
      return null;
  }
}

module.exports = {
  identificarComando,
  executarConsulta,
  textoAgendaHoje,
  textoDemandasPendentes,
  textoResumo,
};
