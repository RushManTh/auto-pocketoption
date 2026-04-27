# Telegram Pocket Option Trade Console

Next.js MVP for receiving Telegram trading signals, parsing them into trade intents, applying risk controls, and routing execution through paper/manual/demo executors.

The default configuration is intentionally conservative:

- `EXECUTION_MODE=paper`
- `AUTO_TRADE_ENABLED=false`
- Playwright execution is limited to demo mode in code
- Live auto execution should remain disabled unless broker rules and account permissions are confirmed

## Quick Start

```bash
npm install
npm run prisma:generate
npm run db:local:init
npm run dev
```

Open `http://localhost:3000`.

This project includes a local `.env` configured for SQLite. See [ENV_SETUP.md](./ENV_SETUP.md) for where each value comes from and how Pocket Option login works.

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run prisma:push
npm run db:local:init
npm run telegram:session
npm run telegram:check-bot
npm run telegram:list-dialogs
npm run telegram:test-signal
npm run pocket:login
npm run pocket:open
npm run worker:telegram
npm run worker:trade
```

## Main Folders

- `src/app`: Next.js dashboard and API routes
- `src/domain`: parser, state machine, risk engine, trade intent models
- `src/executors`: paper, manual, and Playwright demo executors
- `src/workers`: Telegram and trade worker entrypoints
- `playwright/pocket-option`: selector, action, and guard helpers
- `prisma`: database schema

## Telegram Signal Testing

Set these values in `.env`:

```text
TELEGRAM_BOT_TOKEN=""
TELEGRAM_TEST_CHAT_ID=""
TELEGRAM_CHANNEL_ID=""
```

Then run the reader and sender:

```bash
npm run worker:telegram
npm run telegram:test-signal
```

You can also use the dashboard page:

```text
http://localhost:3002/test-signal
```

## Pocket Option Token Policy

Only official API tokens/endpoints approved by Pocket Option should be placed in:

```text
POCKET_OPTION_OFFICIAL_API_TOKEN=""
POCKET_OPTION_OFFICIAL_API_BASE_URL=""
```

Do not paste browser cookies, localStorage tokens, or session tokens copied from DevTools. Playwright mode uses a persistent browser profile and requires manual login when the broker asks for login, 2FA, captcha, or device verification.

First Google login for Pocket Option:

```bash
npm run pocket:login
```

Complete Google login manually in the browser window, then press Enter in the terminal after the Pocket Option cabinet is visible.

If Google shows `This browser or app may not be secure`, keep `POCKET_OPTION_BROWSER_CHANNEL="chrome"` in `.env` so Playwright opens installed Google Chrome. If Google still blocks OAuth, use Pocket Option email/password login instead of Google OAuth for testing.

## Safety Model

The system is built to fail closed:

- unclear signal -> reject
- stale signal -> reject
- kill switch active -> reject
- guard mismatch in browser -> no click
- uncertain order status -> no retry
