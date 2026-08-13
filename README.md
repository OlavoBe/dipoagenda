# Dipo Agenda — Gabinete da Câmara Municipal de Guarujá/SP

Assistente de agenda que vive num grupo de WhatsApp. Os assessores escrevem o
compromisso em linguagem normal, a IA extrai os dados, o sistema salva e
confirma no grupo. O vereador e os assessores consultam a agenda por comandos.

O bot só age quando é chamado — o resto da conversa do grupo passa em branco.

## Stack
- Node.js + Express
- Prisma ORM + PostgreSQL
- Evolution API (WhatsApp, via Baileys)
- OpenAI — `gpt-4o` com function calling
- node-cron (lembretes, resumo diário, monitor de conexão)

## Comandos

Todo comando começa com `!`. Sem o prefixo, o Dipo ignora.

| Comando | O que faz |
| --- | --- |
| `!dipo <compromisso>` | Registra. Atalho: `!d`. Aceita vários eventos na mesma mensagem |
| `!hoje` | Compromissos de hoje |
| `!semana` | Hoje e os próximos 7 dias |
| `!resumo` | Toda a agenda que vem pela frente, sem limite de data |
| `!ajuda` | Lista os comandos no próprio grupo |

Mencionar o bot (`@Dipo`) equivale ao `!dipo`.

Quando falta um dado, o Dipo pergunta — e a resposta pode vir solta, sem
repetir o prefixo. A pendência vale 10 minutos e só para quem foi perguntado.

**Demanda e indicação estão desligadas.** A IA ainda reconhece as duas para o
Dipo poder avisar que não registra; ficar mudo faria o assessor achar que
salvou. As tabelas seguem no banco, aguardando a integração com o Dipo
Indicações.

## Quem pode usar

A permissão é por **origem**, não por pessoa:

- Dentro do grupo autorizado (`GRUPO_ASSESSORES_JID`): todos registram e consultam.
- No privado do vereador (`VEREADOR_NUMERO`): consultas funcionam; registro não.
- No privado de quem acompanha (`ADMIN_NUMEROS`): mesmas permissões do vereador.
- Qualquer outra origem é descartada **em silêncio**, sem tocar no banco.

`ADMIN_NUMEROS` é uma lista separada por vírgula. Esses números recebem também
os informes automáticos (lembrete de 1h e bom-dia das 07h), para conferir o que
está chegando no vereador e testar o que sobe sem depender do relato dele.

O silêncio é deliberado: responder automaticamente a desconhecido é o caminho
mais curto para o número ser denunciado como spam e banido.

## Estrutura
```
src/
  server.js        Express, rota POST /webhook e /status
  ai.js            Extração dos compromissos (OpenAI function calling)
  handlers.js      Persiste e monta a confirmação
  queries.js       Comandos, textos de agenda e ajuda
  gatilho.js       Detecta "!dipo"/"!d" e menção ao bot
  conversa.js      Perguntas em aberto (resposta sem prefixo)
  notificacoes.js  Lembretes e despacho
  monitor.js       Vigia a conexão do WhatsApp
  cron.js          Lembretes, bom-dia das 07h, monitor a cada 2 min
  whatsapp.js      Envio e estado da instância (Evolution)
  datas.js         Datas no fuso de São Paulo (UTC-3 fixo)
  config.js        Variáveis de ambiente
  db.js            Cliente Prisma
scripts/
  conectar.js      Estado da instância; gera o QR quando cai
  grupos.js        Lista os grupos e mostra o JID de cada um
  webhook.js       Aponta o webhook da Evolution para a aplicação
  migrar.js        Migrations com baseline automático (ver P3005 abaixo)
  limpar.js        Zera os dados; só age com LIMPAR_BANCO=APAGAR-TUDO
```

## Rodar local
```bash
npm install
cp .env.example .env      # preencha as variáveis
npm run db:migrate
npm run dev               # http://localhost:3000
```

Para a Evolution alcançar o webhook em desenvolvimento, exponha a porta
(ex.: `ngrok http 3000`) e rode `npm run webhook -- https://SEU_HOST/webhook`.

## Trabalhar de outra máquina

```bash
git clone https://github.com/OlavoBe/dipoagenda.git
cd dipoagenda
npm install
cp .env.example .env
```

O `.env` não vai para o Git. Pegue os valores no Railway: serviço `dipoagenda`
→ **Variables** → **Raw Editor** → *Copy ENV*.

Uma variável precisa de atenção. No Railway, `DATABASE_URL` é uma referência
interna (`${{Postgres-yNrp.DATABASE_URL}}`) e o banco **não tem endereço
público** — de fora do Railway você não alcança o banco de produção. Copiar
essa linha como está não funciona.

O que dá para fazer localmente:

| Tarefa | Basta ter |
| --- | --- |
| `npm run conectar` / `grupos` / `webhook` | as variáveis `EVOLUTION_*` |
| Testar a extração da IA | `OPENAI_API_KEY` |
| Subir o app inteiro (`npm run dev`) | um PostgreSQL local em `DATABASE_URL` |

Na prática, o dia a dia de manutenção não precisa do banco: edita, faz push,
e valida testando no grupo.

### Publicar uma alteração

O deploy é automático — todo push na `main` dispara build e deploy.

```bash
git pull
# edite os arquivos
git commit -am "descrição da mudança"
git push
```

Para saber que o container novo subiu, acompanhe `/status`: o `uptimeSegundos`
volta para perto de zero quando a versão nova entra.

## Operação

```bash
npm run conectar   # estado da sessão; gera QR se estiver caída
npm run grupos     # descobre o GRUPO_ASSESSORES_JID
npm run webhook    # mostra ou define o webhook da Evolution
```

### Monitoramento

- `GET /health` — o processo está de pé. Sempre 200, inclusive com o WhatsApp
  caído: se devolvesse erro, a plataforma ficaria reiniciando o container à toa.
- `GET /status` — estado do WhatsApp e uptime do processo. Devolve **503**
  quando a sessão cai, para um monitor externo (UptimeRobot e afins) alertar
  por e-mail. É o único canal que funciona nessa hora — com o WhatsApp fora,
  não dá para avisar por WhatsApp.

Quando a conexão volta, o Dipo avisa no grupo quanto tempo ficou fora.

### Quando a sessão do WhatsApp cai

O erro típico é `conflict / device_removed`: o WhatsApp removeu o aparelho
vinculado. Não é banimento nem bug da aplicação. O que evita:

- **Um vínculo só.** Cada QR escaneado cria um aparelho novo; vários vínculos
  no mesmo número brigam entre si. Deslogue antes de parear de novo.
- O celular do bot precisa ficar online.
- Não usar esse número no WhatsApp Web.

Para reconectar: `npm run conectar` e escaneie. O painel da Evolution
(`/manager`) também mostra o QR, útil quando não há computador por perto.

## Deploy (Railway)

- Start: `node scripts/migrar.js && node scripts/limpar.js && node src/server.js`
- `DATABASE_URL` aponta para um PostgreSQL **dedicado**, com
  `?connection_limit=5`. Não compartilhe o banco da Evolution: ela mantém
  dezenas de conexões ociosas e esgota o limite.

### P3005 no primeiro deploy

A plataforma roda `prisma db push` no build, o que cria as tabelas sem a
tabela de histórico `_prisma_migrations`. Nesse estado o `prisma migrate
deploy` aborta com `P3005` e o serviço não sobe. O `scripts/migrar.js` detecta
isso, marca as migrations como aplicadas (baseline) e tenta de novo.

## Notificações automáticas

- **1h antes** de cada compromisso: lembrete no grupo, no privado do vereador e
  de quem acompanha. Compromisso sem horário não gera lembrete — ancorado à
  meia-noite, ele dispararia às 23h da véspera.
- **07:00** (fuso SP): a agenda da semana no privado do vereador e de quem
  acompanha.

Para o privado funcionar, o número do vereador precisa ter conversa
estabelecida com o número do bot. Sem isso o WhatsApp pode recusar a entrega,
e a falha é silenciosa.

## Decisões e premissas

- **Anti-loop:** mensagens com `key.fromMe = true` são ignoradas.
- **Dedup:** cada `message.id` vai para `mensagens_processadas` — depois da
  checagem de origem, para que flood de desconhecido não encha a tabela.
- **LID:** em grupos o WhatsApp entrega o remetente como `...@lid`, não como
  número. O número real vem em `participantAlt`; comparar com o `participant`
  faz a identificação do vereador falhar sempre.
- **Confirmação vem do banco:** o texto confirmado no grupo é montado a partir
  do que foi realmente gravado, não do que a IA sugeriu. Confirmar um
  compromisso que não entrou é o pior erro possível aqui.
- **Fuso:** São Paulo é UTC-3 fixo (sem horário de verão desde 2019).
- **Evolution v2** no envio (`{ number, text }`). Na v1 o corpo é
  `{ number, textMessage: { text } }` — ajuste em `src/whatsapp.js`.
