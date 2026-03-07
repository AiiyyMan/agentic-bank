# Figma Variables REST API & Headless Access Research

Researched: 2026-03-06

## TLDR

The Figma Variables REST API requires Enterprise plan. The Official Figma MCP requires OAuth (browser). Neither works on our headless server. The viable path is manual plugin export.

## Variables REST API — Enterprise Only

### Endpoints
| Endpoint | Method | Scope Required |
|---|---|---|
| `/v1/files/:key/variables/local` | GET | `file_variables:read` |
| `/v1/files/:key/variables/published` | GET | `file_variables:read` |
| `/v1/files/:key/variables` | POST | `file_variables:write` |

### Plan Gate
- `file_variables:read` and `file_variables:write` scopes are **only available on Enterprise plans**
- Non-Enterprise PATs cannot be granted these scopes
- 100+ votes on Figma forum requesting this be opened up — no timeline from Figma
- Source: https://forum.figma.com/suggest-a-feature-11/why-s-the-variables-api-only-available-on-enterprise-plans-36426

### Response Structure (GET local variables)
```json
{
  "meta": {
    "variables": {
      "<variableId>": {
        "name": "colors/primary/500",
        "resolvedType": "COLOR",
        "valuesByMode": { "<modeId>": { "r": 0.2, "g": 0.4, "b": 0.9, "a": 1 } },
        "codeSyntax": {}
      }
    },
    "variableCollections": {
      "<collectionId>": {
        "name": "Primitives",
        "modes": [{ "modeId": "...", "name": "Default" }],
        "variableIds": ["..."]
      }
    }
  }
}
```

### Rate Limits (Tier 2 for GET)
| Plan | Limit |
|---|---|
| Starter | 25/min |
| Professional | 50/min |
| Organization | 100/min |

## Official Figma MCP OAuth — Headless Blocked

### Auth Flow
- OAuth 2.0 with PKCE (S256) via `https://www.figma.com/oauth/mcp`
- Redirects to `http://localhost:<port>/callback` — needs browser
- Scope: `mcp:connect`
- **No PAT support** — Figma explicitly confirmed on forum

### Token Storage (Claude Code)
- Linux: `~/.claude/.credentials.json` (plaintext)
- macOS: system Keychain
- Structure: `mcpOAuth.figma-remote-mcp|<hash>.accessToken`

### Token Transfer Viability
- Technically possible: auth on browser machine, copy `.credentials.json`
- **Impractical**: Claude Code has refresh token bug (#21333) — tokens expire ~1hr, never refresh
- Would need re-transfer every hour

### Community Confirmation
- No confirmed success stories of headless Official MCP usage
- Multiple forum threads requesting PAT support — no resolution
- Bitovi built a proxy but doesn't solve OAuth

## Viable Alternatives for Token Extraction

### 1. Tokens Studio Plugin (RECOMMENDED)
- https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma
- Most mature option, free tier available
- Exports to JSON, can sync with GitHub/GitLab
- Supports Variables, outputs W3C Design Tokens format
- Requires one-time manual step in Figma

### 2. Figma Token Exporter
- https://figma-tokens.com/
- Free plugin, exports CSS/SASS/JSON
- No Enterprise required

### 3. Design Tokens Plugin (lukasoppermann)
- https://github.com/lukasoppermann/design-tokens
- Exports to Style Dictionary-compatible JSON
- Supports Variables in W3C format

### 4. Figma's Official GitHub Actions Example
- https://github.com/figma/variables-github-action-example
- Bi-directional sync, W3C format
- Still requires Enterprise plan

## Sources
- [Figma Variables REST API](https://developers.figma.com/docs/rest-api/variables/)
- [Figma REST API Auth](https://developers.figma.com/docs/rest-api/authentication/)
- [Forum: Enterprise-only Variables API](https://forum.figma.com/suggest-a-feature-11/why-s-the-variables-api-only-available-on-enterprise-plans-36426)
- [Forum: PAT support request](https://forum.figma.com/ask-the-community-7/support-for-pat-personal-access-token-based-auth-in-figma-remote-mcp-47465)
- [Forum: OAuth-less MCP access](https://forum.figma.com/ask-the-community-7/oauth-less-access-to-figma-mcp-tools-47774)
- [Claude Code Issue #21333: OAuth refresh bug](https://github.com/anthropics/claude-code/issues/21333)
- [Figma Remote MCP Installation](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Figma MCP Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
