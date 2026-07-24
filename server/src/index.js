import "dotenv/config"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import cors from "cors"
import rateLimit from "express-rate-limit"
import * as provider from "./providers/onlysq.js"

const PORT = Number(process.env.PORT) || 3000
const app = express()

app.use(express.json({ limit: "16kb" }))

// В проде ограничиваем origin доменом сайта (список через запятую в ALLOWED_ORIGINS).
// Если переменная не задана (dev) — разрешаем всё, как раньше.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors(ALLOWED_ORIGINS.length ? { origin: ALLOWED_ORIGINS } : {}))

// Настоящий rate limit вместо клиентского
app.use(
  "/api/",
  rateLimit({
    windowMs: 10_000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limit" },
  }),
)

app.post("/api/search", async (req, res) => {
  const { query, lang, mode, context } = req.body ?? {}

  if (typeof query !== "string" || !query.trim() || query.length > 500) {
    return res.status(400).json({ error: "invalid_request" })
  }
  if (mode && !["search", "make_longer", "follow_up"].includes(mode)) {
    return res.status(400).json({ error: "invalid_request" })
  }

  try {
    const data = await provider.search({
      query: query.trim(),
      lang: lang === "ru" ? "ru" : "en",
      mode: mode || "search",
      context: {
        query: String(context?.query ?? "").slice(0, 500),
        previousAnswer: String(context?.previousAnswer ?? "").slice(0, 4000),
      },
    })
    res.json(data)
  } catch (err) {
    console.error("[/api/search]", err.message)
    if (err.name === "TimeoutError") {
      return res.status(504).json({ error: "timeout" })
    }
    res.status(502).json({ error: "provider_error" })
  }
})

app.get("/api/health", (_req, res) => res.json({ ok: true }))

// В деве раздаём клиент этим же сервером; в проде клиент может жить на Pages
const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.use(express.static(path.join(__dirname, "../../client")))

app.listen(PORT, () => {
  console.log(`Gaigle server: http://localhost:${PORT}`)
})
