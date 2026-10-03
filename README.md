# minmini for Claude Code

Games to play while Claude works. One plugin, three parts:

- **The connector.** minmini's MCP server (`https://minmini.so/mcp`), so Claude can play Imposter with you against an AI crew, list the rooms that are open to join, and tell you what minmini makes. No account needed.
- **The `/minmini:play` skill.** Imposter in your terminal chat: you are one player and Claude plays the rest.
- **The `/minmini` waiting room.** A pane that shows what Claude is doing and the Imposter rooms open right now, with one key to open the game in your browser. Once you have opened it, a toast (and a desktop notification, if you switch it on) tells you when Claude finishes or needs you, so you can play without watching the terminal.

## Install

```
/plugin marketplace add minmini-labs/claude-plugin
/plugin install minmini@minmini
```

To try it from a checkout of this repository without installing: `claude --plugin-dir .`

The waiting room is a *mod* and needs Claude Code 2.1.287 or later. Check it yourself with `claude plugin validate .`, which lists every call it makes.

## What it runs, sends and fetches

Nothing here is hidden. This is the complete list, and the source is in this repository.

**The connector** (`.mcp.json`) connects Claude Code to `https://minmini.so/mcp`. The server receives only what Claude sends to its tools: a game's settings, clues, votes and guesses, and any words Claude searches the game list for. It does not receive your conversation, prompts, files or transcript, and it asks for no account. See the [privacy policy](https://minmini.so/privacy).

**The waiting room** (`hooks/register.js`) does the following, and nothing else:

- Fetches one public address, `https://minmini.so/v1/games/imposter/public`, the list of Imposter rooms that are open to everyone. It does this every ten seconds, and only while the pane has been opened. The request carries nothing from you.
- Runs `uname` once, to learn whether to open links with `open` (macOS), `xdg-open` (Linux) or `cmd /c start` (Windows).
- Opens a link in your browser only when you press a key for it, and only if it starts with `https://imposter.minmini.so`. It never opens any other address.
- Runs `osascript` (macOS) or `notify-send` (Linux) to show a desktop notification, only if you switch on "Tell me when Claude finishes". It is off until you do.
- Sends one fixed line, "Let’s play Imposter against an AI crew.", as your next message, only when you press the key for playing it here with Claude.
- Keeps one setting on your computer: whether that notification is on.
- Watches when a turn starts and finishes, and when Claude needs you, to draw the timer and show the toast. None of that leaves your computer.

**The `/minmini:play` skill** is plain instructions for Claude. It runs nothing.

There are no dependencies to install, no compiled or minified code, and no credentials.

## Develop

```
claude plugin test
```

## Licence

MIT. See [LICENSE](LICENSE). The games are at [minmini.so](https://minmini.so).
