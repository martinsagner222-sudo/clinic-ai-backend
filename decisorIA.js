import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * DECISOR CENTRAL DE IA
 * Recebe o estado atual do atendimento + mensagem
 * Retorna:
 * - resposta ao usuário
 * - novo status da conversa
 * - contexto atualizado (memória curta)
 */
export async function decidirProximoPasso({ atendimento, mensagem }) {
  if (!atendimento || !mensagem) {
    throw new Error("decisorIA: atendimento ou mensagem ausentes")
  }

  const promptSistema = `
Você é um agente de WhatsApp de uma clínica.
Você NÃO segue regras fixas.
Você decide com inteligência.

Seu trabalho é:
1. Responder o usuário de forma humana e objetiva
2. Decidir o próximo STATUS da conversa
3. Atualizar o CONTEXTO se necessário

STATUS POSSÍVEIS:
- inicio
- aguardando_horario
- horario_confirmado
- conversa

Você SEMPRE deve responder em JSON válido.
`

  const promptUsuario = `
DADOS DO ATENDIMENTO:
Status atual: ${atendimento.status}
Contexto atual: ${JSON.stringify(atendimento.contexto)}

MENSAGEM DO USUÁRIO:
"${mensagem}"

Retorne exatamente neste formato:

{
  "resposta": "texto para o usuário",
  "novoStatus": "status",
  "contexto": { }
}
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: promptSistema },
      { role: "user", content: promptUsuario }
    ]
  })

  const conteudo = completion.choices[0].message.content

  let decisao
  try {
    decisao = JSON.parse(conteudo)
  } catch (err) {
    throw new Error("decisorIA: IA retornou JSON inválido")
  }

  if (!decisao.resposta || !decisao.novoStatus) {
    throw new Error("decisorIA: resposta ou status ausente")
  }

  return {
    resposta: decisao.resposta,
    novoStatus: decisao.novoStatus,
    contexto: decisao.contexto ?? atendimento.contexto
  }
}
