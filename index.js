import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

import { buscarMemoria, salvarMemoria } from "./brain/memoriaAtendimento.js";
import { decidirProximoPasso } from "./brain/decisorIA.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/*
========================================
VALIDAÇÃO DE VARIÁVEIS
========================================
*/
const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EVOLUTION_URL"
];

for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} não definida`);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/*
========================================
WEBHOOK EVOLUTION
========================================
*/
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (!body?.data) {
      return res.status(200).send("IGNORADO");
    }

    const instanceName = body.instance;
    if (!instanceName) {
      return res.status(400).send("Instância não informada");
    }

    const { data: conexao, error } = await supabase
      .from("conexoes_whatsapp")
      .select("*")
      .eq("evolution_instance", instanceName)
      .maybeSingle();

    if (error) {
      console.log("Erro ao buscar conexão:", error.message);
      return res.status(500).send("Erro banco");
    }

    if (!conexao) {
      return res.status(400).send("Empresa não encontrada");
    }

    const empresaId = conexao.empresa_id;

    const telefone =
      body?.data?.key?.remoteJid
        ?.replace("@c.us", "")
        ?.replace("@lid", "") || null;

    let mensagem = null;

    if (body?.data?.message?.conversation) {
      mensagem = body.data.message.conversation;
    } else if (body?.data?.message?.extendedTextMessage?.text) {
      mensagem = body.data.message.extendedTextMessage.text;
    }

    if (!telefone || !mensagem) {
      return res.status(200).send("IGNORADO");
    }

    await supabase.from("mensagens").insert([
      {
        empresa_id: empresaId,
        telefone,
        direcao: "entrada",
        conteudo: mensagem,
      },
    ]);

    const memoriaAtual = await buscarMemoria(empresaId, telefone);

    const decisaoIA = await decidirProximoPasso({
      atendimento: memoriaAtual,
      mensagem,
    });

    await salvarMemoria(empresaId, telefone, {
      status: decisaoIA.novoStatus,
      contexto: decisaoIA.contexto,
    });

    await supabase.from("mensagens").insert([
      {
        empresa_id: empresaId,
        telefone,
        direcao: "saida",
        conteudo: decisaoIA.resposta,
      },
    ]);

    const url = `https://${process.env.EVOLUTION_URL}/message/sendText/${instanceName}`;

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: conexao.evolution_api_key,
      },
      body: JSON.stringify({
        number: telefone,
        text: decisaoIA.resposta,
      }),
    });

    return res.status(200).send("OK");
  } catch (err) {
    console.log("Erro geral:", err);
    return res.status(500).send("ERRO");
  }
});

/*
========================================
HEALTHCHECK
========================================
*/
app.get("/", (req, res) => {
  res.status(200).send("Brain multiempresa online");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});