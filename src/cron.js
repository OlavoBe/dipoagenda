const cron = require('node-cron');
const { config } = require('./config');
const { enviarTexto } = require('./whatsapp');
const { despacharPendentes } = require('./notificacoes');
// O bom-dia usa a agenda da semana, nao o !resumo: desde que "resumo" virou
// a agenda inteira que vem pela frente, mandar aquilo toda manha seria uma
// parede de texto com compromissos de meses adiante.
const { textoAgendaSemana } = require('./queries');
const { verificarConexao } = require('./monitor');

function iniciarCron() {
  // A cada 2 minutos: vigia a conexao do WhatsApp.
  cron.schedule('*/2 * * * *', async () => {
    try {
      await verificarConexao();
    } catch (err) {
      console.error('[cron] erro ao verificar conexao:', err.message);
    }
  });

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
      // Vai para o vereador e para quem acompanha o sistema.
      const destinos = [...new Set([config.vereadorNumero, ...config.adminNumeros].filter(Boolean))];
      if (!destinos.length) return;
      try {
        const agenda = await textoAgendaSemana();
        for (const destino of destinos) {
          await enviarTexto(destino, `*Bom dia!*\n\n${agenda}`);
        }
      } catch (err) {
        console.error('[cron] erro no resumo diario:', err.message);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );

  console.log(
    '[cron] agendamentos ativos (lembretes a cada minuto, resumo as 07:00, conexao a cada 2 min).',
  );
}

module.exports = { iniciarCron };
