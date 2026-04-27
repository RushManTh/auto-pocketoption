# Live Playwright Trading

เอกสารนี้อธิบายโหมด `live_playwright` สำหรับการเทรดเงินจริงผ่าน Playwright ด้วย flow คล้ายโหมด Demo

## สถานะเริ่มต้น

ระบบถูกตั้งค่าให้เงินจริงถูกล็อกไว้ก่อนเสมอ ค่าใน `.env` ที่เพิ่มไว้คือ:

```env
ENABLE_LIVE_PLAYWRIGHT_TRADING="false"
LIVE_TRADING_CONFIRMATION_TEXT=""
LIVE_REQUIRE_MANUAL_APPROVAL="true"
POCKET_OPTION_LIVE_TRADE_AMOUNT="1"
POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT="1"
POCKET_OPTION_LIVE_ACCOUNT_TEXT=""
```

ถ้าค่าเหล่านี้ยังไม่ครบ ระบบจะไม่กดเงินจริง

## วิธีเปิดโหมดเงินจริง

หลังทดสอบ Demo จนมั่นใจแล้ว ให้ตั้งค่าใน `.env` แบบตั้งใจเท่านั้น:

```env
EXECUTION_MODE="live_playwright"
AUTO_TRADE_ENABLED="true"
ENABLE_LIVE_PLAYWRIGHT_TRADING="true"
LIVE_TRADING_CONFIRMATION_TEXT="I_UNDERSTAND_THIS_USES_REAL_MONEY"
LIVE_REQUIRE_MANUAL_APPROVAL="true"
POCKET_OPTION_LIVE_TRADE_AMOUNT="1"
POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT="1"
POCKET_OPTION_LIVE_ACCOUNT_TEXT="ข้อความบัญชีเงินจริงที่เห็นใน Pocket Option"
KILL_SWITCH="false"
```

`POCKET_OPTION_LIVE_ACCOUNT_TEXT` ต้องตรงกับข้อความที่มองเห็นใน dropdown ของบัญชีเงินจริง เช่นชื่อบัญชีหรือ label ที่ Pocket Option แสดง ไม่ควรปล่อยว่าง

## โหมด Manual Approval

ค่าเริ่มต้นคือ:

```env
LIVE_REQUIRE_MANUAL_APPROVAL="true"
```

เมื่อเปิดค่านี้ ระบบจะรับสัญญาณและสร้าง trade intent เป็น `WAITING_APPROVAL` แต่จะยังไม่กด CALL/PUT จริง เหมาะสำหรับช่วงทดสอบ live mode รอบแรก

ให้เปิดหน้า `/manual-approval` เพื่อกด `Approve` หรือ `Reject` รายการที่รออยู่ ถ้ากด `Approve` ระบบจะเรียก live Playwright session แบบ manual-approved และยังต้องผ่าน live guard ทุกชั้นก่อนกดจริง

ถ้าต้องการให้ระบบกดเงินจริงอัตโนมัติเหมือน Demo ต้องเปลี่ยนเป็น:

```env
LIVE_REQUIRE_MANUAL_APPROVAL="false"
```

ให้เปลี่ยนค่านี้เฉพาะเมื่อทดสอบ account detection, amount, expiry, kill switch, และ status log แล้วเท่านั้น

## สิ่งที่ระบบตรวจ ก่อนกดเงินจริง

ระบบจะบล็อกการกดเงินจริงถ้าเงื่อนไขใดเงื่อนไขหนึ่งไม่ผ่าน:

- `EXECUTION_MODE` ไม่ใช่ `live_playwright`
- `ENABLE_LIVE_PLAYWRIGHT_TRADING` ไม่ใช่ `true`
- `LIVE_TRADING_CONFIRMATION_TEXT` ไม่ตรงกับ `I_UNDERSTAND_THIS_USES_REAL_MONEY`
- `POCKET_OPTION_LIVE_ACCOUNT_TEXT` ว่างหรือยืนยันบัญชีเงินจริงไม่ได้
- `KILL_SWITCH` เป็น `true`
- amount มากกว่า `POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT`
- Playwright ยังอยู่บัญชี `QT Demo`
- asset, amount, หรือ expiry ไม่ผ่าน guard ก่อนคลิก
- `LIVE_REQUIRE_MANUAL_APPROVAL` ยังเป็น `true`

## Dashboard Status

หน้า Dashboard มี `System Status` แสดงสถานะสำคัญ:

- `Telegram`
- `Playwright Browser`
- `Pocket Option Page`
- `Live Trading`
- `Demo Trade`

ถ้า live mode ถูกล็อก จะเห็นสถานะ `Locked`, `Approval`, `Blocked`, หรือข้อความ error ที่เกี่ยวข้อง

## ขั้นตอนทดสอบที่แนะนำ

1. ทดสอบ `demo` ให้ครบก่อน
2. ตั้ง `EXECUTION_MODE="live_playwright"` แต่คง `LIVE_REQUIRE_MANUAL_APPROVAL="true"`
3. ส่ง test signal แล้วตรวจว่า intent ถูกสร้างเป็น `WAITING_APPROVAL`
4. เปิด `/manual-approval` แล้วทดสอบ `Reject` ก่อนหนึ่งครั้ง
5. ทดสอบ `Approve` ตอนบัญชียังไม่มีเงินหรือใช้ amount ต่ำสุด แล้วตรวจ screenshot/log
6. ตรวจ `System Status` และ `Worker Log`
7. ตรวจว่า Playwright ยืนยันบัญชีเงินจริงได้จริง ไม่ใช่ `QT Demo`
8. ตั้ง amount ต่ำสุด และ max amount ต่ำสุด
9. เมื่อมั่นใจแล้วจึงตั้ง `LIVE_REQUIRE_MANUAL_APPROVAL="false"`

## ข้อควรระวัง

- โหมดนี้ใช้ Playwright กดหน้าเว็บจริง ไม่ใช่ official broker API
- UI ของ Pocket Option เปลี่ยนได้ ทำให้ selector หรือ account detection ผิดพลาดได้
- ควรเปิด `POCKET_OPTION_HEADLESS="false"` ในช่วงทดสอบ live mode เพื่อมองเห็นการทำงาน
- อย่าเพิ่ม `POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT` จนกว่าจะมีประวัติทดสอบจริงเพียงพอ
- ใช้ `KILL_SWITCH="true"` เพื่อหยุดระบบทันทีเมื่อเห็นความผิดปกติ
- ห้ามใช้เงินที่รับความเสี่ยงไม่ได้
