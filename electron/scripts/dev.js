// Unified dev launcher: starts the Next.js dev server (Turbopack, Fast Refresh)
// and opens the Electron window pointed at it, so every source edit lands in the
// running app without rebuilding or repackaging.
//
//   npm run dev:app            # from the project root
//
// Env:
//   INTERVIEW_REVIEW_DEV_URL        dev server URL to use        (default http://localhost:3000)
//   INTERVIEW_REVIEW_DEV_TIMEOUT_MS how long to wait for ready   (default 120000)
const { spawn, spawnSync } = require("child_process")
const http = require("http")
const path = require("path")

const ROOT = path.join(__dirname, "..", "..")
const ELECTRON_DIR = path.join(__dirname, "..")
const WEB_URL = process.env.INTERVIEW_REVIEW_DEV_URL || "http://localhost:3000"
const READY_TIMEOUT_MS = Number(process.env.INTERVIEW_REVIEW_DEV_TIMEOUT_MS || 120000)
const PORT = Number(new URL(WEB_URL).port || 80)
// Spawn the Next CLI directly instead of `npm run dev`: the npm wrapper adds a
// process layer that `taskkill /T` does not reliably tear down on Windows, which
// leaves an orphan `next dev` holding the port while no longer answering.
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next")

let shuttingDown = false
let ownedPid = null // port owner of the dev server WE started (null when reusing)

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(true)
    })
    req.on("error", () => resolve(false))
    req.setTimeout(2500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await ping(WEB_URL)) return true
    await sleep(400)
  }
  return false
}

// Which process is actually listening on the port? Needed both to spot a zombie
// server (port bound but not answering) and to kill the real server on exit.
function pidOnPort(port) {
  try {
    if (process.platform === "win32") {
      const out = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout || ""
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i)
        if (m && Number(m[1]) === port) return Number(m[2])
      }
      return null
    }
    const out = spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout || ""
    const pid = out.trim().split(/\s+/)[0]
    return pid ? Number(pid) : null
  } catch {
    return null
  }
}

function killPid(pid) {
  if (!pid) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    try {
      process.kill(pid, "SIGTERM")
    } catch {}
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    try {
      process.kill(-child.pid, "SIGTERM")
    } catch {
      child.kill("SIGTERM")
    }
  }
}

function electronBinary() {
  const name = process.platform === "win32" ? "electron.exe" : "electron"
  return path.join(ELECTRON_DIR, "node_modules", "electron", "dist", name)
}

function shutdown(webProc, appProc) {
  if (shuttingDown) return
  shuttingDown = true
  console.log("[dev] 正在停止…")
  killTree(appProc)
  killPid(ownedPid) // the real listener, in case the wrapper outlived its child
  killTree(webProc)
}

async function main() {
  let webProc = null

  const alive = await ping(WEB_URL)
  const existing = pidOnPort(PORT)

  if (existing && alive) {
    console.log(`[dev] 复用已在运行的 dev server：${WEB_URL} (pid ${existing})，退出时不会关闭它`)
  } else {
    if (existing && !alive) {
      console.log(`[dev] 端口 ${PORT} 被无响应的僵死进程占用（pid ${existing}），清理后重新启动`)
      killPid(existing)
      for (let i = 0; i < 24 && pidOnPort(PORT); i++) await sleep(250)
    }
    console.log("[dev] 启动 Next.js dev server（Turbopack 热重载）…")
    webProc = spawn(process.execPath, [NEXT_BIN, "dev", "-p", String(PORT)], {
      cwd: ROOT,
      stdio: "inherit",
    })
    webProc.on("exit", (code) => {
      if (shuttingDown) return
      console.error(`[dev] dev server 意外退出（code ${code}）`)
      process.exit(code ?? 1)
    })
    if (!(await waitForServer())) {
      console.error(`[dev] dev server 在 ${READY_TIMEOUT_MS}ms 内未响应：${WEB_URL}`)
      shutdown(webProc, null)
      process.exit(1)
    }
    ownedPid = pidOnPort(PORT)
    console.log(`[dev] dev server 就绪：${WEB_URL}${ownedPid ? ` (pid ${ownedPid})` : ""}`)
  }

  console.log(`[dev] 打开 Electron 窗口 → ${WEB_URL}`)
  const appProc = spawn(electronBinary(), ["."], {
    cwd: ELECTRON_DIR,
    stdio: "inherit",
    env: { ...process.env, INTERVIEW_REVIEW_APP_URL: WEB_URL },
  })

  appProc.on("exit", (code) => {
    console.log(`[dev] app 已关闭（code ${code ?? 0}），一并停止 dev server`)
    shutdown(webProc, null)
    process.exit(code ?? 0)
  })

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      shutdown(webProc, appProc)
      process.exit(0)
    })
  }
}

main()
