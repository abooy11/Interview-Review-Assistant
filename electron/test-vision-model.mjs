// Direct API test of deepseek-v4-flash-vision-exp via DeepSeek's Anthropic-compatible endpoint.
// Reads the API key from ~/.claude/settings.json (never printed).
import fs from "fs"
import os from "os"
import path from "path"

const settings = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), ".claude", "settings.json"), "utf8")
)
const KEY = settings.env.ANTHROPIC_AUTH_TOKEN
const BASE = settings.env.ANTHROPIC_BASE_URL
const MODEL = "deepseek-v4-flash-vision-exp"

async function chat(content, maxTokens = 300) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    }),
  })
  const body = await res.json()
  const text = (body.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
  return { status: res.status, model: body.model, text: text || JSON.stringify(body).slice(0, 300) }
}

// Test 1: plain text — is the model ID valid?
const t1 = await chat("Reply with exactly: MODEL_OK")
console.log("=== TEST 1: text ===")
console.log("HTTP", t1.status, "| model:", t1.model ?? "(none)")
console.log("reply:", t1.text)

// Test 2: vision — send the app icon (512x512) as base64
const img = fs
  .readFileSync(new URL("./build/icon.png", import.meta.url))
  .toString("base64")
const t2 = await chat([
  {
    type: "text",
    text: "Describe this image in one short sentence: what is it, what colors dominate?",
  },
  { type: "image", source: { type: "base64", media_type: "image/png", data: img } },
])
console.log("=== TEST 2: vision (512x512 app icon) ===")
console.log("HTTP", t2.status)
console.log("reply:", t2.text)
