import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { getRegistryItems, loadRegistry } from 'shadcn/registry'
import ts from 'typescript'

const registryRoot = path.dirname(fileURLToPath(import.meta.url))
const UPSTREAM_STYLE = 'base-nova'
// Committed verbatim, so each fetch is reproducible and upstream drift shows up as a reviewable diff.
const snapshotDirectory = path.join(registryRoot, 'upstream')

// Matches a cn(...) call whose first argument is a string literal — the shape bake rewrites.
const cnStringArgument = /cn\(\s*(['"])(?:\\.|(?!\1).)*\1/

// Sync membership lives in registry.json: items with meta.upstream are ported
// verbatim from that shadcn item — no overrides layer; cn-* classes ship as
// upstream's opt-in styling hooks, defined by consumers (and by site/src/styles/global.css).
async function syncedItems() {
  const registry = await loadRegistry({ cwd: path.join(registryRoot, 'astro') })
  return registry.items.filter((item) => item.meta?.upstream !== undefined)
}

async function fetchUpstreamSnapshots() {
  await mkdir(snapshotDirectory, { recursive: true })
  const items = await syncedItems()
  const upstreamItems = await getRegistryItems(
    items.map((item) => `@shadcn/${item.meta.upstream}`),
    { config: { style: UPSTREAM_STYLE } }
  )
  await Promise.all(upstreamItems.map((upstreamItem) => writeSnapshot(upstreamItem)))
  console.warn(
    'Snapshots written. Review the registry/upstream diff, then run: bun run registry:bake'
  )
}

async function writeSnapshot(upstreamItem) {
  if (upstreamItem.files.length !== 1) {
    throw new Error(
      `The ${upstreamItem.name} item has ${upstreamItem.files.length} files; the port expects one`
    )
  }
  await writeFile(snapshotPath(upstreamItem.name), upstreamItem.files[0].content)
}

function snapshotPath(name) {
  return path.join(snapshotDirectory, `${name}.tsx`)
}

async function bakeSnapshots() {
  const items = await syncedItems()
  await Promise.all(items.map((item) => bakeItem(item)))
}

// Files are matched to snapshot exports by name: CardHeader.astro carries the
// cn() literal of the CardHeader export; a file with a cva() call carries the cva arguments.
async function bakeItem(item) {
  const styleText = await extractStyleText(item.meta.upstream)
  const bakedParts = await Promise.all(
    item.files.map((file) => bakeFile(path.join(registryRoot, 'astro', file.path), item, styleText))
  )
  assertEverySlotBaked(styleText.slots, bakedParts, item.name)
}

async function bakeFile(filePath, item, styleText) {
  const fileName = path.basename(filePath)
  const source = await readFile(filePath, 'utf8')
  const partName = fileName.split('.', 1)[0]
  const slotLiteral = styleText.slots[partName]
  let rewritten = source
  if (source.includes('cva(')) {
    rewritten = rewriteCvaCall(rewritten, requireCvaArguments(styleText, item.name))
  }
  if (slotLiteral !== undefined) {
    rewritten = rewriteCnClasses(rewritten, slotLiteral, `${item.name}/${fileName}`)
  } else if (cnStringArgument.test(source)) {
    throw new Error(`${item.name}/${fileName} has cn() classes but no ${partName} snapshot export`)
  }
  if (rewritten !== source) {
    await writeFile(filePath, rewritten)
  }
  return slotLiteral === undefined ? null : partName
}

// A stale basename or a renamed upstream export must fail the bake, not skip it.
function assertEverySlotBaked(slots, bakedParts, itemName) {
  const baked = new Set(bakedParts)
  const missedSlots = Object.keys(slots).filter((slotName) => !baked.has(slotName))
  if (missedSlots.length > 0) {
    throw new Error(`Snapshot exports with no matching ${itemName} file: ${missedSlots.join(', ')}`)
  }
}

function requireCvaArguments(styleText, itemName) {
  if (styleText.cvaArguments === null) {
    throw new Error(`The ${itemName} snapshot has no cva() call`)
  }
  return styleText.cvaArguments
}

/**
 * Locates class data in a snapshot via the TypeScript AST and returns the
 * verbatim source spans — nothing executes, and upstream formatting is kept exactly.
 */
async function extractStyleText(name) {
  const source = await readFile(snapshotPath(name), 'utf8')
  const sourceFile = ts.createSourceFile(`${name}.tsx`, source, ts.ScriptTarget.Latest, true)
  return {
    cvaArguments: cvaArgumentsText(sourceFile, source, name),
    slots: slotLiteralTexts(sourceFile, source),
  }
}

// The span between the parentheses of the snapshot's single cva() call.
function cvaArgumentsText(sourceFile, source, name) {
  const calls = findCalls(sourceFile, 'cva')
  if (calls.length === 0) return null
  if (calls.length > 1) {
    throw new Error(`${name}.tsx has ${calls.length} cva() calls; the extractor expects one`)
  }
  const call = calls[0]
  return source.slice(call.expression.getEnd() + 1, call.getEnd() - 1)
}

// Per top-level function declaration, the exact text of the first cn() string literal.
function slotLiteralTexts(sourceFile, source) {
  const slots = {}
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name) return
    const firstArgument = findCalls(node, 'cn')[0]?.arguments[0]
    if (firstArgument && ts.isStringLiteralLike(firstArgument)) {
      slots[node.name.text] = source.slice(firstArgument.getStart(), firstArgument.getEnd())
    }
  })
  return slots
}

function findCalls(root, calleeName) {
  const calls = []
  const visit = (node) => {
    if (isCallTo(node, calleeName)) {
      calls.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return calls
}

function isCallTo(node, calleeName) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === calleeName
  )
}

/**
 * Transplants the snapshot's cva() argument span into the first cva(...) call,
 * leaving the surrounding hand-written frontmatter and markup untouched.
 */
function rewriteCvaCall(source, argumentsText) {
  const span = callArgumentsSpan(source, 'cva(')
  return source.slice(0, span.start) + argumentsText + source.slice(span.end)
}

/**
 * Transplants the snapshot's cn() string literal over the first string literal
 * of the cn(...) call, leaving the surrounding hand-written template untouched.
 */
function rewriteCnClasses(source, literalText, fileLabel) {
  if (!cnStringArgument.test(source)) {
    throw new Error(`No cn(…) string literal found in ${fileLabel}`)
  }
  return source.replace(cnStringArgument, () => `cn(${literalText}`)
}

/**
 * Returns the span between a call's parentheses, tracking string literals so
 * parentheses inside class strings (e.g. min(var(--x),10px)) do not end the call early.
 */
function callArgumentsSpan(source, callToken) {
  const callStart = source.indexOf(callToken)
  if (callStart === -1) throw new Error(`No ${callToken} call found`)

  const start = callStart + callToken.length
  let depth = 1
  let insideString = null
  for (let index = start; index < source.length; index++) {
    const character = source[index]
    if (insideString) {
      if (character === '\\') index++
      else if (character === insideString) insideString = null
      continue
    }
    if (['"', "'", '`'].includes(character)) insideString = character
    else if (character === '(') depth++
    else if (character === ')' && --depth === 0) {
      return { start, end: index }
    }
  }
  throw new Error(`Unterminated ${callToken} call`)
}

const commands = { fetch: fetchUpstreamSnapshots, bake: bakeSnapshots }
const run = commands[process.argv[2]]
if (run) {
  await run()
} else {
  console.error('Usage: node registry/sync-shadcn.mjs <fetch|bake>')
  process.exitCode = 1
}
