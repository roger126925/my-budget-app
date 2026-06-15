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

已完成：
- [x] **桌面快速記帳（1）PWA Shortcuts**：vite.config.js manifest 加 `shortcuts`（記一筆 → `/?page=main`、刷卡記帳 → `/?page=credit`），Android 長按 App 圖示跳快捷選單（已完成）
- [x] **桌面快速記帳（2）Deep link**：Budget.jsx `page` state 讀網址 `?page=` 參數，開啟即跳對應頁，兩平台通用（已完成）
- [x] **桌面快速記帳（3）iOS 捷徑寫入 Supabase**：建 `add_transaction` RPC（`supabase-migration-20260614-add-transaction-rpc.sql`），一次原子操作插交易＋改餘額，餘額邏輯同前端（信用卡 expense 動 balance）；iOS 捷徑流程：password grant 拿 token → 呼叫 RPC。需在 Supabase SQL Editor 執行 migration（SQL 已備妥，待手機端設定捷徑）

### 優先度 1 — 修已知缺陷（影響日常使用）

- [x] **常用 EMOJI 無法點擊**（分類管理頁）— 改為可點擊按鈕，點即填入，支援新增與編輯表單（已修復）
- [x] **週期性消費編輯功能** — 新增 ✎ 按鈕與 inline 編輯表單，可修改所有欄位（已修復）
- [x] **刪除交易 undo 機制** — 移除 confirm 彈窗，改為底部黑色 toast + 復原按鈕（5 秒內可還原）（已修復）

### 優先度 2 — UX 體驗改善（小改、高頻使用）

- [ ] **轉帳備註欄位** — 轉帳目前只記金額，無法留原因
- [ ] **記帳日期快速選「昨天」等** — 補記最常選前一天，手動選月曆很慢
- [ ] **週期性消費「跳過某月」機制** — 訂閱取消那個月仍會被自動加入

### 優先度 3 — 功能補強（中等複雜度）

- [ ] **分期完成後顯示提示** — 分期跑完沒有通知，使用者要自己去確認
- [ ] **年度統計分類趨勢** — 目前只有總額長條圖，缺少各分類逐月比較
- [ ] **深色模式**
- [ ] **可調色盤**

### 優先度 4 — 複雜 / 涉及多人協作

- [ ] **共同帳戶交易標記「誰付的」** + 自動計算每人應付金額
- [ ] 抑制 Google 翻譯彈出通知

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

用 iPhone 內建「捷徑」App 做一個桌面按鈕，點下去 → 選支出/收入/信用卡 → 選帳戶 → 選分類 → 輸入金額 → 直接記一筆進資料庫，不用打開記帳 App。背後是打 `add_transaction` RPC（`supabase-migration-20260614-add-transaction-rpc.sql`），一次同時插交易＋改餘額（一般帳戶 expense 扣 balance；信用卡 expense 加 balance＝待繳增加）。

> ⚠️ 捷徑無法用「貼文字」生成，只能在捷徑 App 一個動作一個動作做，或用 iCloud 連結分享現成的。下面是實際做成功的完整步驟＋踩過的雷。

#### 名詞速記

- **動作**：捷徑的積木，由上往下執行。
- **變數**：便利貼，記住一個值給後面用。
- **取得 URL 內容**：打 API 的動作；點「顯示更多」才會出現「方法 / 標頭 / 請求本文」。
- **快速查看**（Quick Look）：除錯神器，把上一步結果顯示出來。除錯完刪掉。

#### 固定值

- 網址開頭：`https://oriaxsatoyubbdbslael.supabase.co`
- 金鑰（apikey）：`sb_publishable_amc8hUlSD5Gk9Suvz85wGg_so2w5kgP`
- ⚠️ **apikey 一律接在網址尾端當參數**（`...&apikey=金鑰`），比設標頭穩、不會踩到「No API key」。

#### 前置（做一次）

Supabase Dashboard → SQL Editor → 貼上並執行 `supabase-migration-20260614-add-transaction-rpc.sql`。

---

#### 步驟 1：登入拿 Token

- 「**取得 URL 內容**」→「顯示更多」
  - 方法：**POST**
  - 網址（apikey 已接在裡面）：
    `https://oriaxsatoyubbdbslael.supabase.co/auth/v1/token?grant_type=password&apikey=金鑰`
  - 標頭：不用設
  - 請求本文：**JSON**，兩個欄位（鍵全小寫、**前後不可有空格**）：
    - `email` = 記帳 App 登入信箱（**不是** Vercel/Supabase 後台帳號）
    - `password` = 記帳 App 登入密碼（**別接受 iOS 跳出的建議密碼**）
- 「**取得字典值**」：取得「值」、鍵 `access_token`
- 「**設定變數**」`Token` = 上一步結果

#### 步驟 2：選支出 / 收入 / 信用卡

- 「**從選單中選擇**」，提示「要記哪種?」，三個選項：`支出`、`收入`、`信用卡`
- 每個「情況」分支裡放：「**文字**」+「**設定變數** `TxType`」：
  - 情況 支出：文字 `expense` → 設定變數 `TxType`
  - 情況 收入：文字 `income` → 設定變數 `TxType`
  - 情況 信用卡：文字 `expense` → 設定變數 `TxType`（刷卡也是支出，函數自動算待繳）
- ⚠️ 那兩個動作要在各自「情況」框框**內**。

#### 步驟 3：選帳戶（動態，新增自動出現）

原理：抓回帳戶清單 → 做成「名字→UUID 對照表（字典）」→ 跳選單顯示名字、回傳 UUID。

```
取得 URL 內容（GET）
   網址：.../rest/v1/accounts?select=id,name&order=name&apikey=金鑰
   標頭：Authorization = Bearer␣ + 變數 Token   ← Bearer 後面一個空格
設定變數 AccList = 結果
字典（空白）
設定變數 AccDict = 空字典
重複執行每一項（項目＝AccList）      ← ⚠️ 一定是 AccList，不是 AccDict！
    取得字典值：值、鍵 name、來源 重複項目 → 設定變數 nm   ← ⚠️ 鍵 name 不可有空格
    取得字典值：值、鍵 id、來源 重複項目   → 設定變數 uid   ← ⚠️ 鍵 id 不可有空格
    設定字典值：在 AccDict，鍵 nm、值 uid
    設定變數 AccDict = 上一步結果
（重複結束）
從清單中選擇（清單＝AccDict）
設定變數 AccID = 選擇結果
```

#### 步驟 4：選分類

兩種選一種：
- **簡單版（推薦，省事）**：「從選單中選擇」列出分類名字，每個分支「文字」貼該分類 UUID →「設定變數 `CatID`」。（分類 UUID 從 Supabase Table Editor `categories` 表抄。）
- **動態版**：把步驟 3 整段複製，網址 `accounts` 改 `categories`，變數 `AccList→CatList`、`AccDict→CatDict`、`AccID→CatID`。

#### 步驟 5：輸入金額

- 「**要求輸入**」類型「數字」，提示「金額」
- 「**設定變數**」`Amount` = 結果

#### 步驟 6：送出記帳

- 「**取得 URL 內容**」→「顯示更多」
  - 方法：**POST**
  - 網址：`https://oriaxsatoyubbdbslael.supabase.co/rest/v1/rpc/add_transaction?apikey=金鑰`
  - 標頭：`Authorization` = `Bearer ` + 變數 `Token`；`Content-Type` = `application/json`
  - 請求本文 **JSON**：
    - `p_account_id` = `AccID`
    - `p_category_id` = `CatID`
    - `p_amount` = `Amount`
    - `p_type` = 變數 `TxType`
    - `p_note` = 可省略
    - （`p_txn_date` 不填＝今天）
- 「**顯示通知**」「已記一筆」

#### 步驟 7：放上桌面

捷徑 `⋯` →「加入主畫面」→ 命名「記一筆」。

---

#### 🐞 踩雷紀錄（出錯先查這裡）

- **`No API key found`**：apikey 沒帶到 → 把 apikey 接在網址尾端 `&apikey=金鑰`。
- **`missing email or phone` / validation error**：登入 body 的 email 沒送出。八成是**鍵 `email` 後面多一個空格**，或值是 iOS 建議密碼不是真密碼。用 `https://httpbin.org/post` 當網址跑一次，看 `"json"` 段就知道真正送了什麼。
- **`No key was provided to the Set Dictionary Value`**：迴圈裡 `nm`/`uid` 抓到 null。兩個原因：① 「重複執行每一項」跑錯對象（要 `AccList` 不是 `AccDict`）；② 「取得字典值」的鍵 `name`/`id` **後面有空格**（清空重打）。
- **選單跳出來是 `{"id":...}` 亂碼**：對照表沒建好，檢查迴圈那 4 個動作是否都在框框內。
- **通用除錯**：在可疑步驟後面加「**快速查看**」按 ▶️ 看那一步的結果；登入成功會看到一長串 `eyJ...`。

> ⚠️ 帳密會存在捷徑裡，僅限自己 iPhone 私用，別分享此捷徑。曾在截圖外洩密碼的話記得改密碼並同步更新捷徑。

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
