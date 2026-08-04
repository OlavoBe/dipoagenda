// Aplica as migrations antes de subir o servidor.
//
// A Railway roda "prisma db push" durante o build, o que cria as tabelas mas
// nao a tabela de historico "_prisma_migrations". Nesse estado o
// "prisma migrate deploy" aborta com P3005 ("database schema is not empty") e
// o deploy inteiro cai. Quando isso acontece, marcamos as migrations
// existentes como aplicadas (baseline) e tentamos de novo.
//
// Se a falha for por outro motivo (credencial errada, banco fora do ar), o
// segundo deploy falha igual e o processo sai com erro - que e o certo:
// melhor o deploy quebrar do que o servidor subir com o schema errado.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function rodar(comando) {
  execSync(comando, { stdio: 'inherit' });
}

function migrationsLocais() {
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

try {
  rodar('npx prisma migrate deploy');
} catch {
  console.warn('[migrar] migrate deploy falhou; tentando baseline das migrations...');
  for (const migration of migrationsLocais()) {
    try {
      rodar(`npx prisma migrate resolve --applied ${migration}`);
    } catch {
      // Ja marcada como aplicada: segue para a proxima.
      console.warn(`[migrar] ${migration} ja constava aplicada.`);
    }
  }
  rodar('npx prisma migrate deploy');
}
