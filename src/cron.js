const cron = require('node-cron');
const { config } = require('./config');
const { enviarTexto } = require('./whatsapp');
const { despacharPendentes } = require('./notificacoes');
const { textoResumo } = require('./queries');

function iniciarCron() {
  // A cada minuto: envia notificacoes/lembretes vencidos.
  cron.schedule('* * * * *', async () => {
    try {
      await despacharPendentes();
    } catch (err) {
      console.error('[cron] erro no despacho de notificacoes:', err.message);
    }
  });

  // Todo dia as 07:00 (horario de Sao Paulo): resumo diario para o vereador.
  cron.schedule(
    '0 7 * * *',
    async () => {
      if (!config.vereadorNumero) return;
      try {
        const resumo = await textoResumo();
        await enviarTexto(config.vereadorNumero, `*Bom dia! Resumo do dia*\n\n${resumo}`);
      } catch (err) {
        console.error('[cron] erro no resumo diario:', err.message);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );

  console.log('[cron] agendamentos ativos (lembretes a cada minuto, resumo as 07:00).');
}

module.exports = { iniciarCron };
