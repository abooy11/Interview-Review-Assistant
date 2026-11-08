/** Prefix a public-folder path when the site is hosted under a subpath. */
export function publicPath(path: string) {
  if (!path.startsWith("/")) return path
  const base = process.env.NEXT_PUBLIC_BASE_PATH || ""
  return `${base}${path}`
}
