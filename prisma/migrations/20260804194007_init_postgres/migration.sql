-- CreateTable
CREATE TABLE "compromissos" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "local" TEXT,
    "tipo" TEXT,
    "criado_por" TEXT,
    "descricao" TEXT,
    "lembrete_enviado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compromissos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandas" (
    "id" SERIAL NOT NULL,
    "cidadao_nome" TEXT NOT NULL,
    "bairro" TEXT,
    "logradouro" TEXT,
    "tipo" TEXT,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Recebida',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_indicacao" (
    "id" SERIAL NOT NULL,
    "assunto" TEXT NOT NULL,
    "logradouro" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "referencia" TEXT,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_indicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "destinatario_numero" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviar_em" TIMESTAMP(3) NOT NULL,
    "enviada" BOOLEAN NOT NULL DEFAULT false,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_processadas" (
    "id" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_processadas_pkey" PRIMARY KEY ("id")
);
