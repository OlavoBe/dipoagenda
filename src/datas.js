// Helpers de data/hora.
// O Brasil nao adota mais horario de verao desde 2019, entao Sao Paulo e
// UTC-3 fixo. Isso permite calcular limites de dia sem dependencias extras.

const SP_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3

function partesSP(date = new Date()) {
  const local = new Date(date.getTime() + SP_OFFSET_MS);
  return {
    ano: local.getUTCFullYear(),
    mes: local.getUTCMonth(), // 0-11
    dia: local.getUTCDate(),
  };
}

// Instante (UTC) correspondente a 00:00 em Sao Paulo do dia informado.
function inicioDoDiaSP(date = new Date()) {
  const { ano, mes, dia } = partesSP(date);
  return new Date(Date.UTC(ano, mes, dia, 0, 0, 0) - SP_OFFSET_MS);
}

function fimDoDiaSP(date = new Date()) {
  return new Date(inicioDoDiaSP(date).getTime() + 24 * 60 * 60 * 1000);
}

function daquiADias(dias, date = new Date()) {
  return new Date(date.getTime() + dias * 24 * 60 * 60 * 1000);
}

// Combina "YYYY-MM-DD" + "HH:mm" (hora opcional) num instante UTC.
function montarDataHora(dataStr, horaStr) {
  if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return null;
  const [a, m, d] = dataStr.split('-').map(Number);
  let h = 0;
  let min = 0;
  if (horaStr && /^\d{1,2}:\d{2}$/.test(horaStr)) {
    [h, min] = horaStr.split(':').map(Number);
  }
  return new Date(Date.UTC(a, m - 1, d, h, min, 0) - SP_OFFSET_MS);
}

function dataHojeISO() {
  const { ano, mes, dia } = partesSP();
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const DIAS_SEMANA = [
  'domingo', 'segunda-feira', 'terca-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sabado',
];

function diaDaSemanaHoje() {
  // getUTCDay no instante deslocado da o dia da semana em SP
  const local = new Date(Date.now() + SP_OFFSET_MS);
  return DIAS_SEMANA[local.getUTCDay()];
}

function formatarData(date) {
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatarHora(date) {
  return new Date(date).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = {
  SP_OFFSET_MS,
  inicioDoDiaSP,
  fimDoDiaSP,
  daquiADias,
  montarDataHora,
  dataHojeISO,
  diaDaSemanaHoje,
  formatarData,
  formatarHora,
};
