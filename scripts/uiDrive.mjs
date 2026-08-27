/**
 * Manual UI driver for local visual checks.
 *
 * Talks to a headless Chrome over CDP to seed the app through its own UI and
 * capture screenshots. Not part of the build or the test suite — it exists so a
 * redesign can be eyeballed without clicking through every page by hand.
 *
 *   npx vite preview --port 5200
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --remote-debugging-port=9222 about:blank
 *   node scripts/uiDrive.mjs seed
 *   node scripts/uiDrive.mjs shot /today /dashboard
 */
import fs from 'node:fs'

const BASE = 'http://localhost:5200'
const CDP = 'http://127.0.0.1:9222'
const OUT = '/tmp'

async function connect() {
  const targets = await (await fetch(`${CDP}/json/list`)).json()
  const page = targets.find((target) => target.type === 'page')
  const socket = new WebSocket(page.webSocketDebuggerUrl)

  let id = 0
  const pending = new Map()
  const errors = []

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      )
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(
        `console.error: ${message.params.args.map((arg) => arg.value ?? arg.description).join(' ')}`,
      )
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id
      pending.set(messageId, resolve)
      socket.send(JSON.stringify({ id: messageId, method, params }))
    })

  await new Promise((resolve) => (socket.onopen = resolve))
  await send('Runtime.enable')
  await send('Page.enable')

  return { send, errors, close: () => socket.close() }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function viewport(send, width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  })
}

async function go(send, path, settle = 2600) {
  await send('Page.navigate', { url: `${BASE}${path}` })
  await wait(settle)
}

async function capture(send, name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const file = `${OUT}/ui_${name.replace(/\W+/g, '_')}.png`
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
  console.log('captured', file)
}

/** Types a line into the quick-add box and submits it, the way a user would. */
async function quickAdd(send, text) {
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      (async () => {
        const input = document.querySelector('input[aria-label="What are you working on?"]')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, ${JSON.stringify(text)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 60))
        input.closest('form').requestSubmit()
        await new Promise((r) => setTimeout(r, 650))
      })()
    `,
  })
}

const TASKS = [
  'Revise Service Schedule UI @David #CSM 09:00',
  'Create Work Order prototype @"Pak Rito" #FSM 10:30',
  'Review PowerBI capacity dashboard #PowerBI tomorrow',
  'Design system audit #Internal',
  'Urgent CRM banner fix @"Mr. Lim" #Reddot !urgent',
]

async function seed({ send }) {
  await viewport(send, 1440, 1000)
  await go(send, '/today', 3000)

  for (const task of TASKS) await quickAdd(send, task)

  // Tick two boxes so the progress widgets have something to show.
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      (async () => {
        const main = document.querySelector('main')
        main.scrollTo({ top: main.scrollHeight })
        await new Promise((r) => setTimeout(r, 600))
        const boxes = [...document.querySelectorAll('button[role="checkbox"]')]
        boxes[0]?.click(); await new Promise((r) => setTimeout(r, 500))
        boxes[1]?.click(); await new Promise((r) => setTimeout(r, 500))
      })()
    `,
  })
}

async function shots({ send }, paths) {
  await viewport(send, 1440, 1000)
  for (const path of paths) {
    await go(send, path)
    await capture(send, path === '/' ? 'root' : path)
  }
}

async function scrolled({ send }, path, top) {
  await viewport(send, 1440, 1000)
  await go(send, path)
  await send('Runtime.evaluate', {
    expression: `document.querySelector('main').scrollTo({ top: ${top} })`,
  })
  await wait(900)
  await capture(send, `${path}_scrolled`)
}

async function mobile({ send }, path) {
  await viewport(send, 390, 844, true)
  await go(send, path)
  await capture(send, `${path}_mobile`)
}

const [command, ...args] = process.argv.slice(2)
const session = await connect()

try {
  if (command === 'seed') await seed(session)
  else if (command === 'shot') await shots(session, args)
  else if (command === 'scrolled') await scrolled(session, args[0], Number(args[1] ?? 900))
  else if (command === 'mobile') await mobile(session, args[0] ?? '/today')
  else console.log('Usage: uiDrive.mjs seed | shot <paths…> | scrolled <path> <top> | mobile <path>')

  console.log('ERRORS:', session.errors.length ? session.errors.join('\n') : 'none')
} finally {
  session.close()
}
