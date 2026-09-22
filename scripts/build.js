import { build } from 'esbuild'
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const packageRoot = path.join(import.meta.dirname, '..')
const sourceDirectory = path.join(packageRoot, 'src')
const outDirectory = path.join(packageRoot, 'dist')

const esmEntryPoints = readdirSync(sourceDirectory, { recursive: true })
  .filter((filePath) => filePath.endsWith('.js') && filePath !== 'cdn.js')
  .map((filePath) => path.join(sourceDirectory, filePath))

rmSync(outDirectory, { recursive: true, force: true })

// Unminified ESM, module structure preserved — bundlers minify and tree-shake.
await build({
  entryPoints: esmEntryPoints,
  outdir: outDirectory,
  outbase: sourceDirectory,
  format: 'esm',
})

// Self-registering script-tag build for CDN users.
await build({
  entryPoints: [path.join(sourceDirectory, 'cdn.js')],
  outfile: path.join(outDirectory, 'cdn.min.js'),
  bundle: true,
  minify: true,
  format: 'iife',
})
