// Mostra o estado da instancia e, se estiver desconectada, gera o QR Code
// para parear o WhatsApp do Dipo.
// Uso: npm run conectar
const fs = require('fs');
const path = require('path');
const { chamar, instancia } = require('./evolution');

async function main() {
  const estado = await chamar(`/instance/connectionState/${instancia}`);
  const situacao = estado?.instance?.state;

  if (situacao === 'open') {
    // Ja conectada: mostra qual numero esta pareado.
    const [info] = await chamar(`/instance/fetchInstances?instanceName=${instancia}`);
    console.log('Conectada.');
    console.log('  numero:', info?.ownerJid);
    console.log('  perfil:', info?.profileName);
    return;
  }

  console.log(`Instancia "${instancia}" esta ${situacao}. Gerando QR Code...`);
  const conexao = await chamar(`/instance/connect/${instancia}`);

  if (!conexao?.base64) {
    console.log('A Evolution nao devolveu QR Code. Resposta:');
    console.log(JSON.stringify(conexao, null, 2));
    return;
  }

  const destino = path.join(__dirname, '..', 'qrcode.png');
  const base64 = conexao.base64.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(destino, Buffer.from(base64, 'base64'));

  console.log(`\nQR Code salvo em: ${destino}`);
  console.log('No celular do Dipo: WhatsApp > Aparelhos conectados > Conectar um aparelho.');
  console.log('O QR expira em ~40s; se perder, rode o comando de novo.');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  if (err.corpo) console.error(JSON.stringify(err.corpo, null, 2));
  process.exit(1);
});
