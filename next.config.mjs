/** @type {import('next').NextConfig} */
const basePath = process.env.BASE_PATH || ""

const nextConfig = {
  output: "export",
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

// Project Pages live under /Interview-Review-Assistant/. Leave this empty for
// local dev and the Electron build, which are both served from the site root.
if (basePath) {
  nextConfig.basePath = basePath
  nextConfig.env = { NEXT_PUBLIC_BASE_PATH: basePath }
}

export default nextConfig
