# my-budget-app

個人記帳本 Web App。React + Vite 前端，Supabase 負責資料庫與身份驗證。

## 啟動方式

```
npm run dev
```

瀏覽器開 http://localhost:5173

## 技術棧

- **前端**：React + Vite
- **後端/DB**：Supabase（PostgreSQL + Auth）
- **環境變數**：`.env` 內設定 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

## 專案結構

```
src/
  main.jsx      # 入口
  App.jsx       # 登入/登出邏輯、session 管理
  Budget.jsx    # 主記帳畫面
  supabase.js   # Supabase client 初始化
```

## Supabase 資料表

| 表名 | 欄位 | 說明 |
|------|------|------|
| `accounts` | id, user_id, household_id, name, balance, color, account_type, billing_day, payment_due_day | 帳戶，RLS 隔離（私人 or 共同）；account_type: general/credit；billing_day: 信用卡每月出帳日；payment_due_day: 繳款截止日（繳款提醒用） |
| `categories` | id, user_id, name, icon, type | 分類，RLS 隔離（每人各自管理） |
| `transactions` | id, user_id, account_id, category_id, amount, type, note, txn_date | 交易紀錄，RLS 隔離 |
| `budgets` | id, user_id, category_id, month, amount | 每月分類預算，unique(user_id, category_id, month) |
| `households` | id, name, invite_code, created_by, monthly_budget | 共同帳戶群組（含月預算） |
| `household_members` | household_id, user_id | 群組成員，RLS 只能看自己的記錄 |
| `installments` | id, user_id, account_id, category_id, name, total_amount, monthly_amount, total_months, start_month, note, last_added_month, pending_amount | 信用卡分期計畫；last_added_month 記錄上次 auto-add 到哪個月；pending_amount 是已加入待繳但尚未結清的金額 |
| `recurrings` | id, user_id, account_id, category_id, amount, type, note, day_of_month, last_added_month | 週期性消費；每月 day_of_month 號自動建立交易，last_added_month 記錄補到哪個月 |
| `templates` | id, user_id, name, account_id, category_id, amount, type, note | 快速記帳範本，主頁一鍵帶入 |

> 新表與新欄位的 migration SQL 在 `supabase-migration-20260611.sql`，需在 Supabase Dashboard → SQL Editor 執行一次。
> 外部 API 記帳用的 `add_transaction` RPC 在 `supabase-migration-20260614-add-transaction-rpc.sql`（iOS 捷徑快速記帳用），同樣需執行一次。

## 頁面結構

### 主頁（記帳）
- 信用卡繳款提醒橫幅（7 天內到期）
- 帳戶餘額卡片
- 快速記帳範本 chips + 記帳 / 轉帳 表單（選信用卡帳戶後可切換單筆 / 分期、存範本）
- 月份切換 + 圓餅圖
- 關鍵字搜尋 + 篩選 + 交易列表

### 設定頁（設定）
- 預算設定
- 共同帳戶設定
- 帳戶管理
- 分類管理
- 週期性消費
- 年度統計
- 資料管理（含匯入 CSV、完整備份 / 還原）

## 目前功能

- Email + 密碼 登入 / 註冊（Supabase Auth）
- 底部導航列 — 「記帳」/ 「信用卡」/ 「設定」三頁切換
- 帳戶餘額卡片顯示（一般帳戶；新增/編輯/刪除交易時自動更新）；記帳表單只顯示一般帳戶
- 新增 / 編輯收支（選帳戶、分類、金額、日期、備註）
- 刪除交易
- 帳戶間轉帳
- 月份篩選 — 左右箭頭切換月份，顯示該月所有記錄
- 分類統計圓餅圖 — 每月各分類支出比例（純 SVG，無外部套件）
- 預算設定 — 每月各支出分類設定預算，進度條顯示使用比例（綠/橘/紅）
- 篩選交易 — 依分類或帳戶過濾列表
- 匯出 CSV — 依目前篩選條件匯出，含 BOM 讓 Excel 正確顯示中文
- 帳戶管理 — 新增 / 編輯（名稱、餘額、顏色、類型、出帳日）/ 刪除，可切換共同 ↔ 私人
- 分類管理 — 新增 / 編輯 / 刪除分類
- 共同帳戶（household）— 建立群組 / 邀請碼加入 / 月預算 / 本月已花、剩餘、帳戶餘額摘要、進度條
- 資料管理 — 依月份檢視交易、單筆刪除（自動修正帳戶餘額）、清除全部交易
- 信用卡帳戶 — 支出增加待繳、轉入視為繳費、橘紅「卡」標籤 + 「待繳 $X」
- 信用卡分期 — 記帳表單選信用卡後切換單筆 / 分期，依出帳日自動計算首期月份；信用卡頁追蹤進度、刪除
- 信用卡獨立頁籤 — 刷卡記帳表單（固定支出、單筆/分期）、信用卡帳戶卡片、本月刷卡支出、分期總待結清、分期進度列表
- **分期 auto-add**：每次開 App 自動偵測新出帳月份，將當月分期金額加入信用卡待繳（`pending_amount`）；只加**本月及之後**，之前的月份假設使用者已在現實繳過。「已結清」按鈕一次清掉所有累積的 pending_amount。
- 信用卡本月帳單依出帳日切分帳單週期（上月出帳日 ～ 本月出帳日前一天），卡片顯示週期區間
- 信用卡繳款提醒 — 帳戶設定繳款截止日後，7 天內到期且有待繳金額時，主頁與信用卡頁顯示提醒橫幅（2 天內轉紅）
- 週期性消費 — 設定頁管理（帳戶、分類、金額、每月幾號、備註）；每次開 App 自動補建 `last_added_month` 之後、日子已到的交易並調整餘額
- 快速記帳範本 — 記帳表單「存範本」儲存常用消費，主頁 chips 一鍵帶入，× 刪除
- 交易搜尋 — 主頁關鍵字搜尋備註 / 分類 / 帳戶，與篩選、匯出 CSV 連動
- 年度統計 — 設定頁年份切換 + 每月支出/收入長條圖（純 SVG）+ 年支出/收入/結餘
- 匯入 CSV — 資料管理頁，對應匯出格式（日期,類型,帳戶,分類,金額,備註），依名稱對應帳戶/分類，自動調整餘額，無法對應的列略過
- 完整備份 / 還原 — 匯出全部資料 JSON；還原時以「新增」方式匯入（id 重新對應，共同帳戶轉為私人），不覆蓋現有資料
- PWA — vite-plugin-pwa（autoUpdate），手機可加到主畫面

### 分期待繳邏輯（重要）

- **建立分期**：`last_added_month = currentMonth - 1`（不動 account.balance）；auto-add 在同次 `fetchInstallments` 立即跑，只加本月起的期數。
- **auto-add**（`autoAddInstallmentCharges`）：從 `last_added_month + 1` 到目前月份，逐月判斷 `elapsed >= 0 && elapsed < total_months`，符合才加到 `pending_amount` 和 `account.balance`。
- **舊資料遷移**（`last_added_month == null`）：查出該分期名稱相關的舊繳款交易，算出 `paidSum`；將 `total_amount - paidSum`（舊程式碼加進去的淨餘）從 balance 扣除；然後以 `last_added_month = currentMonth - 1` 重新走 auto-add 流程，只加本月。
- **已結清**：transaction type = income，balance -= pending_amount，pending_amount = 0。

## 待開發

- [x] **桌面快速記帳（1）PWA Shortcuts**：vite.config.js manifest 加 `shortcuts`（記一筆 → `/?page=main`、刷卡記帳 → `/?page=credit`），Android 長按 App 圖示跳快捷選單（已完成）
- [x] **桌面快速記帳（2）Deep link**：Budget.jsx `page` state 讀網址 `?page=` 參數，開啟即跳對應頁，兩平台通用（已完成）
- [x] **桌面快速記帳（3）iOS 捷徑寫入 Supabase**：建 `add_transaction` RPC（`supabase-migration-20260614-add-transaction-rpc.sql`），一次原子操作插交易＋改餘額，餘額邏輯同前端（信用卡 expense 動 balance）；iOS 捷徑流程：password grant 拿 token → 呼叫 RPC。需在 Supabase SQL Editor 執行 migration（SQL 已備妥，待手機端設定捷徑）
- [ ] 共同帳戶交易標記「誰付的」+ 自動計算每人應付金額
- [ ] 常用 EMOJI 無法點擊（分類管理頁）
- [ ] 抑制 Google 翻譯彈出通知
- [ ] 可調色盤
- [ ] 深色模式
- [ ] 週期性消費編輯功能（目前只能刪除後重建）

## 已知 Bug

- [x] **「本月帳單」未依出帳日切分**：`cardStatement` 的單筆部分原本直接加總日曆月，未套用 `billing_day`。改為依帳單週期計算：`fetchTransactions` 多抓上個月交易（`prevMonthTxns`），單筆 = 上月出帳日（含）後的刷卡 + 本月出帳日前的刷卡，與 `calcStartMonth` 同標準；無出帳日則維持日曆月。卡片標籤顯示週期區間（例：本月帳單（5/15～6/14））（已修復）
- [x] **分期建立後信用卡待繳未更新**：改由 auto-add 處理，建立時不直接動 balance（已修復）
- [x] **calcStartMonth 邊界條件**：`day <= billingDay` 改為 `day < billingDay`，刷卡日等於出帳日時正確推入下個月（已修復）
- [x] **本月繳款待繳反增**：改為「已結清」按鈕，一次清掉 pending_amount，type 改為 `'income'`（已修復）
- [x] **從中間期數開始記帳顯示總額**：auto-add 的 `last_added_month` 初始設為 `currentMonth - 1`（非 `startMonth - 1`），確保只加本月起的期數，之前視為已在現實繳過（已修復）

## 桌面快速記帳

三種從手機/電腦桌面快速記帳的方式，可並用：

### 1. PWA Shortcuts（長按 App 圖示跳快捷）
- `vite.config.js` manifest 的 `shortcuts`：「記一筆」→ `/?page=main`、「刷卡記帳」→ `/?page=credit`。
- Android 長按已安裝的 PWA 圖示會跳出快捷選單（iOS 部分版本支援）。
- 改 manifest 後需 push 部署，並**移除舊 PWA 重新安裝**才生效。

### 2. Deep link（開啟即跳對應頁）
- `Budget.jsx` 的 `page` state 初始值讀網址 `?page=` 參數（`main`/`credit`/`settings`）。
- 點任何帶參數的連結/捷徑都會直接開到該記帳畫面，兩平台通用。

### 3. iOS 捷徑直接寫入 Supabase（不開 App）

用 iPhone 內建「捷徑」App 做一個桌面按鈕，點下去輸入金額就直接記一筆進資料庫，不用打開記帳 App。背後是打 `add_transaction` RPC（`supabase-migration-20260614-add-transaction-rpc.sql`），一次同時插交易＋改餘額（一般帳戶 expense 扣 balance；信用卡 expense 加 balance＝待繳增加）。

#### 先搞懂三個名詞（捷徑 App 用語）

- **動作**：捷徑裡的一個積木，照順序由上往下執行。每加一步就是「加入一個動作」。
- **變數**：像一張便利貼，把某個值（例如登入後拿到的通行證）記住，後面動作可以拿來用。
- **取得 URL 內容**：捷徑用來「打 API」的動作。點它下方「顯示更多」才會出現「方法 / 標頭 / 請求本文」三個欄位。

#### 前置（各做一次）

1. Supabase Dashboard → SQL Editor → 貼上並執行 `supabase-migration-20260614-add-transaction-rpc.sql`。
2. 記下兩個固定值（後面一直會用到）：
   - 網址開頭：`https://oriaxsatoyubbdbslael.supabase.co`
   - 金鑰（apikey）：`sb_publishable_amc8hUlSD5Gk9Suvz85wGg_so2w5kgP`
3. 用 Supabase → Table Editor 打開 `accounts` 跟 `categories`，把每筆的 `name` 和對應 `id`（一長串 UUID）抄下來，等等簡單版會用到。

---

#### 簡單版（推薦先做，帳戶/分類寫死，最好懂）

打開「捷徑」App → 右上 ➕ 新增捷徑，照順序加入動作：

**步驟 1：登入拿通行證（Token）**
- 加入動作「**取得 URL 內容**」→ 點「顯示更多」展開
  - 方法：選 **POST**
  - 網址：`https://oriaxsatoyubbdbslael.supabase.co/auth/v1/token?grant_type=password`
  - 標頭（點「新增標頭」）：鍵填 `apikey`，值填上面那串金鑰
  - 請求本文：選 **JSON**，加兩個欄位：
    - `email` = 你的登入信箱
    - `password` = 你的登入密碼
- 加入動作「**從輸入取得字典值**」（Get Dictionary Value）
  - 取得「值」，鍵填 `access_token`
- 加入動作「**設定變數**」，名稱叫 `Token`，值選上一步的結果
  - （之後凡是要用通行證的地方，就插入這個 `Token` 變數）

**步驟 2：選帳戶**
- 加入動作「**從選單中選擇**」（Choose from Menu），提示打「選帳戶」
  - 為每個帳戶加一個選項，例如：現金、信用卡、銀行
  - 在「現金」這個分支底下，加入動作「**文字**」貼上現金帳戶的 UUID，再加「**設定變數**」名稱 `AccID` = 這段文字
  - 其他帳戶分支照做（各自貼自己的 UUID、都設定到同一個變數 `AccID`）

**步驟 3：選分類**
- 同步驟 2，「從選單中選擇」提示「選分類」，每個分類分支貼各自 UUID → 設定變數 `CatID`

**步驟 4：輸入金額**
- 加入動作「**要求輸入**」（Ask for Input），輸入類型選「**數字**」，提示打「金額」
- 加入動作「**設定變數**」名稱 `Amount` = 上一步結果

**步驟 5：送出記帳**
- 加入動作「**取得 URL 內容**」→「顯示更多」
  - 方法：**POST**
  - 網址：`https://oriaxsatoyubbdbslael.supabase.co/rest/v1/rpc/add_transaction`
  - 標頭加三個：
    - `apikey` = 金鑰
    - `Authorization` = 先打 `Bearer ` （Bearer 後面有一個空格），再插入變數 `Token`
    - `Content-Type` = `application/json`
  - 請求本文選 **JSON**，加欄位：
    - `p_account_id` = 變數 `AccID`
    - `p_category_id` = 變數 `CatID`
    - `p_amount` = 變數 `Amount`
    - `p_type` = `expense`
    - `p_note` = 留空或自己打（可省略）
    - （`p_txn_date` 不用填，不填就是今天）
- 加入動作「**顯示通知**」打「已記一筆」確認成功

**步驟 6：放上桌面**
- 捷徑右上 `⋯` → 「加入主畫面」→ 命名「記一筆」、選圖示。
- 刷卡專用就把整個捷徑複製一份，步驟 2 的選單只留信用卡帳戶即可（函數會自動套信用卡待繳邏輯）。

> 缺點：之後在 App 新增帳戶或分類，要回來這個捷徑的選單手動補上。若覺得麻煩，改用下面的動態版。

---

#### 進階版（動態，新增帳戶/分類自動出現、免維護）

差別只在步驟 2、3：不寫死，改成每次即時去 API 抓清單。原理是把抓回來的清單做成一張「名字 → UUID 對照表」（捷徑叫**字典**），選的時候顯示名字、回傳 UUID。

把簡單版的步驟 2 換成：
- 加入動作「**取得 URL 內容**」（GET）
  - 網址：`https://oriaxsatoyubbdbslael.supabase.co/rest/v1/accounts?select=id,name&order=name`
  - 標頭：`apikey` = 金鑰、`Authorization` = `Bearer ` + 變數 `Token`
  - 設定變數 `AccList` = 結果（這是一串帳戶清單）
- 加入動作「**重複執行每一項**」，項目選 `AccList`（會把清單一筆一筆跑過）。在重複內部：
  - 「取得字典值」鍵 `name` → 設定變數 `nm`（這筆的名字）
  - 「取得字典值」鍵 `id` → 設定變數 `uid`（這筆的 UUID）
  - 「**設定字典值**」：字典選 `AccDict`、鍵 = 變數 `nm`、值 = 變數 `uid`
    （等於把「名字→UUID」一筆筆塞進對照表 `AccDict`）
- 重複結束後，加入動作「**從清單中選擇**」，清單選 `AccDict`
  - → 畫面顯示所有帳戶名字，你點一個，回傳對應 UUID → 設定變數 `AccID`

步驟 3 一模一樣，只是網址換成 `…/rest/v1/categories?select=id,name&order=name`，字典換 `CatDict`，最後得到 `CatID`。步驟 1、4、5、6 跟簡單版完全相同。

> 帳戶很少變、分類常新增的話，可以混搭：帳戶用簡單版（寫死）、分類用動態版。

> ⚠️ 這做法會把你的登入信箱+密碼存在捷徑裡，僅限自己的 iPhone 私用，別分享這個捷徑。

## 部署

- 平台：Vercel（免費）
- Repo：https://github.com/roger126925/my-budget-app.git
- 環境變數在 Vercel Dashboard 設定：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

### 更新部署指令

```
cd "d:/Python/0. Finance/2. my-budget-app"
git add .
git commit -m "說明這次改了什麼"
git push
```

git push 後 Vercel 會自動重新部署。

## 注意事項

- Supabase 免費方案閒置一週會自動暫停，需至 supabase.com 手動點「Restore project」

## 操作

- 如果我打**更新**，請更新 CLAUDE.md 跟 log.md
