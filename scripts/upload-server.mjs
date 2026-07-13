import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const port = Number(process.env.UPLOAD_SERVER_PORT || 8788)
const host = process.env.UPLOAD_SERVER_HOST || '::'
const publicBase = (process.env.UPLOAD_PUBLIC_BASE || '').replace(/\/+$/, '')
const tmpDir = path.resolve(process.cwd(), '.upload-tmp')

if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

const MIME_MAP = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  aac: 'audio/aac', m4a: 'audio/mp4', flac: 'audio/flac',
}

function appendCors(headers) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

function sendJson(res, status, payload) {
  send(res, status, appendCors({ 'Content-Type': 'application/json; charset=utf-8' }), JSON.stringify(payload))
}

function getBaseUrl(req) {
  return `http://${req.headers.host || `${host}:${port}`}`
}

function safeName(raw) {
  return path.basename(raw || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file.bin'
}

async function handleUpload(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const name = safeName(url.searchParams.get('name'))
  const filePath = path.join(tmpDir, name)

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath)
    req.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)
    req.on('error', reject)
  })

  const base = publicBase || getBaseUrl(req)
  sendJson(res, 200, { url: `${base}/files/${encodeURIComponent(name)}` })
}

function handleFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const name = safeName(decodeURIComponent(url.pathname.slice('/files/'.length)))
  const filePath = path.join(tmpDir, name)

  if (!fs.existsSync(filePath)) {
    send(res, 404, appendCors({ 'Content-Type': 'text/plain' }), 'not found')
    return
  }

  const ext = path.extname(name).slice(1).toLowerCase()
  const mimeType = MIME_MAP[ext] || 'application/octet-stream'
  const stat = fs.statSync(filePath)

  res.writeHead(200, appendCors({
    'Content-Type': mimeType,
    'Content-Length': String(stat.size),
    'Cache-Control': 'no-store',
  }))
  fs.createReadStream(filePath).pipe(res)
}

function handleIndex(req, res) {
  sendJson(res, 200, {
    name: 'gpt-image-playground upload server',
    uploadEndpoint: `${getBaseUrl(req)}/upload?name=example.mp4`,
    filesBase: `${getBaseUrl(req)}/files/`,
    tmpDir,
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    send(res, 204, appendCors({}), '')
    return
  }

  try {
    if (req.method === 'PUT' && url.pathname === '/upload') {
      await handleUpload(req, res)
      return
    }
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      handleFile(req, res)
      return
    }
    handleIndex(req, res)
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
})

server.listen(port, host, () => {
  console.log(`Upload server listening at http://${host}:${port}`)
  console.log(`PUT http://${host}:${port}/upload?name=foo.mp4  (application/octet-stream)`)
  console.log(`GET http://${host}:${port}/files/foo.mp4`)
  console.log(`Temp dir: ${tmpDir}`)
})