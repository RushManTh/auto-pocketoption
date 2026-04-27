# Environment Setup

ไฟล์ `.env` ถูกสร้างไว้แล้วสำหรับทดสอบ local โดยใช้ SQLite:

```text
DATABASE_URL="file:./dev.db"
```

เมื่อใช้ Prisma ค่า `file:./dev.db` จะสร้างฐานข้อมูลที่ `prisma/dev.db`

## Local Database

ใช้ SQLite สำหรับ MVP/local test:

```bash
npm run prisma:generate
npm run prisma:push
```

ถ้า `prisma db push` มีปัญหากับ Prisma schema engine บนเครื่อง ให้ใช้ SQL init ที่เตรียมไว้:

```bash
npm run db:local:init
```

ตรวจด้วย Prisma Studio:

```bash
npx prisma studio
```

ถ้าต้องการเริ่ม database ใหม่ ให้หยุด server ก่อน แล้วลบไฟล์นี้:

```text
prisma/dev.db
```

จากนั้นรัน:

```bash
npm run prisma:push
```

## Telegram Values

### `TELEGRAM_API_ID` และ `TELEGRAM_API_HASH`

เอาจาก Telegram official developer page:

1. ไปที่ `https://my.telegram.org/apps`
2. Login ด้วยเบอร์ Telegram
3. สร้าง app ใหม่
4. copy ค่า `api_id` ไปใส่ `TELEGRAM_API_ID`
5. copy ค่า `api_hash` ไปใส่ `TELEGRAM_API_HASH`

### `TELEGRAM_SESSION`

หลังใส่ `TELEGRAM_API_ID` และ `TELEGRAM_API_HASH` แล้ว รัน:

```bash
npm run telegram:session
```

ระบบจะถาม:

- เบอร์ Telegram
- code ที่ Telegram ส่งมา
- 2FA password ถ้าบัญชีเปิดไว้

จากนั้นจะพิมพ์ session string ออกมา ให้นำไปใส่:

```text
TELEGRAM_SESSION="session_string_here"
```

อย่า commit หรือแชร์ค่านี้ เพราะมันใช้เข้าถึง Telegram account ของคุณได้

### `TELEGRAM_CHANNEL_ID`

ใส่ channel/group ที่ account ของคุณเข้าถึงได้:

```text
TELEGRAM_CHANNEL_ID="@channel_username"
```

หรือใช้ numeric id:

```text
TELEGRAM_CHANNEL_ID="-1001234567890"
```

สำหรับ private channel วิธีที่ง่ายคือใช้ username ถ้ามี ถ้าไม่มีจะต้อง resolve id จาก Telegram client ภายหลัง

## Telegram Test Signal Bot

ระบบมีหน้า `/test-signal` และ script `npm run telegram:test-signal` สำหรับส่งข้อความทดสอบเข้า Telegram channel/group ผ่าน Bot API แล้วให้ `telegram-worker` อ่านกลับมาด้วย Telegram Client API

### `TELEGRAM_BOT_TOKEN`

เอาจาก BotFather:

1. เปิด Telegram แล้วคุยกับ `@BotFather`
2. ส่ง `/newbot`
3. ตั้งชื่อ bot และ username
4. copy token ที่ได้มาใส่:

```text
TELEGRAM_BOT_TOKEN="123456789:AA..."
```

### `TELEGRAM_TEST_CHAT_ID`

คือ channel/group ที่ bot จะส่งข้อความ test signal เข้าไป:

```text
TELEGRAM_TEST_CHAT_ID="@your_test_channel"
```

หรือ numeric id:

```text
TELEGRAM_TEST_CHAT_ID="-1001234567890"
```

การตั้งค่า channel สำหรับทดสอบ:

1. สร้าง Telegram channel/group สำหรับ test โดยเฉพาะ
2. เพิ่ม bot เข้า channel/group
3. ถ้าเป็น channel ให้ตั้ง bot เป็น admin ที่ post message ได้
4. ให้ Telegram account ที่ใช้ `TELEGRAM_SESSION` join channel/group นี้ด้วย
5. ตั้ง `TELEGRAM_CHANNEL_ID` เป็น channel/group เดียวกัน เพื่อให้ worker อ่านข้อความที่ bot ส่งเข้าไป

ทดสอบผ่านหน้าเว็บ:

```text
http://localhost:3002/test-signal
```

ทดสอบผ่าน terminal:

```bash
npm run telegram:check-bot
npm run telegram:test-signal
npm run telegram:test-signal -- call
npm run telegram:test-signal -- put
npm run telegram:test-signal -- go
```

flow ที่ต้องเปิด 2 process:

```bash
npm run worker:telegram
npm run telegram:test-signal
```

เมื่อส่งสำเร็จ worker ควร log ข้อความพร้อม parsed signal ออกมา

ถ้าเจอ `Bad Request: chat not found`:

- ถ้าใช้ public channel ให้ `TELEGRAM_TEST_CHAT_ID` เป็น `@channel_username` ไม่ใช่ชื่อ display ของ channel
- ถ้าเป็น private channel/group ให้ใช้ numeric id รูปแบบ `-1001234567890`
- bot ต้องถูกเพิ่มเข้า channel/group แล้ว
- ถ้าเป็น channel bot ต้องเป็น admin และมีสิทธิ์ post message
- `TELEGRAM_CHANNEL_ID` กับ `TELEGRAM_TEST_CHAT_ID` ควรชี้ไปที่ channel/group เดียวกันตอนทดสอบ end-to-end
- หลังแก้ `.env` ต้อง restart Next.js server และ worker

คำสั่งเช็ก token/chat:

```bash
npm run telegram:check-bot
```

ถ้าไม่แน่ใจว่า channel id คืออะไร ให้ใช้ Telegram Client session list dialogs:

```bash
npm run telegram:list-dialogs
```

ดูค่า `recommendedId` ของ channel/group ที่ต้องการ แล้วนำไปใส่ทั้งสองตัวนี้:

```text
TELEGRAM_CHANNEL_ID="-100..."
TELEGRAM_TEST_CHAT_ID="-100..."
```

สำหรับ Bot API ถ้าเป็น channel/group ส่วนใหญ่ต้องใช้ id แบบ `-100...` หรือใช้ public username เช่น `@your_channel_username`

## Redis

MVP ยังรัน dashboard/parser/test ได้โดยไม่ต้องเปิด Redis แต่ trade worker ที่ใช้ BullMQ ต้องมี Redis:

```text
REDIS_URL="redis://localhost:6379"
```

ถ้ายังไม่ใช้ worker จริง สามารถปล่อยค่า default ไว้ก่อนได้

## Pocket Option Login และ Token

ระบบนี้ไม่รองรับการ import browser token/cookie/session จาก DevTools เพื่อเลี่ยง login เพราะเสี่ยงด้านความปลอดภัย, 2FA/captcha bypass และอาจผิดเงื่อนไขแพลตฟอร์ม

สิ่งที่รองรับ:

```text
POCKET_OPTION_OFFICIAL_API_TOKEN=""
POCKET_OPTION_OFFICIAL_API_BASE_URL=""
```

ใช้ได้เฉพาะกรณีเป็น token/API endpoint ที่ Pocket Option ออกให้อย่างเป็นทางการหรืออนุญาตกับบัญชีของคุณจริง

สิ่งที่ไม่ควรใส่:

- copied browser cookie
- localStorage/sessionStorage token จาก DevTools
- session token ที่ใช้ข้ามหน้า login
- token ที่ทำให้หลบ 2FA, captcha หรือ device verification

โหมด Playwright ใช้วิธีนี้:

1. เปิด browser ด้วย persistent profile ที่ `POCKET_OPTION_PROFILE_DIR`
2. ผู้ใช้ login Pocket Option เองครั้งแรกใน browser นั้น
3. session/cookie จะถูกเก็บไว้ใน profile folder
4. รอบถัดไป Playwright ใช้ profile เดิม จึงยัง login อยู่ถ้า session ไม่หมดอายุ

### Login ครั้งแรกด้วย Google Account

ใช้คำสั่งนี้:

```bash
npm run pocket:login
```

สิ่งที่จะเกิดขึ้น:

1. Playwright จะเปิด Chromium profile เฉพาะระบบนี้
2. เข้า `POCKET_OPTION_BASE_URL`
3. ให้คุณกด Login with Google เองในหน้าต่าง browser
4. ทำ Google verification, 2FA, captcha หรือ device check ด้วยตัวเอง
5. เมื่อเข้า Pocket Option cabinet/dashboard ได้แล้ว กลับมาที่ terminal แล้วกด Enter
6. ระบบจะปิด browser และเก็บ session/cookie ไว้ใน `POCKET_OPTION_PROFILE_DIR`

เปิดเช็ก session เดิมภายหลัง:

```bash
npm run pocket:open
```

ถ้าเปิดแล้วเข้า cabinet ได้เลย แปลว่า profile ยัง login อยู่ ถ้าเด้งไปหน้า login ให้รัน `npm run pocket:login` ใหม่

ถ้า Playwright แจ้งว่ายังไม่มี browser:

```bash
npx playwright install chromium
```

ถ้า Google ขึ้นข้อความนี้:

```text
This browser or app may not be secure
```

ให้ใช้ Google Chrome จริงแทน bundled Chromium โดยตั้งค่า:

```text
POCKET_OPTION_BROWSER_CHANNEL="chrome"
```

จากนั้นรันใหม่:

```bash
npm run pocket:login
```

ถ้ายังขึ้นข้อความเดิม ให้ใช้วิธี login ด้วย email/password ของ Pocket Option แทน Google OAuth เพราะ Google อาจบล็อก OAuth ใน browser context ที่ถูกควบคุมด้วย automation แม้ผู้ใช้จะเป็นคนกดเองก็ตาม

ถ้าเครื่องไม่มี Google Chrome ให้ติดตั้ง Google Chrome ก่อน หรือเปลี่ยนเป็น:

```text
POCKET_OPTION_BROWSER_CHANNEL=""
```

ค่าที่เกี่ยวข้อง:

```text
POCKET_OPTION_PROFILE_DIR="./playwright/pocket-option/profile"
POCKET_OPTION_BASE_URL="https://pocketoption.com/cabinet/"
POCKET_OPTION_BROWSER_CHANNEL="chrome"
```

ข้อสำคัญ:

- อย่าเก็บรหัสผ่าน Pocket Option ใน `.env`
- อย่า bypass captcha หรือ 2FA
- ถ้า session หมดอายุ ให้ login เองใหม่
- ใช้ Playwright executor เฉพาะ demo/manual-approved จนกว่าจะยืนยันเงื่อนไขบัญชีและแพลตฟอร์มชัดเจน

ถ้า Pocket Option มี official API/token ที่บัญชีของคุณได้รับอนุญาตจริง ให้ใช้ executor `PocketOptionOfficialApiExecutor` เป็นจุดต่อ โดยตอนนี้ใส่ไว้เป็น placeholder จนกว่าจะมี official API documentation/endpoint ที่ตรวจสอบได้

## Safe Defaults

ค่า default ใน `.env` ตั้งไว้ปลอดภัยสำหรับทดสอบ:

```text
EXECUTION_MODE="paper"
AUTO_TRADE_ENABLED="false"
KILL_SWITCH="false"
```

แปลว่าเปิดระบบแล้วจะยังไม่กด order จริง
