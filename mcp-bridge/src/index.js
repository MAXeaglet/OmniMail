#!/usr/bin/env node
// OmniMail MCP stdio bridge.
// Forwards MCP stdio sessions to a remote OmniMail /mcp HTTP endpoint.
import { spawn } from 'node:child_process'
import process from 'node:process'

const ENDPOINT = process.env.OMNIMAIL_MCP_URL || 'http://127.0.0.1:8787/mcp'
const API_KEY = process.env.OMNIMAIL_API_KEY || ''

if (!API_KEY) {
  console.error('OMNIMAIL_API_KEY is required')
  process.exit(1)
}

function json(data) {
  return JSON.stringify(data)
}

async function fetchMcp(payload) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OmniMail-Api-Key': API_KEY,
    },
    body: json(payload),
  })
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { jsonrpc: '2.0', id: payload.id ?? null, result: text }
  }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    let payload
    try {
      payload = JSON.parse(line)
    } catch {
      continue
    }
    void fetchMcp(payload)
      .then((response) => {
        process.stdout.write(json(response) + '\n')
      })
      .catch((error) => {
        process.stdout.write(json({
          jsonrpc: '2.0',
          id: payload.id ?? null,
          error: { code: -32603, message: error.message || 'bridge error' },
        }) + '\n')
      })
  }
})

const keepAlive = setInterval(() => {}, 24 * 60 * 60 * 1000)
process.on('SIGINT', () => {
  clearInterval(keepAlive)
  process.exit(0)
})
