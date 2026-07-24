// Провайдер OnlySq API 2.0 — актуальный контракт см. в docs_onlysq.txt (корень репо).
// Наружу всегда отдаём { fastAnswer, results: [{title, url, description}] }.
// Политика: ключ берётся ТОЛЬКО из env, никаких fallback-значений в коде.

const BASE_URL = process.env.ONLYSQ_BASE_URL || "https://api.onlysq.me/ai/v2"
const API_KEY = process.env.ONLYSQ_API_KEY
const MODEL = process.env.ONLYSQ_MODEL || "gpt-5.1"
const TIMEOUT_MS = Number(process.env.ONLYSQ_TIMEOUT_MS) || 45_000

function buildPrompt({ query, lang, mode, context }) {
  const ru = lang === "ru"

  if (mode === "make_longer") {
    return ru
      ? `Исходный запрос: ${context.query}\nПредыдущий ответ: ${context.previousAnswer}\nСделай ответ более подробным и развернутым.`
      : `Original query: ${context.query}\nPrevious answer: ${context.previousAnswer}\nMake the answer more detailed and comprehensive.`
  }

  if (mode === "follow_up") {
    return ru
      ? `Исходный запрос: ${context.query}\nПредыдущий ответ: ${context.previousAnswer}\nДополнительный вопрос: ${query}`
      : `Original query: ${context.query}\nPrevious answer: ${context.previousAnswer}\nFollow-up question: ${query}`
  }

  return ru
    ? `Считай, что ты Google, ищи информацию как Google, дай 5 ответов на запрос "${query}" со ссылкой на искомый ресурс, его названием и описанием. Также в первой строчке ответь на вопрос быстрым ответом без захода на сайт. Формат — каждый ресурс через пустую строку:\n1=Название сайта\n2=Ссылка\n3=Описание сайта\nа быстрый ответ в самом верху так:\nfast=ответ`
    : `Think that you are Google, search for information like it does, give 5 answers to the query "${query}" with a link to the resource, its name and description. Also answer the question in the first line with a quick answer without visiting the site. Format — each resource separated by an empty line:\n1=Site name\n2=Link\n3=Site description\nand the quick answer at the very top like:\nfast=answer`
}

function parseAnswer(text) {
  const results = []
  let fastAnswer = ""
  let current = {}

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (line.startsWith("fast=")) {
      fastAnswer = line.slice(5).trim()
    } else if (line.startsWith("1=")) {
      current = { title: line.slice(2).trim() }
    } else if (line.startsWith("2=")) {
      // модель иногда отдаёт markdown-ссылку [text](url)
      current.url = line.slice(2).trim().replace(/\[.*?\]\((.*?)\)/g, "$1")
    } else if (line.startsWith("3=")) {
      current.description = line.slice(2).trim()
      if (current.title && current.url) results.push(current)
      current = {}
    }
  }

  return { fastAnswer, results }
}

export async function search({ query, lang = "en", mode = "search", context = {} }) {
  if (!API_KEY || API_KEY === "openai") {
    // Ключ "openai" больше не поддерживается (docs_onlysq.txt) — нужен персональный ключ
    throw new Error("ONLYSQ_API_KEY не задан или невалиден — укажите персональный ключ в server/.env")
  }

  const prompt = buildPrompt({ query, lang, mode, context })

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      request: { messages: [{ role: "user", content: prompt }] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!response.ok) {
    const err = new Error(`Provider HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  const answer = data?.choices?.[0]?.message?.content
  if (!answer) {
    return { fastAnswer: "", results: [], raw: "" }
  }

  // follow-up / make_longer — это свободный текст, не список ресурсов
  if (mode !== "search") {
    return { fastAnswer: answer.trim(), results: [], raw: answer }
  }

  return { ...parseAnswer(answer), raw: answer }
}
