// Zera os dados do Dipo. Roda no start, mas so faz alguma coisa quando a
// variavel LIMPAR_BANCO tem exatamente o valor "APAGAR-TUDO".
//
// Existe porque nao ha como abrir um terminal no banco de producao: ele nao
// tem URL publica (de proposito) e o console web da Railway nao aceita Enter
// por automacao. Entao a limpeza vira um passo do deploy, ligado e desligado
// por variavel.
//
// Depois de usar, REMOVA a variavel no Railway. Enquanto ela existir, todo
// deploy vai zerar o banco de novo.
const { PrismaClient } = require('@prisma/client');

const CHAVE = 'APAGAR-TUDO';

async function main() {
  if (process.env.LIMPAR_BANCO !== CHAVE) return; // caminho normal: nao faz nada

  const prisma = new PrismaClient();

  const antes = {
    compromissos: await prisma.compromisso.count(),
    demandas: await prisma.demanda.count(),
    indicacoes: await prisma.pedidoIndicacao.count(),
    notificacoes: await prisma.notificacao.count(),
    mensagensProcessadas: await prisma.mensagemProcessada.count(),
  };
  console.warn('[limpar] LIMPAR_BANCO ativo. Registros antes:', JSON.stringify(antes));

  // Sem chaves estrangeiras entre essas tabelas, a ordem nao importa.
  await prisma.notificacao.deleteMany();
  await prisma.compromisso.deleteMany();
  await prisma.demanda.deleteMany();
  await prisma.pedidoIndicacao.deleteMany();
  await prisma.mensagemProcessada.deleteMany();

  const depois = {
    compromissos: await prisma.compromisso.count(),
    demandas: await prisma.demanda.count(),
    indicacoes: await prisma.pedidoIndicacao.count(),
    notificacoes: await prisma.notificacao.count(),
    mensagensProcessadas: await prisma.mensagemProcessada.count(),
  };
  console.warn('[limpar] Banco zerado. Registros depois:', JSON.stringify(depois));
  console.warn('[limpar] REMOVA a variavel LIMPAR_BANCO para nao zerar no proximo deploy.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[limpar] falhou:', err.message);
  process.exit(1);
});
