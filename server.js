import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

try {
  const envText = await readFile(join(root, '.env'), 'utf8');
  envText.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  });
} catch {}

const port = Number(process.env.PORT || 8000);
const defaultBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const defaultApiKey = process.env.OPENAI_API_KEY || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleChat(req, res) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4000) return sendJson(res, 413, { error: 'Message is too long' });
  }
  let input;
  try { input = JSON.parse(raw); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 42) : '';
  if (!message) return sendJson(res, 400, { error: 'Message is required' });
  const apiKey = typeof input.apiKey === 'string' && input.apiKey.trim() ? input.apiKey.trim() : defaultApiKey;
  const baseUrl = (typeof input.baseUrl === 'string' && input.baseUrl.trim() ? input.baseUrl.trim() : defaultBaseUrl).replace(/\/$/, '');
  const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : defaultModel;
  if (!apiKey) return sendJson(res, 503, { error: 'API key is not configured' });

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: 'system', content: '你是一个安静、温柔的树形陪伴者。只用简体中文回应一句到两句。接住用户的感受，不诊断、不说教、不强行积极、不连续追问，不提供医疗或危机判断。不要声称自己真正理解用户的人生。' },
          { role: 'user', content: message },
        ],
      }),
    });
    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!upstream.ok || !reply) return sendJson(res, 502, { error: 'Model service returned no reply' });
    return sendJson(res, 200, { reply });
  } catch {
    return sendJson(res, 502, { error: 'Unable to reach model service' });
  }
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return sendJson(res, 404, { error: 'Not found' });
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return sendJson(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET') return serveStatic(req, res);
  sendJson(res, 405, { error: 'Method not allowed' });
}).listen(port, '127.0.0.1', () => {
  console.log(`Healing Tree server listening on http://127.0.0.1:${port}`);
  console.log(`Model: ${defaultModel}`);
});
