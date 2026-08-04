const { prisma } = require('./db');
const { config } = require('./config');
const { enviarTexto } = require('./whatsapp');
const { formatarHora } = require('./datas');

// Cria um lembrete (1h antes) para um compromisso, se ainda estiver no futuro.
// Vai para o grupo dos assessores (que precisam se organizar antes do
// compromisso) e tambem na conversa direta do vereador, que pode nao estar
// acompanhando o grupo naquele momento.
async function criarLembreteCompromisso(compromisso) {
  const enviarEm = new Date(new Date(compromisso.data).getTime() - 60 * 60 * 1000);
  if (enviarEm.getTime() <= Date.now()) return; // compromisso muito proximo/passado

  const hora = compromisso.hora || formatarHora(compromisso.data);
  const local = compromisso.local ? ` em ${compromisso.local}` : '';
  const mensagem = `*Lembrete*\nDaqui a 1h: ${compromisso.titulo} (${hora})${local}.`;

  // Set evita mandar duas vezes caso o grupo e o vereador sejam o mesmo destino.
  const destinos = [...new Set([config.grupoAssessoresJid, config.vereadorNumero].filter(Boolean))];
  if (!destinos.length) return;

  for (const destino of destinos) {
    await prisma.notificacao.create({
      data: {
        tipo: 'lembrete_compromisso',
        destinatarioNumero: destino,
        mensagem,
        enviarEm,
      },
    });
  }
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
