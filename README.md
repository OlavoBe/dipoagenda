# Sistema de Gabinete — Câmara Municipal de Guarujá/SP

Núcleo (MVP) do sistema de gestão de gabinete via WhatsApp + IA. Os assessores
escrevem num grupo de WhatsApp; a IA classifica cada mensagem como **agenda**,
**demanda** ou **pedido de indicação**, salva no banco e confirma no grupo. O
vereador consulta a agenda e as demandas por comandos diretos.

## Stack
- Node.js + Express
- Prisma ORM + SQLite (migrar para PostgreSQL/Neon depois)
- Evolution API (WhatsApp)
- Anthropic API — `claude-sonnet-4-6`
- node-cron (resumo diário e lembretes)

## Estrutura
```
src/
  server.js        Express + rota POST /webhook (entrada de tudo)
  ai.js            Classificação/extração via Claude (tool use)
  handlers.js      Processa mensagens do grupo e persiste
  queries.js       Comandos do vereador + geradores de resumo
  notificacoes.js  Lembretes e despacho de notificações
  cron.js          Resumo diário (07h) e despacho a cada minuto
  whatsapp.js      Envio via Evolution API
  datas.js         Helpers de data/hora (fuso de São Paulo, UTC-3)
  config.js        Variáveis de ambiente
  db.js            Cliente Prisma
prisma/schema.prisma
```

## Como rodar (local, WSL2/Ubuntu)
```bash
npm install
cp .env.example .env      # preencha as variáveis
npm run db:migrate        # cria o banco e gera o client
npm run dev               # sobe em http://localhost:3000
```

Para a Evolution alcançar seu webhook em desenvolvimento, exponha a porta
(ex.: `ngrok http 3000`) e use a URL pública no passo abaixo.

## Configurar o webhook na Evolution API
Aponte o webhook da instância para `https://SEU_HOST/webhook` e habilite o
evento `MESSAGES_UPSERT`. Exemplo:
```bash
curl -X POST "$EVOLUTION_API_URL/webhook/set/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"https://SEU_HOST/webhook","events":["MESSAGES_UPSERT"]}}'
```

### Descobrir o JID do grupo
Mande uma mensagem qualquer no grupo e veja o `remoteJid` (termina em `@g.us`)
nos logs do servidor — use esse valor em `GRUPO_ASSESSORES_JID`.

## Comandos do vereador (mensagem direta)
- `hoje` / `agenda hoje` — compromissos do dia
- `semana` / `agenda semana` — próximos 7 dias
- `pendentes` / `demandas` — demandas não resolvidas
- `resumo` — agenda de hoje + demandas pendentes

Respostas formatadas para WhatsApp (negrito com `*asteriscos*`).

## Notificações automáticas
- **07:00** (fuso SP): resumo diário enviado ao vereador.
- **1h antes** de cada compromisso: lembrete ao vereador.

## Deploy no Render
- Build: `npm install && npm run db:generate`
- Start: `npm run db:deploy && npm start`
- Variáveis de ambiente: as mesmas do `.env`.
- Disco persistente para o SQLite (ou já migrar para Neon/PostgreSQL).

## Decisões e premissas
- **Loop:** mensagens com `key.fromMe = true` são ignoradas.
- **Dedup:** cada `message.id` é registrado em `mensagens_processadas`.
- **Só registra com dado concreto;** quando a intenção é clara mas falta um dado
  essencial, a IA marca `precisa_confirmar` e o sistema pergunta no grupo.
- **Fuso:** São Paulo é UTC-3 fixo (sem horário de verão desde 2019).
- **Formato do envio** segue a Evolution API v2 (`{ number, text }`). Em v1 o
  corpo é `{ number, textMessage: { text } }` — ajuste em `src/whatsapp.js`.
