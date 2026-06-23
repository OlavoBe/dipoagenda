const { prisma } = require('./db');
const { config } = require('./config');
const { enviarTexto } = require('./whatsapp');
const { formatarHora } = require('./datas');

// Cria um lembrete (1h antes) para um compromisso, se ainda estiver no futuro.
async function criarLembreteCompromisso(compromisso) {
  const enviarEm = new Date(new Date(compromisso.data).getTime() - 60 * 60 * 1000);
  if (enviarEm.getTime() <= Date.now()) return; // compromisso muito proximo/passado
  if (!config.vereadorNumero) return;

  const hora = compromisso.hora || formatarHora(compromisso.data);
  const local = compromisso.local ? ` em ${compromisso.local}` : '';
  const mensagem = `*Lembrete*\nDaqui a 1h: ${compromisso.titulo} (${hora})${local}.`;

  await prisma.notificacao.create({
    data: {
      tipo: 'lembrete_compromisso',
      destinatarioNumero: config.vereadorNumero,
      mensagem,
      enviarEm,
    },
  });
}

// Despacha notificacoes vencidas (chamado pelo cron a cada minuto).
async function despacharPendentes() {
  const pendentes = await prisma.notificacao.findMany({
    where: { enviada: false, enviarEm: { lte: new Date() } },
    orderBy: { enviarEm: 'asc' },
  });

  for (const n of pendentes) {
    const ok = await enviarTexto(n.destinatarioNumero, n.mensagem);
    if (ok) {
      await prisma.notificacao.update({
        where: { id: n.id },
        data: { enviada: true },
      });
    }
  }
}

module.exports = { criarLembreteCompromisso, despacharPendentes };
