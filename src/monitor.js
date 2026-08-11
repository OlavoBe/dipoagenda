// Vigia a conexao do WhatsApp.
//
// A instancia cai sozinha de vez em quando (o WhatsApp remove o aparelho
// vinculado) e isso e 100% silencioso: os registros continuam sendo gravados,
// mas nenhuma confirmacao sai e ninguem percebe ate alguem reclamar.
//
// Detalhe que define o desenho: quando o WhatsApp esta fora, nao da para
// avisar POR WhatsApp. Entao aqui a gente faz o que e possivel:
//   - registra a queda no log, com destaque;
//   - expoe o estado em /status, para um monitor externo (UptimeRobot e afins)
//     conseguir alertar por e-mail/push quando o WhatsApp cair;
//   - avisa no grupo quando VOLTA, que e a unica hora em que o aviso chega.

const { config } = require('./config');
const { enviarTexto, estadoConexao } = require('./whatsapp');

// Ultimo estado conhecido. null = ainda nao checamos nada.
let ultimoEstado = null;
let quedaDesde = null;

function estaNoAr(estado) {
  return estado === 'open';
}

function formatarDuracao(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}

async function verificarConexao() {
  const estado = await estadoConexao();

  // Nao conseguimos perguntar (Evolution fora, rede ruim): nao da para
  // concluir nada, entao nao mexe no estado para nao gerar alarme falso.
  if (estado === null) return;

  const agoraNoAr = estaNoAr(estado);
  const antesNoAr = ultimoEstado === null ? null : estaNoAr(ultimoEstado);
  ultimoEstado = estado;

  // Primeira checagem depois de subir: so registra, sem anunciar nada.
  if (antesNoAr === null) {
    console.log(`[monitor] estado inicial do WhatsApp: ${estado}`);
    if (!agoraNoAr) quedaDesde = Date.now();
    return;
  }

  if (antesNoAr && !agoraNoAr) {
    quedaDesde = Date.now();
    console.error(
      `[monitor] WHATSAPP CAIU (estado: ${estado}). ` +
        'Registros continuam sendo gravados, mas nenhuma mensagem sai. ' +
        'Refaca o pareamento com: npm run conectar',
    );
    return;
  }

  if (!antesNoAr && agoraNoAr) {
    const duracao = quedaDesde ? formatarDuracao(Date.now() - quedaDesde) : null;
    quedaDesde = null;
    console.log(`[monitor] WhatsApp reconectou${duracao ? ` (ficou ${duracao} fora)` : ''}.`);

    if (config.grupoAssessoresJid) {
      const quanto = duracao ? ` Fiquei ${duracao} sem conexão.` : '';
      await enviarTexto(
        config.grupoAssessoresJid,
        `*Voltei.*${quanto} O que foi registrado nesse período está salvo — só as confirmações não chegaram a sair.`,
      );
    }
  }
}

// Estado para o endpoint /status, consumido por monitor externo.
// "processoDesde"/"uptimeSegundos" servem para diagnosticar reinicios: se o
// uptime volta para perto de zero de tempo em tempo, o container esta caindo
// e reiniciando - que e diferente do WhatsApp desconectar com o app de pe.
function estadoAtual() {
  const uptimeSegundos = Math.round(process.uptime());
  return {
    whatsapp: ultimoEstado,
    noAr: ultimoEstado === null ? null : estaNoAr(ultimoEstado),
    quedaDesde: quedaDesde ? new Date(quedaDesde).toISOString() : null,
    uptimeSegundos,
    processoDesde: new Date(Date.now() - uptimeSegundos * 1000).toISOString(),
  };
}

module.exports = { verificarConexao, estadoAtual };
