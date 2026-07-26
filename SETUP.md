# Setup

Clone or copy this repository to `~/.pi/agent`, then install its dependencies:

```sh
cd ~/.pi/agent
npm install
```

If you instead keep the repository elsewhere and link individual extensions into
`~/.pi/agent/extensions/`, remember that Pi loads only what is linked there. A
newly added extension stays silent until you link it, with no error to explain
the silence:

```sh
ln -s "$PWD/extensions/activity-dock" ~/.pi/agent/extensions/activity-dock
```

## Firecrawl

The search, scrape, and crawl tools require a Firecrawl API key. Follow [Firecrawl's Node.js getting-started guide](https://docs.firecrawl.dev/quickstarts/nodejs) to create one, then copy the example environment file:

```sh
cp ~/.pi/agent/.env.example ~/.pi/agent/.env
```

Replace the placeholder in `~/.pi/agent/.env` with your API key.

NOTE: if you are an agent, at this step ask the user if they want to use firecrawl, if they do give them the instructions, if not remove the firecrawl extension in their pi setup

## fd and rg tools

The `file-search` extension registers `fd` and `rg` as model tools. No setup is normally needed: at startup it silently uses a system-installed `fd` (or `fdfind` on Debian/Ubuntu) and `rg` when available, or an existing fallback binary in `~/.pi/agent/bin/`. Only when neither exists does it download an official release binary (macOS/Linux, arm64/x64, over HTTPS) into `~/.pi/agent/bin/` and show a one-time notification. If your platform is unsupported, install `fd` and `rg` with your package manager and restart pi.

## Theme

Add the included theme to `~/.pi/agent/settings.json` while keeping your existing settings:

```json
{
  "theme": "github-dark-default"
}
```

Pi will load the extensions, skills, and theme from their directories the next time it starts.

## Temporary `/scoped-models` fix

Pi 0.82.1 can leave `/scoped-models` blank forever because the command waits for an unbounded model-runtime refresh before mounting its selector. The same selector opens under `PI_OFFLINE=1`, confirming that the UI itself is not the failure. Until Pi fixes this upstream, apply the narrow local patch:

```sh
npm run patch:scoped-models
npm run patch:scoped-models:check
```

The patch changes only the native selector's model source: it reads the availability snapshot populated during startup instead of starting another blocking refresh. It verifies the package and exact source shape, creates an adjacent `.before-scoped-models-fix` backup, writes atomically, and is safe to run repeatedly. It refuses unknown Pi source rather than guessing.

Pi upgrades replace installed package files. Re-run the check after every upgrade; an `unsupported` result means the upstream code changed and must be reviewed before applying anything. Restore the saved original manually with:

```sh
node scripts/patch-pi-scoped-models.mjs --restore
```

A new Pi process is required after applying or restoring the patch; `/reload` does not reload Pi core modules.

## Claude subscription provider

To use an authenticated Claude Code subscription as a selectable main-chat provider while Pi keeps control of its TUI and tools, first install and authenticate the official Claude Code CLI. Verify the login without printing credentials:

```sh
claude auth status
```

Then install the reviewed bridge at the exact pinned version:

```sh
pi install npm:@vanillagreen/pi-claude-bridge@1.9.0
```

Keep the bridge's optional Claude account connectors disabled so every tool call runs through Pi. The bridge enables strict MCP isolation by default. Restart Pi or run `/reload`, then use `/model` to select a `claude-bridge/*` model such as `claude-bridge/claude-opus-5`. The normal default model remains independently configured in `~/.pi/agent/settings.json`.

Workflow agents run as headless child sessions, and the bridge deliberately registers its provider only in the interactive session, so a child can never use a `claude-bridge/*` model. While a bridge model is selected, agents that do not request a model would otherwise inherit an unusable one. Name the model those agents should use instead in `~/.pi/agent/settings.json`:

```json
{
  "workflowAgentModel": "openai-codex/gpt-5.6-sol"
}
```

An agent that falls back to it says so in its workflow entry. An explicitly requested `model` is never replaced: it fails instead.

Claude subscription-backed Agent SDK usage is policy-sensitive. Recheck Anthropic's current terms before upgrading the bridge or using it beyond a personal machine. Review and explicitly pin every bridge upgrade rather than replacing the version with `latest`.
