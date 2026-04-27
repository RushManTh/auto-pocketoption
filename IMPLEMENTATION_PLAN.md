# Implementation Plan: Telegram Signal to Pocket Option Trade System

> เป้าหมาย: สร้างระบบด้วย Next.js ที่รับสัญญาณจาก Telegram, แปลงเป็นคำสั่งเทรด, ตรวจ risk rule, แล้วส่งต่อให้ Playwright executor จัดการในโหมด paper/demo/manual approval เป็นหลัก

## 1. Scope และข้อจำกัดสำคัญ

ระบบนี้ควรถูกออกแบบให้เริ่มจากการทดสอบเท่านั้น:

- `Paper Mode`: รับ signal แล้วจำลอง order ในระบบ
- `Assisted Mode`: ระบบเตรียมข้อมูล order และให้ผู้ใช้กดยืนยันเอง
- `Demo Automation Mode`: ใช้ Playwright กด order เฉพาะบัญชี demo หรือบัญชีที่ได้รับอนุญาตให้ automate
- `Live Mode`: เปิดใช้เฉพาะเมื่อยืนยันแล้วว่าไม่ผิดเงื่อนไขของ broker และมี risk control ครบ

ข้อควรระวัง:

- ห้าม bypass captcha, 2FA, anti-bot, rate limit หรือ security mechanism ของแพลตฟอร์ม
- ถ้า broker ไม่อนุญาต automated bot ให้ปิด auto execution และใช้ manual approval แทน
- ต้องมี kill switch ปิดระบบอัตโนมัติได้ทันที
- ต้องเก็บ audit log ทุก signal, decision, click action และ result

## 2. High-Level Architecture

```text
Telegram Channel
  -> Telegram Client Worker (GramJS)
  -> Signal Parser
  -> Signal State Machine
  -> Risk Engine
  -> Trade Queue
  -> Playwright Executor Worker
  -> Pocket Option Web UI

Next.js Dashboard
  -> Signals
  -> Orders
  -> Settings
  -> Risk Rules
  -> Manual Approval
  -> Logs
```

หน้าที่หลักของแต่ละส่วน:

- `Next.js`: dashboard, API, settings, order review, manual approval
- `Telegram Worker`: ใช้ Telegram Client API อ่านข้อความจาก channel/group
- `Parser`: แปลงข้อความ signal เป็น structured data
- `Risk Engine`: ตรวจเงื่อนไขก่อนส่ง order
- `Queue`: แยกงาน execution ออกจาก request lifecycle
- `Playwright Executor`: ควบคุม browser profile และกด order ตาม trade intent
- `Database`: เก็บ raw message, parsed signal, order, result, logs

## 3. Recommended Tech Stack

- Frontend/Backend: `Next.js App Router`
- Language: `TypeScript`
- Database: `PostgreSQL`
- ORM: `Prisma`
- Queue: `BullMQ + Redis`
- Telegram Client: `GramJS`
- Browser Automation: `Playwright`
- Validation: `Zod`
- Logging: `Pino`
- UI: `Tailwind CSS + shadcn/ui`
- Theme: `next-themes` สำหรับ light/dark mode
- Auth: `NextAuth` หรือ auth แบบ local admin สำหรับ MVP

## 4. UI/UX Direction

ใช้ `Tailwind CSS + shadcn/ui` เป็น design system หลัก โดยกำหนดสไตล์เป็น minimal, ใช้งานง่าย, ไม่รก และรองรับทั้ง light mode/dark mode ตั้งแต่เริ่มต้น

หลักการออกแบบ:

- layout ต้องเน้นการอ่านสถานะและตัดสินใจเร็ว ไม่ทำเป็น landing page
- ใช้ sidebar หรือ top navigation ที่เรียบง่ายสำหรับหน้า Dashboard, Signals, Orders, Settings, Manual Approval
- ใช้ `shadcn/ui` components เป็นหลัก เช่น `Button`, `Card`, `Table`, `Tabs`, `Badge`, `Switch`, `Dialog`, `DropdownMenu`, `Select`, `Input`, `Alert`
- ใช้ card เฉพาะกับข้อมูลเป็นกลุ่ม เช่น status metric, order summary, manual approval item
- หลีกเลี่ยง UI ที่ตกแต่งเยอะ, gradient หนัก, animation ฟุ่มเฟือย หรือสีที่ดึงสายตาเกินจำเป็น
- ใช้สีสถานะอย่างชัดเจน:
  - green: allowed, win, connected
  - red: rejected, loss, kill switch active
  - amber: pending, waiting approval, warning
  - muted/gray: idle, disabled, archived
- typography ต้องอ่านง่าย ขนาดตัวอักษรไม่ใหญ่เกินบริบท dashboard
- table ต้อง scan ง่าย มี status badge, timestamp, asset, direction, result
- action ที่สำคัญ เช่น `Approve`, `Reject`, `Kill Switch` ต้องเด่นแต่ไม่รก
- dark mode ต้องไม่ใช่แค่ invert สี แต่ต้องเช็ก contrast ของ badge, table border, chart และ log panel
- UI ทุกหน้าต้อง responsive สำหรับ desktop เป็นหลัก และใช้งานบน tablet/mobile ได้โดยไม่ล้นจอ

Theme implementation:

```text
Tailwind CSS
  -> CSS variables จาก shadcn/ui
  -> next-themes ThemeProvider
  -> light/dark class strategy
  -> persisted theme preference
  -> system theme fallback
```

Component style rules:

- ใช้ `Badge` สำหรับ signal/order state
- ใช้ `Switch` สำหรับ auto trade, kill switch, manual approval mode
- ใช้ `Tabs` แยก active/history/logs ในหน้าที่ข้อมูลเยอะ
- ใช้ `Dialog` สำหรับ confirm action ที่มีความเสี่ยง เช่น approve order หรือเปลี่ยน execution mode
- ใช้ `Alert` สำหรับ warning เช่น browser offline, Telegram disconnected, kill switch enabled
- ใช้ compact table layout สำหรับ signals/orders เพื่อไม่ให้ dashboard รก
- ใช้ empty state แบบสั้น กระชับ และไม่ใส่คำอธิบายยาวในหน้าจอ

## 5. Project Structure

```text
src/
  app/
    layout.tsx
    globals.css
    dashboard/
      page.tsx
    signals/
      page.tsx
    orders/
      page.tsx
    settings/
      page.tsx
    api/
      manual-approval/
        route.ts
    kill-switch/
      route.ts

  components/
    app-shell.tsx
    theme-provider.tsx
    theme-toggle.tsx
    signal-table.tsx
    order-table.tsx
    risk-status.tsx
    executor-status.tsx

  lib/
    db.ts
    logger.ts
    env.ts
    queue.ts

  domain/
    signals/
      parser.ts
      state-machine.ts
      types.ts
    risk/
      engine.ts
      rules.ts
    trading/
      trade-intent.ts
      executor.ts
      result.ts

  workers/
    telegram-worker.ts
    trade-worker.ts

  executors/
    paper-executor.ts
    manual-approval-executor.ts
    pocket-option-playwright-executor.ts

prisma/
  schema.prisma

playwright/
  pocket-option/
    profile/
    selectors.ts
    actions.ts
    guards.ts
```

## 6. Environment Variables

```text
DATABASE_URL=
REDIS_URL=

TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_CHANNEL_ID=

EXECUTION_MODE=paper
AUTO_TRADE_ENABLED=false
KILL_SWITCH=false

DEFAULT_TRADE_AMOUNT=1
MAX_TRADES_PER_DAY=5
MAX_DAILY_LOSS=10
MAX_CONSECUTIVE_LOSSES=2
SIGNAL_MAX_AGE_SECONDS=5

POCKET_OPTION_PROFILE_DIR=./playwright/pocket-option/profile
POCKET_OPTION_BASE_URL=https://pocketoption.com/cabinet/
```

## 7. Data Model

### TelegramMessage

```text
id
telegramMessageId
channelId
text
rawPayload
messageDate
createdAt
```

### Signal

```text
id
telegramMessageId
asset
direction
expirySeconds
candleSeconds
waitForGo
martingale
status
confidence
sourceText
goMessageId
goReceivedAt
createdAt
updatedAt
```

### TradeIntent

```text
id
signalId
asset
direction
amount
expirySeconds
mode
executeAt
status
riskDecision
riskReason
createdAt
updatedAt
```

### Order

```text
id
tradeIntentId
broker
brokerOrderRef
asset
direction
amount
expirySeconds
openedAt
closedAt
status
result
profitLoss
executorLog
createdAt
updatedAt
```

### SystemSetting

```text
id
key
value
updatedAt
```

### AuditLog

```text
id
eventType
entityType
entityId
message
metadata
createdAt
```

## 8. Signal Parsing Rules

ตัวอย่าง signal:

```text
OPEN EUR / AUD HIGHER FOR 5 MIN
Go
Lost option
```

Parser ต้องรองรับ:

- `OPEN {ASSET} HIGHER FOR {N} MIN`
- `OPEN {ASSET} LOWER FOR {N} MIN`
- asset format เช่น `EUR / AUD`, `EUR/AUD`, `EUR AUD`
- direction:
  - `HIGHER`, `UP`, `CALL` -> `CALL`
  - `LOWER`, `DOWN`, `PUT` -> `PUT`
- expiry:
  - `5 MIN`, `5MIN`, `FOR 5 M` -> `300 seconds`
- setup message:
  - `5min Candle`
  - `5min expiry`
  - `wait for go`
  - `without martingale`
- result message:
  - `Win`, `Won`, `Profit`
  - `Lost`, `Loss`, `Lost option`

Parser output:

```ts
type ParsedSignal = {
  type: "SETUP" | "ENTRY" | "GO" | "RESULT" | "UNKNOWN";
  asset?: string;
  direction?: "CALL" | "PUT";
  expirySeconds?: number;
  candleSeconds?: number;
  waitForGo?: boolean;
  martingale?: boolean;
  result?: "WIN" | "LOSS";
  confidence: number;
};
```

## 9. Signal State Machine

```text
IDLE
  -> SETUP_RECEIVED
  -> ENTRY_RECEIVED
  -> WAITING_GO
  -> GO_RECEIVED
  -> RISK_CHECKED
  -> QUEUED
  -> EXECUTING
  -> OPENED
  -> WON | LOST | FAILED | EXPIRED | REJECTED
```

Rules:

- ถ้า setup ระบุ `wait for go` ห้าม execute ตอนเจอ entry signal ทันที
- ถ้าได้รับ `Go` แล้วต้อง execute ภายใน `SIGNAL_MAX_AGE_SECONDS`
- ถ้า `Go` มาช้าเกิน threshold ให้ reject
- ถ้า parser confidence ต่ำกว่า threshold ให้ reject
- ถ้ามี signal ซ้อนกันใน asset เดียวกัน ให้ใช้ policy ที่กำหนด เช่น reject signal ใหม่จนกว่า order เดิมจะจบ

## 10. Risk Engine

Risk engine ต้องตรวจทุกครั้งก่อนสร้าง trade intent:

- `AUTO_TRADE_ENABLED` ต้องเป็น `true`
- `KILL_SWITCH` ต้องเป็น `false`
- execution mode ต้องอนุญาตให้ execute
- signal ต้องยัง fresh
- asset ต้องอยู่ใน whitelist
- amount ต้องไม่เกิน limit
- จำนวน order วันนี้ต้องไม่เกิน `MAX_TRADES_PER_DAY`
- ขาดทุนวันนี้ต้องไม่เกิน `MAX_DAILY_LOSS`
- แพ้ติดกันต้องไม่เกิน `MAX_CONSECUTIVE_LOSSES`
- martingale ต้องปิดโดย default
- ต้องไม่มี order pending ใน asset เดียวกัน ถ้า config ไม่อนุญาต

Risk decision:

```ts
type RiskDecision = {
  allowed: boolean;
  reason: string;
  normalizedAmount: number;
};
```

## 11. Execution Modes

### PaperExecutor

ใช้สำหรับ MVP แรก:

- ไม่เปิด browser
- สร้าง order จำลอง
- บันทึกเวลา entry, expiry, status
- ให้ผู้ใช้กรอก result เอง หรือผูก price feed ภายหลัง

### ManualApprovalExecutor

ใช้สำหรับ assisted trading:

- สร้าง trade intent เป็น `WAITING_APPROVAL`
- แสดงบน dashboard พร้อมปุ่ม `Approve` และ `Reject`
- เมื่อ approve แล้วค่อยส่งเข้า Playwright executor
- เหมาะสำหรับบัญชีจริงมากกว่า auto-click

### PocketOptionPlaywrightExecutor

ใช้สำหรับ demo automation หรือกรณีที่ได้รับอนุญาต:

- ใช้ persistent browser profile
- ผู้ใช้ login เองครั้งแรก
- worker ตรวจ session ก่อน execute
- ตรวจ asset, expiry, amount, direction ก่อน click
- click เฉพาะเมื่อ guard ผ่านครบ
- บันทึก screenshot ก่อนและหลัง click
- ไม่พยายามแก้ captcha/2FA อัตโนมัติ

## 12. Playwright Executor Workflow

ขั้นตอน execution:

```text
1. รับ TradeIntent จาก queue
2. โหลด persistent browser context
3. เปิด Pocket Option cabinet
4. ตรวจว่า login อยู่
5. ตรวจว่า account mode เป็น demo ถ้า EXECUTION_MODE=demo
6. เลือก asset ตาม signal
7. ตั้ง trade amount
8. ตั้ง expiry time
9. ตรวจ UI state อีกครั้ง
10. ถ่าย screenshot ก่อนกด
11. กด Higher หรือ Lower
12. ตรวจว่ามี order ถูกเปิดจริง
13. บันทึก order result เบื้องต้น
14. รอ expiry หรือรอ result message จาก Telegram
15. อัปเดต order status
```

Guard ก่อน click:

```text
- currentAsset === intent.asset
- currentExpirySeconds === intent.expirySeconds
- currentAmount === intent.amount
- page is not loading
- no modal blocking screen
- no captcha/2FA prompt
- signal age <= SIGNAL_MAX_AGE_SECONDS
- kill switch still false
```

ถ้า guard ไม่ผ่าน:

```text
- ไม่ click
- mark order as FAILED หรือ REJECTED
- save screenshot
- create audit log
- notify dashboard
```

## 13. Playwright Selector Strategy

แนวทาง selector:

- ใช้ role/text selector ก่อน ถ้า UI รองรับ
- ใช้ stable data attribute ถ้ามี
- หลีกเลี่ยง selector ที่ผูกกับ class auto-generated
- แยก selector ไว้ใน `playwright/pocket-option/selectors.ts`
- ทุก action ต้องมี assertion หลังทำงาน

ตัวอย่างโครงสร้าง:

```ts
export const pocketOptionSelectors = {
  assetButton: "...",
  assetSearchInput: "...",
  amountInput: "...",
  expiryControl: "...",
  higherButton: "...",
  lowerButton: "...",
  openOrderPanel: "...",
  accountModeLabel: "...",
};
```

หมายเหตุ: selector จริงต้อง inspect จากหน้าเว็บใน environment ของผู้ใช้ เพราะ UI อาจเปลี่ยนตามภาษา, account type, region และ viewport

## 14. Telegram Client Worker

ใช้ `GramJS` เพื่ออ่าน signal จาก channel/group ที่ account เข้าถึงได้:

```text
1. start worker
2. login ด้วย api_id/api_hash
3. save session string
4. subscribe channel messages
5. save raw message to database
6. send text to parser
7. update signal state
```

ข้อควรระวัง:

- ห้าม hardcode session string
- session ต้องอยู่ใน env/secret store
- ถ้า worker disconnect ต้อง reconnect แบบ controlled backoff
- ต้องกัน duplicate message ด้วย `telegramMessageId`

## 15. Queue Design

ใช้ BullMQ:

```text
queues:
  telegram-message
  signal-processing
  trade-execution
  result-reconciliation
```

Job payload:

```ts
type TradeExecutionJob = {
  tradeIntentId: string;
  signalId: string;
  requestedAt: string;
};
```

Queue rules:

- concurrency ของ trade execution เริ่มที่ `1`
- job timeout สั้น เช่น `10-20 seconds`
- retry เฉพาะ error ที่ไม่ใช่ risk rejection
- ห้าม retry click order ถ้าไม่แน่ใจว่า order เปิดไปแล้วหรือยัง

## 16. Dashboard Pages

### Dashboard

- system status
- execution mode
- kill switch
- P/L วันนี้
- จำนวน trades วันนี้
- consecutive losses
- queue status
- light/dark theme toggle
- compact status cards using shadcn/ui

### Signals

- raw Telegram message
- parsed signal
- parser confidence
- state
- related order
- searchable/filterable table
- badge-based status display

### Orders

- order status
- asset
- direction
- amount
- expiry
- result
- screenshot links
- executor logs
- tab view สำหรับ active, history, failed

### Settings

- execution mode
- auto trade toggle
- asset whitelist
- default amount
- max trades/day
- max daily loss
- max consecutive losses
- signal max age
- theme preference
- minimal form layout with clear section grouping

### Manual Approval

- pending trade intents
- approve/reject controls
- risk decision details
- confirmation dialog before approval
- warning alert when execution mode is not paper/demo

## 17. MVP Milestones

### Phase 1: Project Foundation

- สร้าง Next.js project
- ติดตั้ง TypeScript, Tailwind, shadcn/ui, Prisma
- ตั้งค่า shadcn/ui theme tokens
- ตั้งค่า `next-themes`
- สร้าง `ThemeProvider`
- สร้าง `ThemeToggle`
- สร้าง minimal app shell
- ตั้งค่า PostgreSQL และ Redis
- สร้าง env validation
- สร้าง logger
- สร้าง dashboard shell

Definition of done:

- app run ได้
- database migrate ได้
- dashboard เปิดได้
- สลับ light/dark mode ได้
- UI หน้าแรกอ่านง่าย ไม่รก และใช้ shadcn/ui components

### Phase 2: Signal Ingestion

- สร้าง Telegram worker ด้วย GramJS
- login และ save session
- subscribe channel
- save raw message
- กัน duplicate message

Definition of done:

- ข้อความใหม่จาก Telegram ถูกบันทึกลง database
- worker reconnect ได้

### Phase 3: Parser และ State Machine

- เขียน parser สำหรับ setup, entry, go, result
- normalize asset/direction/expiry
- สร้าง signal state machine
- เขียน unit tests จากตัวอย่าง signal จริง

Definition of done:

- parse ตัวอย่าง signal ได้ถูกต้อง
- entry signal รอ `Go` ได้
- result message update order ได้

### Phase 4: Risk Engine

- สร้าง risk rules
- สร้าง settings page
- implement kill switch
- reject signal ที่ไม่ผ่าน rule

Definition of done:

- risk decision ถูกบันทึกทุกครั้ง
- kill switch ปิด execution ได้ทันที

### Phase 5: Paper Trading

- สร้าง PaperExecutor
- สร้าง trade intent
- สร้าง order จำลอง
- dashboard แสดง order lifecycle

Definition of done:

- รับ signal -> wait go -> risk check -> paper order ได้ครบ

### Phase 6: Manual Approval

- สร้าง ManualApprovalExecutor
- สร้าง approval page
- approve/reject trade intent
- audit log ทุก action

Definition of done:

- ผู้ใช้กดยืนยัน trade intent จาก dashboard ได้

### Phase 7: Playwright Demo Executor

- สร้าง persistent browser profile
- เปิด Pocket Option cabinet
- ตรวจ login/session
- สร้าง selector/actions/guards
- เลือก asset, amount, expiry
- กด Higher/Lower เฉพาะเมื่อ guard ผ่าน
- save screenshot ก่อน/หลัง

Definition of done:

- demo order เปิดได้จาก trade intent
- ถ้า guard fail ระบบไม่ click และมี screenshot/log

### Phase 8: Reconciliation และ Reporting

- ผูก result จาก Telegram หรือ manual input
- update order result
- คำนวณ P/L
- ทำ daily report

Definition of done:

- เห็นสถิติ win/loss, P/L, trades/day ใน dashboard

### Phase 9: Hardening

- เพิ่ม tests
- เพิ่ม monitoring
- เพิ่ม alert
- เพิ่ม backup
- เพิ่ม Docker deployment
- เพิ่ม access control

Definition of done:

- ระบบรันต่อเนื่องได้
- log เพียงพอสำหรับ debug
- failure mode ไม่ทำให้เกิด duplicate order

## 18. Testing Plan

Unit tests:

- parser
- state machine
- risk engine
- asset normalization
- duplicate message handling

Integration tests:

- Telegram raw message -> signal
- signal -> trade intent
- trade intent -> paper order
- manual approval -> queued execution

Playwright tests:

- session check
- blocked modal detection
- guard validation
- screenshot capture
- no-click when guard fails

Manual test scenarios:

- signal ปกติ + Go
- signal ไม่มี Go
- Go ช้าเกิน threshold
- asset ไม่อยู่ whitelist
- kill switch on
- daily loss exceeded
- consecutive losses exceeded
- browser session expired
- captcha/2FA appears
- light mode dashboard
- dark mode dashboard
- mobile/tablet responsive view
- long text in signal/order table does not overflow

## 19. Failure Handling

กรณีที่ต้อง fail closed:

- parser confidence ต่ำ
- signal stale
- browser ไม่พร้อม
- login หลุด
- account mode ไม่ตรง
- asset ไม่ตรง
- expiry ไม่ตรง
- amount ไม่ตรง
- modal/captcha/2FA ขึ้น
- network delay สูง
- ไม่สามารถยืนยันได้ว่า order เปิดหรือยัง

Policy:

- ถ้าไม่มั่นใจ ให้ไม่ click
- ถ้า click แล้วไม่แน่ใจว่า order เปิดหรือไม่ ให้ mark `UNKNOWN` และหยุด retry
- ส่ง notification ให้ผู้ใช้ตรวจเอง

## 20. Security Checklist

- เก็บ Telegram session ใน secret store
- จำกัด dashboard ด้วย auth
- อย่า expose API endpoint ที่สั่ง trade ได้โดยไม่มี auth
- CSRF protection สำหรับ manual approval
- audit log สำหรับ approve/reject/kill switch
- encrypt sensitive settings ถ้าจำเป็น
- ไม่ commit `.env`, session, browser profile
- จำกัด server access ด้วย firewall/VPN ถ้า deploy เอง

## 21. Deployment Plan

Local development:

```text
next dev
postgres local/docker
redis local/docker
telegram worker
trade worker
```

Production-style VPS:

```text
Next.js app
PostgreSQL
Redis
Telegram worker process
Trade worker process
Playwright browser dependencies
Persistent volume for browser profile
Process manager เช่น PM2 หรือ Docker Compose
```

Playwright deployment notes:

- ใช้ headed mode ระหว่างทดสอบ
- ใช้ persistent profile แยกเฉพาะระบบนี้
- monitor browser process
- restart worker แบบ controlled
- อย่าใช้ browser profile เดียวกับ browser ส่วนตัว

## 22. Initial Backlog

1. Bootstrap Next.js + Prisma + PostgreSQL
2. Install Tailwind CSS + shadcn/ui
3. Add next-themes light/dark mode
4. Create minimal app shell
5. Create env validation
6. Create database schema
7. Create Telegram worker
8. Implement parser
9. Implement signal state machine
10. Implement risk engine
11. Implement paper executor
12. Build dashboard tables
13. Add manual approval
14. Add Playwright executor skeleton
15. Add selector discovery script
16. Add Playwright guards
17. Add screenshots/logs
18. Add result reconciliation
19. Add tests
20. Add responsive UI checks
21. Add Docker Compose
22. Run demo-only dry run

## 23. Go/No-Go Criteria Before Any Auto Execution

ก่อนเปิด auto execution ต้องผ่านทุกข้อ:

- paper mode parse signal ถูกต้องอย่างน้อย 100 signals
- demo mode ผ่านอย่างน้อย 30 trades โดยไม่มี wrong asset/wrong direction/wrong expiry
- no duplicate order incidents
- kill switch ผ่านการทดสอบ
- risk limits ผ่านการทดสอบ
- browser guard fail แล้วไม่ click จริง
- audit log ครบ
- ยืนยันแล้วว่า execution mode ที่ใช้ไม่ผิดเงื่อนไขบัญชีหรือแพลตฟอร์ม

## 24. Recommended Default Config

```text
EXECUTION_MODE=paper
AUTO_TRADE_ENABLED=false
KILL_SWITCH=false
DEFAULT_TRADE_AMOUNT=1
MAX_TRADES_PER_DAY=3
MAX_DAILY_LOSS=3
MAX_CONSECUTIVE_LOSSES=1
SIGNAL_MAX_AGE_SECONDS=5
ALLOW_MARTINGALE=false
TRADE_EXECUTION_CONCURRENCY=1
```

## 25. Final Implementation Principle

ระบบนี้ต้องยึดหลัก fail closed:

```text
ถ้าข้อมูลไม่ชัด -> ไม่เทรด
ถ้า UI ไม่ตรง -> ไม่กด
ถ้า risk ไม่ผ่าน -> ไม่ส่ง order
ถ้าไม่รู้ว่า order เปิดไปหรือยัง -> หยุด retry และให้คนตรวจ
```

เป้าหมายของ MVP ไม่ใช่การรีบ auto trade ด้วยเงินจริง แต่คือการพิสูจน์ว่า signal ingestion, parser, state machine, risk engine และ execution guard ทำงานแม่นพอก่อน
