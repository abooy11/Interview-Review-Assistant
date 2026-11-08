const { app, BrowserWindow, shell } = require("electron")
const http = require("http")
const fs = require("fs")
const path = require("path")

// Static files exported by `next build` (copied into app/ at package time)
const APP_ROOT = path.join(__dirname, "app")

// Debug mode: set INTERVIEW_REVIEW_APP_URL to load a running Next.js dev server instead of
// the static export, so edits hot-reload inside the app window.
// e.g. $env:INTERVIEW_REVIEW_APP_URL = "http://localhost:3000"
const DEV_URL = process.env.INTERVIEW_REVIEW_APP_URL || ""

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
}

function sendFile(res, filePath) {
  return new Promise((resolve) => {
    fs.readFile(filePath, (err, data) => {
      if (err) return resolve(false)
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" })
      res.end(data)
      resolve(true)
    })
  })
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname)
      if (pathname.endsWith("/")) pathname += "index.html"
      const filePath = path.join(APP_ROOT, pathname)
      // prevent path traversal
      if (filePath !== APP_ROOT && !filePath.startsWith(APP_ROOT + path.sep)) {
        res.writeHead(403)
        return res.end()
      }
      if (await sendFile(res, filePath)) return
      if (await sendFile(res, filePath + ".html")) return
      const notFound = await sendFile(res, path.join(APP_ROOT, "404.html"))
      if (!notFound) res.end("Not Found")
    } catch {
      res.writeHead(500)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port))
  })
}

let mainWindow = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    const appUrl = DEV_URL || `http://127.0.0.1:${await startServer()}`
    const allowedOrigin = new URL(appUrl).origin

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: "#f5f5f3",
      autoHideMenuBar: true,
      title: "面试复盘助手",
      icon: path.join(__dirname, "build", "icon.png"),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    mainWindow.setMenuBarVisibility(false)

    // Open external links (if any) in the system browser instead of the app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) shell.openExternal(url)
      return { action: "deny" }
    })
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(allowedOrigin)) {
        event.preventDefault()
        if (/^https?:/.test(url)) shell.openExternal(url)
      }
    })

    mainWindow.on("closed", () => {
      mainWindow = null
    })

    await mainWindow.loadURL(appUrl)
  })

  app.on("window-all-closed", () => {
    app.quit()
  })
}
