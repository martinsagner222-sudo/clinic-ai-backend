import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

/*
=====================================================
VALIDAÇÃO DE AMBIENTE
=====================================================
*/
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL não carregou do .env");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY não carregou do .env");
}

/*
=====================================================
CLIENT SUPABASE
=====================================================
*/
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/*
=====================================================
BUSCAR MEMÓRIA COMPLETA (MULTIEMPRESA)
=====================================================
*/
export async function buscarMemoria(empresaId, telefone) {
  if (!empresaId) {
    throw new Error("empresaId não informado");
  }

  // 1️⃣ GARANTIR CLIENTE
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("telefone", telefone)
    .maybeSingle();

  if (!cliente) {
    await supabase.from("clientes").insert({
      empresa_id: empresaId,
      telefone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // 2️⃣ BUSCAR ATENDIMENTO
  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("telefone", telefone)
    .maybeSingle();

  if (atendimento) return atendimento;

  const novoAtendimento = {
    empresa_id: empresaId,
    telefone,
    status: "inicio",
    contexto: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("atendimentos").insert(novoAtendimento);

  return novoAtendimento;
}

/*
=====================================================
SALVAR MEMÓRIA COMPLETA (MULTIEMPRESA)
=====================================================
*/
export async function salvarMemoria(empresaId, telefone, memoria) {
  if (!empresaId) {
    throw new Error("empresaId não informado");
  }

  const payload = {
    empresa_id: empresaId,
    telefone,
    status: memoria.status || "inicio",
    contexto: memoria.contexto || {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("atendimentos")
    .upsert(payload, {
      onConflict: "empresa_id,telefone",
    });

  if (error) {
    throw new Error("Erro ao salvar memória: " + error.message);
  }
}