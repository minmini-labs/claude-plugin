import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'minmini', component: 'Pane', requestId: 'minmini', viewport: { columns: 100, rows: 30 },
  props: { title: 'minmini', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const room = (over: object = {}) => ({ code: '123456', host: { name: 'Ada' }, count: 2, need: 1, ...over })
const reply = (rooms: unknown) => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ rooms }) } })

/** Everything the mod asks Claude Code for, answered; returns what the mod did. */
function world(on: any, opts: { rooms?: unknown; saved?: unknown; os?: string; netFails?: boolean } = {}) {
  const clock = mock.clock(on)
  const log = { toasts: [] as string[], runs: [] as string[][], opened: [] as any[], stored: new Map<string, unknown>(), prompts: [] as string[] }
  if (opts.saved !== undefined) log.stored.set('notify', opts.saved)
  on('store.get', ($: any, e: any) => ({ value: log.stored.get(e.key) }))
  on('store.set', ($: any, e: any) => { log.stored.set(e.key, e.value); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.open', ($: any, e: any) => { log.opened.push(e); return { value: { isPlaced: true } } })
  on('ui.toast', ($: any, e: any) => { log.toasts.push(e.text); return { value: undefined } })
  on('http.fetch', () => (opts.netFails ? { deny: 'offline' } : reply(opts.rooms ?? [room()])))
  on('process.run', ($: any, e: any) => { log.runs.push(e.argv); return { value: { exitCode: 0, stdout: e.argv[0] === 'uname' ? (opts.os ?? 'Darwin') : '', stderr: '' } } })
  on('prompt.submit', ($: any, e: any) => { log.prompts.push(e.text); return { text: e.text } })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('classic.Notification', () => ({}))
  return { clock, log }
}
const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const text = async (ui: any, t: string | RegExp) => (await ui.find({ type: 'Text', text: t })) !== undefined
const turn = (id: string, extra: object = {}) => ({ turnId: id, answer: 'done', durationMs: 5000, isAborted: false, usage: null, ...extra })

test('/minmini opens the pane, which says what Claude is doing and lists the open rooms', async ($, on) => {
  const { clock, log } = world(on)
  await start($)
  await $.command.run({ command: 'minmini', args: '' })
  await clock.settle()
  expect(log.opened[0]).toMatchObject({ id: 'minmini', title: 'minmini', focus: true, closeOnEscape: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await text(ui, 'Claude is idle.')).toBe(true)
  expect(await text(ui, 'Open to everyone right now')).toBe(true)
  expect(await text(ui, 'Ada’s room · 2 of 12 · needs 1 more')).toBe(true)
  expect((await ui.find({ key: 'play' })).props.label).toBe('Play Imposter in your browser')
  expect((await ui.find({ key: 'chat' })).props.label).toBe('Play it here with Claude')
})

test('pressing Join opens that room in the browser, and Play opens the game, on this computer\'s own opener', async ($, on) => {
  const { clock, log } = world(on, { os: 'Darwin' })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'join-0' })
  expect(log.runs).toContainEqual(['open', 'https://imposter.minmini.so/online?code=123456'])
  await ui.press({ key: 'play' })
  expect(log.runs).toContainEqual(['open', 'https://imposter.minmini.so'])
})

test('it opens links with xdg-open on Linux, and asks Claude to play when you press c', async ($, on) => {
  const { clock, log } = world(on, { os: 'Linux' })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'play' })
  expect(log.runs).toContainEqual(['xdg-open', 'https://imposter.minmini.so'])
  await ui.press({ key: 'chat' })
  expect(log.prompts).toEqual(['Let’s play Imposter against an AI crew.'])
})

test('a room list from the network cannot make the mod open anything but minmini\'s own game, or draw anything strange', async ($, on) => {
  const hostile = [room({ code: '12x34<script>9', host: { name: 'Eve\u0007\u001b[31m' + 'x'.repeat(100) } }), room({ code: 'abc' })]
  const { clock, log } = world(on, { rooms: hostile })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'join-0' }); await ui.press({ key: 'join-1' })
  const opened = log.runs.filter((r) => r[0] === 'open').map((r) => r[1])
  expect(opened).toEqual(['https://imposter.minmini.so/online?code=12349', 'https://imposter.minmini.so/online?code='])   // digits only, and always the game's own address
  const drawn = JSON.stringify(await ui.find({ type: 'Box', key: 'room-0' }) ?? {})
  expect(drawn).not.toMatch(/\\u0007|\\u001b/); expect(drawn.includes('x'.repeat(30))).toBe(false)   // control characters gone, long names cut
})

test('an unreachable minmini is said plainly and the pane still works', async ($, on) => {
  const { clock } = world(on, { netFails: true })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await text(ui, 'Could not reach minmini.')).toBe(true)
  expect(await ui.find({ key: 'play' })).toBeDefined()
})

test('the pane shows how long Claude has been working, counting up', async ($, on) => {
  const { clock } = world(on)
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  await $.turn.start({ turnId: 't1' })
  await clock.advance(65_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await text(ui, 'Claude is working · 1:05')).toBe(true)
  await ui.unmount()
  await $.turn.complete(turn('t1'))
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await text(after, 'Claude is idle.')).toBe(true)
})

test('it only speaks up once you have opened the pane, and never for an interrupted turn or a subagent', async ($, on) => {
  const { clock, log } = world(on)
  await start($)
  await $.turn.complete(turn('quiet'))            // the pane was never opened: no toast
  await $.classic.Notification({ message: 'needs permission', notification_type: 'permission_prompt' })
  expect(log.toasts).toEqual([])
  await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  await $.turn.complete(turn('t2', { isAborted: true }))
  await $.turn.complete(turn('t3', { agentId: 'sub-1' }))
  expect(log.toasts).toEqual([])
  await $.turn.complete(turn('t4'))
  expect(log.toasts).toEqual(['Claude finished. Back to work when you are ready.'])
  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
  await $.classic.Notification({ message: 'Claude is waiting for your input', notification_type: 'idle_prompt' })
  expect(log.toasts.slice(1)).toEqual(['Claude needs you.', 'Claude is waiting for you.'])
})

test('the desktop notification is off until you switch it on, remembered, and then rings when Claude finishes', async ($, on) => {
  const { clock, log } = world(on, { os: 'Darwin' })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  await $.turn.complete(turn('a'))
  expect(log.runs.some((r) => r[0] === 'osascript')).toBe(false)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'notify' })).props.label).toBe('Tell me when Claude finishes: off')
  await ui.press({ key: 'notify' })
  expect(log.stored.get('notify')).toBe(true)
  await ui.unmount()
  expect((await (await $.ui.mount({ ...PANE, surface: 'terminal' })).find({ key: 'notify' })).props.label).toBe('Tell me when Claude finishes: on')
  await $.turn.complete(turn('b'))
  const note = log.runs.find((r) => r[0] === 'osascript')!
  expect(note[2]).toContain('display notification "Claude finished. Back to work when you are ready." with title "minmini"')
})

test('a saved choice to be notified is there the next session', async ($, on) => {
  const { clock, log } = world(on, { saved: true, os: 'Linux' })
  await start($); await $.command.run({ command: 'minmini', args: '' }); await clock.settle()
  await $.turn.complete(turn('c'))
  expect(log.runs).toContainEqual(['notify-send', 'minmini', 'Claude finished. Back to work when you are ready.'])
})
