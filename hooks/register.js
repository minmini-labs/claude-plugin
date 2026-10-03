/**
 * The minmini waiting room, for Claude Code. /minmini opens a pane that shows what Claude is doing and which Imposter rooms are open
 * to join, with one key to open the game in the browser. Once you have opened it, a toast (and, if you switch it on, a desktop
 * notification) tells you when Claude finishes or needs you, so you can play in the browser without watching the terminal.
 *
 * It reads one public address (the list of open rooms) and starts nothing but your browser and, if you ask for it, a desktop
 * notification. It never sends your prompts, files or transcript anywhere.
 */
const SITE = 'https://minmini.so'
const GAME = 'https://imposter.minmini.so'
const PANE = 'minmini'
const OPENING = 'Let’s play Imposter against an AI crew.'

// What the pane shows. All of it is replaced from time to time, none of it is saved except the notification choice.
let working = null      // when Claude's current turn began, in milliseconds
let shown = false       // the pane has been opened this session, so alerts are welcome
let rooms = null        // null until the first answer, then a list
let failed = false
let notify = false      // also tell the desktop when Claude finishes
let opener = null       // the command that opens a link on this computer

/** Text from the network, made safe to draw: no control characters, no more than 24 characters. */
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 24)
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

async function opening($) {
  if (opener) return opener
  let kind = ''
  try { const u = await $.process.run(['uname']); kind = u.exitCode === 0 ? u.stdout.trim() : '' } catch { kind = '' }
  opener = kind === 'Darwin' ? ['open'] : kind === 'Linux' ? ['xdg-open'] : ['cmd', '/c', 'start', '']
  return opener
}

/** Open one of minmini's own addresses in the browser. Nothing else is ever opened. */
async function open($, url) {
  if (!url.startsWith(GAME)) return
  try { await $.process.run([...(await opening($)), url]) } catch { $.ui.toast('Could not open the browser') }
}

async function refresh($) {
  try {
    const r = await $.http.fetch(`${SITE}/v1/games/imposter/public`)
    const data = r.ok ? JSON.parse(r.text) : null
    rooms = Array.isArray(data?.rooms) ? data.rooms.slice(0, 4) : []
    failed = !r.ok
  } catch { failed = true; if (rooms === null) rooms = [] }
  $.ui.invalidate('ui.render')
}

async function alert($, text) {
  if (!shown) return
  $.ui.toast(text)
  if (!notify) return
  try {
    const kind = (await opening($))[0]
    if (kind === 'open') await $.process.run(['osascript', '-e', `display notification "${text}" with title "minmini"`])
    else if (kind === 'xdg-open') await $.process.run(['notify-send', 'minmini', text])
  } catch { /* a notification is a courtesy: nothing to do if it fails */ }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    notify = (await $.store.get('notify')) === true
    // Look at the rooms every ten seconds, and redraw the clock every second, but only once the pane has been opened.
    $.clock.every(10_000, () => { if (shown) refresh($) })
    $.clock.every(1000, () => { if (shown && working !== null) $.ui.invalidate('ui.render') })
    // Last in the hook, because registering a name that is taken throws.
    await $.command.register({ name: 'minmini', description: 'Play Imposter while Claude works', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'minmini' }, async ($) => {
    shown = true
    await $.ui.open({ id: PANE, title: 'minmini', focus: true, closeOnEscape: true })
    refresh($)
    return {}
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) { working = await $.clock.now(); if (shown) $.ui.invalidate('ui.render') }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      working = null
      if (shown) $.ui.invalidate('ui.render')
      if (!e.isAborted) await alert($, 'Claude finished. Back to work when you are ready.')
    }
    return next(e)
  })

  // Claude needs a decision, or has been waiting for you.
  on('classic.Notification', async ($, e, next) => {
    await alert($, e.notification_type === 'idle_prompt' ? 'Claude is waiting for you.' : 'Claude needs you.')
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const gap = Text({ children: [' '] })
    const room = (r, i) => {
      const code = String(r.code ?? '').replace(/\D/g, '').slice(0, 6)
      const need = Number(r.need) || 0
      return Box({
        key: `room-${i}`, flexDirection: 'row', columnGap: 2,
        children: [
          Button({ key: `join-${i}`, label: 'Join', hotkey: String(i + 1), plain: true, onPress: () => open($, `${GAME}/online?code=${code}`) }),
          Text({ children: [`${clean(r.host?.name)}’s room · ${Number(r.count) || 0} of 12 · ${need ? `needs ${need} more` : 'ready to start'}`] }),
        ],
      })
    }
    return Box({
      flexDirection: 'column',
      children: [
        Text({ bold: true, children: ['minmini'] }),
        Text({ dimColor: true, children: [working === null ? 'Claude is idle.' : `Claude is working · ${mmss(now - working)}`] }),
        gap,
        Box({
          flexDirection: 'row', columnGap: 3,
          children: [
            Button({ key: 'play', label: 'Play Imposter in your browser', hotkey: 'p', plain: true, onPress: () => open($, GAME) }),
            Button({ key: 'chat', label: 'Play it here with Claude', hotkey: 'c', plain: true, onPress: () => { $.prompt.submit({ text: OPENING, asUser: true }).catch(() => {}) } }),
          ],
        }),
        gap,
        Text({ dimColor: true, children: [rooms === null ? 'Looking for open rooms…' : failed && !rooms.length ? 'Could not reach minmini.' : rooms.length ? 'Open to everyone right now' : 'No rooms are open right now. Start one in the game.'] }),
        ...(rooms ?? []).map(room),
        gap,
        Button({
          key: 'notify', label: `Tell me when Claude finishes: ${notify ? 'on' : 'off'}`, hotkey: 'n', plain: true,
          onPress: async () => { notify = !notify; await $.store.set('notify', notify); $.ui.invalidate('ui.render') },
        }),
        Text({ dimColor: true, children: ['Esc closes this. Your game stays in the browser.'] }),
      ],
    })
  })
}
