// Lista os grupos em que o Dipo esta, mostrando o JID de cada um.
// Uso: npm run grupos
// Copie o JID do grupo desejado para GRUPO_ASSESSORES_JID no .env.
const { chamar, instancia } = require('./evolution');

async function main() {
  let grupos;
  try {
    grupos = await chamar(`/group/fetchAllGroups/${instancia}?getParticipants=false`);
  } catch (err) {
    console.error('Nao consegui listar os grupos:', err.message);
    if (err.corpo) console.error(JSON.stringify(err.corpo, null, 2));
    console.error('\nA instancia precisa estar conectada. Rode: npm run conectar');
    process.exit(1);
  }

  if (!Array.isArray(grupos) || grupos.length === 0) {
    console.log('Nenhum grupo encontrado.');
    console.log('Crie o grupo no WhatsApp e adicione o Dipo, depois rode de novo.');
    return;
  }

  console.log(`${grupos.length} grupo(s) encontrado(s):\n`);
  for (const g of grupos) {
    console.log(`  ${g.subject}`);
    console.log(`  GRUPO_ASSESSORES_JID=${g.id}`);
    console.log(`  participantes: ${g.size ?? '?'}\n`);
  }
}

main();
