const OpenAI = require('openai');
const { config } = require('./config');
const { dataHojeISO, diaDaSemanaHoje } = require('./datas');

const client = new OpenAI({ apiKey: config.openaiApiKey });

// Ferramenta que forca a saida estruturada da classificacao.
const ferramenta = {
  type: 'function',
  function: {
    name: 'registrar',
    description:
      'Classifica a mensagem recebida no grupo de assessores e extrai os dados estruturados correspondentes.',
    parameters: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['AGENDA', 'DEMANDA', 'INDICACAO', 'IGNORAR'],
          description: 'Categoria da mensagem.',
        },
        precisa_confirmar: {
          type: 'boolean',
          description:
            'true quando a mensagem e ambigua ou faltam dados essenciais (ex.: data de um compromisso, nome do cidadao).',
        },
        compromisso: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            data: { type: 'string', description: 'Data no formato YYYY-MM-DD.' },
            hora: { type: 'string', description: 'Horario no formato HH:mm, se houver.' },
            local: { type: 'string' },
            tipo: {
              type: 'string',
              enum: ['Reuniao', 'Visita', 'Sessao', 'Evento', 'Outros'],
            },
            descricao: { type: 'string' },
          },
        },
        demanda: {
          type: 'object',
          properties: {
            cidadao_nome: { type: 'string' },
            bairro: { type: 'string' },
            logradouro: { type: 'string' },
            tipo: {
              type: 'string',
              enum: ['Buraco', 'Documento', 'Causa Animal', 'Saude', 'Iluminacao', 'Limpeza', 'Outros'],
            },
            descricao: { type: 'string' },
          },
        },
        indicacao: {
          type: 'object',
          properties: {
            assunto: { type: 'string' },
            logradouro: { type: 'string', description: 'Nome completo da via.' },
            bairro: { type: 'string' },
            cep: { type: 'string' },
            referencia: { type: 'string', description: 'Ponto de referencia / proximidade.' },
            descricao: { type: 'string' },
          },
        },
        resposta: {
          type: 'string',
          description:
            'Confirmacao curta e objetiva para enviar no grupo, iniciando com a tag entre colchetes (ex.: "[AGENDA] ..."). Sem emojis excessivos. Em portugues do Brasil.',
        },
      },
      required: ['tipo', 'precisa_confirmar', 'resposta'],
    },
  },
};

function sistema() {
  return `Voce assiste o gabinete de um vereador da Camara Municipal de Guaruja/SP.
Sua funcao e ler mensagens enviadas pelos assessores num grupo de WhatsApp e classifica-las.

Hoje e ${dataHojeISO()} (${diaDaSemanaHoje()}). Use isso para resolver datas relativas
("amanha", "sexta", "dia 10") sempre no formato YYYY-MM-DD.

Categorias:
- AGENDA: compromisso com data (reuniao, visita, sessao, evento).
- DEMANDA: solicitacao de um cidadao (buraco, documento, causa animal, saude, iluminacao, limpeza, etc.).
- INDICACAO: pedido para redigir uma indicacao legislativa (melhoria/servico publico num local).
- IGNORAR: conversa, bom dia, combinados sem dado concreto, ou mensagem que ja e uma resposta do sistema.

Regras:
- So registre (AGENDA/DEMANDA/INDICACAO) se houver dado CONCRETO: uma data, um nome de cidadao,
  ou um local/assunto especifico. Sem isso, use IGNORAR.
- Marque precisa_confirmar = true quando a intencao for clara mas faltar um dado essencial
  (ex.: compromisso sem data, demanda sem nome do cidadao). Nesse caso, a "resposta" deve pedir
  esse dado de forma curta.
- Para INDICACAO, capture o local com a maior precisao possivel: logradouro completo, bairro,
  CEP e ponto de referencia, separados nos campos certos. Nao misture vias diferentes.
- "resposta" sempre comeca com a tag entre colchetes e e curta. Para IGNORAR, use "[IGNORAR]".
- Responda exclusivamente chamando a ferramenta "registrar".`;
}

// Recebe o texto e retorna o objeto estruturado da ferramenta.
async function classificar(texto) {
  const resp = await client.chat.completions.create({
    model: config.modelo,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: sistema() },
      { role: 'user', content: texto },
    ],
    tools: [ferramenta],
    tool_choice: { type: 'function', function: { name: 'registrar' } },
  });

  const chamada = resp.choices[0]?.message?.tool_calls?.[0];
  if (!chamada) {
    return { tipo: 'IGNORAR', precisa_confirmar: false, resposta: '[IGNORAR]' };
  }
  return JSON.parse(chamada.function.arguments);
}

module.exports = { classificar };
