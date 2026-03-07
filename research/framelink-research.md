# Framelink (figma-developer-mcp) Research

Researched: 2026-03-06

## Identity
- **Repo**: [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP)
- **NPM**: `figma-developer-mcp` (the package `@anthropic-ai/framelink-figma-mcp` does NOT exist)
- **Website**: [framelink.ai](https://www.framelink.ai/)
- **Author**: Greg Lipsman — community project, NOT an Anthropic product
- **Version**: v0.6.6 (2026-03-04) | MIT license | 13.5k stars, 1.1k forks
- **Downloads**: 100k+/month at peak

## Tools (only 2)
1. **`get_figma_data`** — simplified YAML/JSON of layout, styling, component info (~25% smaller than official MCP output)
2. **`download_figma_images`** — downloads SVG/PNG assets locally with cropping support

## Authentication
- **PAT** via `--figma-api-key=YOUR-KEY` or `FIGMA_API_KEY` env var
- Also supports manual OAuth Bearer token (not prominently documented)
- No OAuth browser flow built in — fully headless-friendly

## Setup (headless)
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```
Transport: stdio (default with `--stdio`) or HTTP (set `PORT` env var).

## Figma Variables / Design Tokens — NOT SUPPORTED

**Framelink cannot extract Figma Variables.** This is a confirmed, open limitation:
- Returns resolved values (e.g., `borderRadius: 12px`) not token names (`--border-radius-token`)
- No call to Figma's `/v1/files/:key/variables` endpoint in the codebase
- Open issues: #14, #8, #220 — all unresolved
- Maintainer confirmed: Variables API requires Figma Enterprise plan
- v0.6.0 added named Figma Styles (not Variables) — different thing

**Workaround**: Export variables via Figma "Variable Visualizer" plugin as JSON, feed to LLM separately.

## Security: CVE-2025-53967

- **Severity**: CVSS 7.5 (High) — Remote Code Execution
- **Cause**: `child_process.exec` with unsanitized URL in `fetch-with-retry.ts`
- **Affected**: All versions < 0.6.3
- **Fixed**: v0.6.3 (2025-09-29) — input validation + localhost-only HTTP binding
- **Disclosure gap**: 84 days between notification and full fix (solo maintainer)
- **Current v0.6.6 is safe**

## Real-World Effectiveness (Community Feedback)

### Success Rate
- ~75% accuracy with well-structured Figma files + 5-10 min tweaks
- "85-90% wrong and mostly unusable" with poorly structured files
- Token costs: ~$0.10/card, ~$0.21/full page

### Success Factors
1. Descriptive layer names (not "Frame 47")
2. Consistent auto layout usage (maps to CSS Flexbox)
3. Well-structured components with clear variant states
4. Start with small components, not full pages
5. Provide comprehensive project rules (HTML semantics, Tailwind conventions, component library)

### Pain Points
- **Rate limiting**: Free accounts limited to 6 req/month since Nov 2025; paid plans 10 req/min
- Running Framelink + Official MCP simultaneously confuses AI agents
- Solo maintainer = slow security response, limited features

## Comparison: Framelink vs Official Figma MCP

| Aspect | Framelink (v0.6.6) | Official Figma MCP |
|---|---|---|
| Tools | 2 | 13 |
| Variables/Tokens | Not supported | `get_variable_defs` |
| Code Connect | No | Yes |
| Auth | PAT (headless) | OAuth (needs browser) |
| Output style | Descriptive YAML | Prescriptive React+Tailwind |
| Token efficiency | ~25% smaller | More verbose |
| Security | Solo maintainer, had RCE | Figma AppSec team |
| Nested components | Accurate | Flattened |
| Style names | Preserved (v0.6.0+) | Lost (arbitrary names) |
| Cost | Free, any plan | Free, any plan |

## Assessment for Agentic Bank

- **Framelink alone won't work** for Phase 1e — can't extract Variables (three-tier design tokens)
- **Good complement** for layout-to-code workflows alongside another token source
- **Official Figma MCP** is required for `get_variable_defs` but needs OAuth (headless problem)
- **Best headless option**: Call Figma REST API directly with PAT for `/v1/files/:key/variables/local`

## Sources
- [GitHub repo](https://github.com/GLips/Figma-Context-MCP)
- [NPM package](https://www.npmjs.com/package/figma-developer-mcp)
- [Framelink website](https://www.framelink.ai/)
- [CVE writeup (Imperva)](https://www.imperva.com/blog/another-critical-rce-discovered-in-a-popular-mcp-server/)
- [Figma Official MCP docs](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)
- [Figma Forum: MCP results quality](https://forum.figma.com/report-a-problem-6/figma-mcp-can-t-get-good-results-have-tried-many-things-41861)
- [LogRocket: Structuring Figma files for MCP](https://blog.logrocket.com/ux-design/design-to-code-with-figma-mcp/)
- [Dev.to: Layout from Figma with MCP](https://dev.to/byteminds/speeding-up-layout-from-figma-with-mcp-and-cursor-4211)
- [GitHub Issues #14, #8, #220](https://github.com/GLips/Figma-Context-MCP/issues/220)
- [Endor Labs CVE analysis](https://www.endorlabs.com/learn/cve-2025-53967-remote-code-execution-in-framelink-figma-mcp-server)
