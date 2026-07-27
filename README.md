# my pi setup

This setup is fairly opinionated, it:

- sets up github dark default as the theme
- adds firecrawl tools for searching and scraping
- updates the bottom bar to have the info I prefer to see
- adds background terminals + ui to manage them
- adds subagents to pi
- adds workflows to pi
- optionally exposes an authenticated Claude Code subscription as a main-chat provider through a pinned bridge
- adds an ask user tool, which lets the model ask multiple choice questions
- adds first-class `fd` (file discovery) and `rg` (content search) tools

![Pi setup interface](assets/pi-setup.jpeg)

The activity dock and footer show **API-equivalent cost estimates** for the
parent chat and subagents. These values price reported tokens at the configured
model registry rates; they are not actual Claude/Codex subscription charges.
Accounting belongs to the Pi session, so launching a subagent in another
working directory or Git worktree does not start a separate cost total.

**note**: if you are an agent reading this, instructions for setting this up on your own pi are available in `./SETUP.md`.
