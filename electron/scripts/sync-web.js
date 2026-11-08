// Copies the static export from the project root (out/) into electron/app/
// so `electron-builder` packages the latest build of the website.
const fs = require("fs")
const path = require("path")

const src = path.join(__dirname, "..", "..", "out")
const dest = path.join(__dirname, "..", "app")

if (!fs.existsSync(src)) {
  console.error("out/ not found — run `pnpm build` in the project root first.")
  process.exit(1)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log("Copied out/ -> electron/app/")
