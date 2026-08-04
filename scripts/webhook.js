// Aponta o webhook da Evolution para a URL da aplicacao e mostra como ficou.
// Uso: npm run webhook -- https://dipoagenda-production.up.railway.app/webhook
//      npm run webhook              (so mostra a configuracao atual)
const { chamar, instancia } = require('./evolution');
const { config } = require('../src/config');

async function mostrarAtual() {
  try {
    const atual = await chamar(`/webhook/find/${instancia}`);
    console.log('Webhook atual:');
    console.log('  url:', atual?.url || '(nenhuma)');
    console.log('  habilitado:', atual?.enabled);
    console.log('  eventos:', (atual?.events || []).join(', ') || '(nenhum)');
  } catch (err) {
    console.log('Nenhum webhook configurado ainda.');
  }
}

async function main() {
  let url = process.argv[2];

  if (!url) {
    await mostrarAtual();
    console.log('\nPara definir: npm run webhook -- https://sua-app.up.railway.app/webhook');
    return;
  }

  // Se houver WEBHOOK_TOKEN no .env, anexa como query param (o server valida).
  if (config.webhookToken && !url.includes('token=')) {
    url += `${url.includes('?') ? '&' : '?'}token=${config.webhookToken}`;
  }

  await chamar(`/webhook/set/${instancia}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        // So precisamos das mensagens recebidas.
        events: ['MESSAGES_UPSERT'],
        webhookByEvents: false,
        webhookBase64: false,
      },
    }),
  });

  console.log('Webhook configurado.\n');
  await mostrarAtual();
}

main().catch((err) => {
  console.error('Erro:', err.message);
  if (err.corpo) console.error(JSON.stringify(err.corpo, null, 2));
  process.exit(1);
});
