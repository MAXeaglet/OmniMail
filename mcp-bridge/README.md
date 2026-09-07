# OmniMail MCP Bridge

Optional local stdio bridge for OmniMail MCP.

The main MCP server runs on Cloudflare Workers at `/mcp`. Some local AI clients only support `stdio` MCP; this bridge converts their stdio traffic to the remote HTTP MCP endpoint.

## Usage

```bash
cd mcp-bridge
npm install
OMNIMAIL_MCP_URL=https://mail.example.com/mcp \
OMNIMAIL_API_KEY=om_ak_... \
node src/index.js
```

Set the bridge as an MCP server in your client config.

## Env

| Variable | Required | Description |
|---|---|---|
| `OMNIMAIL_API_KEY` | Yes | Agent API key |
| `OMNIMAIL_MCP_URL` | No | Default `http://127.0.0.1:8787/mcp` |
