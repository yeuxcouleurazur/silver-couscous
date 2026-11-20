# FCC Bridge

Node.js + TypeScript + Express backend connecting the web frontend to the
locally installed Free Claude Code (FCC) runtime at `127.0.0.1:8082`.

Everything is real — every model, skill, MCP server, agent, and streamed token
comes from FCC. Nothing is mocked. Adding resources to FCC requires no code
change; discovery re-reads FCC live on every request.

## Requirements

- Node.js 20 or 22
- FCC running locally at `http://127.0.0.1:8082`

## Launch

```bash
# Install dependencies
npm install

# Copy configuration
cp .env.example .env
# Edit .env if needed (defaults work for a local FCC on port 8082)

# Development (auto-reloads on file change)
npm run dev

# Production build
npm run build
npm start
```

The bridge listens on `http://127.0.0.1:8787` by default (localhost-only).

## Configuration (`.env`)

| Key | Default | Description |
|---|---|---|
| `PORT` | `8787` | Bridge HTTP port |
| `BIND_HOST` | `127.0.0.1` | Bind address. `0.0.0.0` exposes on all interfaces |
| `ENABLE_NETWORK` | `false` | Must be `true` to expose the bridge on the network |
| `FCC_BASE_URL` | `http://127.0.0.1:8082` | FCC runtime URL |
| `FCC_PROXY_AUTH_ENABLED` | `false` | Forward proxy auth to FCC |
| `FCC_PROXY_AUTH_TOKEN` | `freecc` | Token forwarded to FCC |
| `DEFAULT_PERMISSION_MODE` | `manual` | `plan` \| `manual` \| `auto-edit` |
| `WORKSPACE_PATH` | (empty) | Workspace root for auto-edit mode |
| `CORS_ENABLED` | `false` | Enable CORS (only with `ENABLE_NETWORK=true`) |
| `CORS_ALLOWED_ORIGINS` | (empty) | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | Log level |

**Security:** `BIND_HOST` defaults to `127.0.0.1` and `ENABLE_NETWORK` defaults to
`false`. Never set `ENABLE_NETWORK=true` unless you explicitly want network
exposure. Secrets belong in `.env` only — never hardcoded, never returned in
responses.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/health` | Bridge health + config summary |
| `GET` | `/v1/models` | Models discovered live from FCC |
| `GET` | `/v1/tools` | Available tools by permission mode |
| `GET` | `/v1/skills` | Skills discovered from `SKILL.md` frontmatter |
| `GET` | `/v1/mcp` | MCP servers from discover-verdicts |
| `GET` | `/v1/agents` | Agents (skills + MCP + builtins) |
| `POST` | `/v1/claude/stream` | SSE stream to FCC (see curl below) |
| `POST` | `/v1/abort/:conversationId` | Cancel an in-flight stream |

SSE headers on `/v1/claude/stream`:

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

## Curl smoke test

`OPENROUTER_API_KEY` must be configured in FCC for generation to work. Without
it, FCC returns an error which the bridge forwards verbatim (this is expected).

```bash
# 1. Health
curl http://127.0.0.1:8787/v1/health

# 2. Models (live from FCC)
curl http://127.0.0.1:8787/v1/models

# 3. Stream (SSE). Replace MODEL_ID with a real FCC model id.
curl -N http://127.0.0.1:8787/v1/claude/stream \
  -X POST -H "Content-Type: application/json" -H "Accept: text/event-stream" \
  -d '{
    "conversationId": "curl-test-1",
    "prompt": "Dis simplement Bonjour le monde",
    "modelId": "claude-haiku-5-5",
    "tools": {"webSearch":false,"extendedThinking":false,"artifacts":false,"responseStyle":"concis"},
    "attachments": [],
    "permissionMode": "plan"
  }'

# 4. Abort
curl -X POST http://127.0.0.1:8787/v1/abort/curl-test-1
```

Expected stream events (when FCC has an API key configured):

```
: fcc-bridge stream connected
data: {"type":"thinking_delta","delta":"..."}
data: {"type":"thinking_done","durationSec":1}
data: {"type":"text_delta","delta":"Bonjour le monde"}
data: [DONE]
```

If FCC lacks `OPENROUTER_API_KEY`, the stream returns:

```
data: {"type":"error","message":"OPENROUTER_API_KEY is not set. ..."}
data: [DONE]
```

## Tests

```bash
npm test
```

48 unit tests covering permissions, model routing, SSE framing, config loading,
and live FCC discovery.

## Build

```bash
npm run build      # tsc -> dist/
npm start          # node dist/server.js
```

## Permission modes

- **plan** — read-only. No file writes, no terminal commands, no MCP/skill
  actions. Only reading and planning are allowed.
- **manual** — reads allowed; sensitive actions (write/edit/run/mcp/skill)
  require explicit approval before forwarding to FCC.
- **auto-edit** — automatic edits inside the workspace are allowed;
  out-of-workspace and dangerous commands are blocked; all operations logged.
