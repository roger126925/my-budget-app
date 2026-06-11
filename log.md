# 開發日誌

## 2026-06-07

### 新增功能
- 月份篩選：左右箭頭切換月份，取代原本固定顯示最近 20 筆
- 分類統計圓餅圖：每月各分類支出比例，純 SVG 實作
- 帳戶餘額自動更新：新增 / 編輯 / 刪除交易時自動加減帳戶餘額
- 編輯交易：點 ✎ 填回表單，按「更新」，帳戶餘額自動修正
- 帳戶間轉帳：切換到「轉帳」頁籤，選來源 / 目標帳戶與金額
- 預算設定：每月各支出分類設定預算上限，進度條顯示使用比例（綠 < 80% / 橘 80–100% / 紅超出）
- 篩選交易：依分類或帳戶過濾交易列表
- 匯出 CSV：依目前篩選條件匯出，含 BOM 讓 Excel 正確顯示中文

---

## 2026-06-07（部署）

### 部署到 Vercel
- 建立獨立 GitHub repo：`roger126925/my-budget-app`
- 連接 Vercel，自動偵測 Vite，設定環境變數後部署成功
- 網站可在手機與電腦透過 `xxx.vercel.app` 存取

---

## 2026-06-07（續）

### 手機版 UI 優化
- 新增 `Budget.css`，將靜態版面配置從 inline style 移至 CSS class
- 加入 `@media (max-width: 520px)` 響應式斷點：
  - 容器邊距縮減、填滿螢幕
  - 帳戶餘額卡片縮小 padding
  - 圓餅圖在手機改為垂直排列
  - 篩選列改為垂直堆疊
- 交易列表加入 `text-overflow: ellipsis` 防止長文字爆版

---

### 新增資料表
- `budgets`：每月分類預算，欄位 id / user_id / category_id / month / amount，unique(user_id, category_id, month)，啟用 RLS

---

## 2026-06-07（多用戶隔離）

### RLS 私人資料隔離
- `accounts` 新增 `user_id` 欄位，開啟 RLS，Policy：`auth.uid() = user_id`
- `transactions` 新增 `user_id` 欄位，開啟 RLS，Policy：`auth.uid() = user_id`
- `categories` 維持全域共用，不加 RLS
- 前端 `handleSubmit()` 新增交易時帶入 `user_id: session.user.id`
- 現有資料透過 SQL UPDATE 補上 user_id，確保原有記錄不遺失

---

## 2026-06-07（帳戶管理 UI）

### 新增帳戶管理功能
- 前端新增「帳戶管理」收合區塊（展開後可操作）
- 支援新增帳戶：填名稱、初始餘額、選顏色（8 色）
- 支援編輯帳戶：修改名稱與顏色（inline 編輯）
- 支援刪除帳戶（確認彈窗）
- 新增帳戶時帶入 `user_id: session.user.id`，符合 RLS 規則

### 決策記錄
- `categories` 改為各用戶各自管理（不再全域共用），待實作

---

## 2026-06-07（分類管理 + 共同帳戶）

### 分類管理 UI
- `categories` 加 `user_id` + 開啟 RLS（各自管理）
- 前端新增「分類管理」收合區塊：支援新增 / 編輯 / 刪除分類
- 現有分類透過 SQL UPDATE 補上 user_id

### 共同帳戶（household）
- 新增 `households` 表（id, name, invite_code, created_by）
- 新增 `household_members` 表（household_id, user_id）
- `accounts` 新增 `household_id` 欄位
- RLS 更新：accounts 可透過 household_id 讓成員共用
- 前端新增「共同帳戶設定」區塊：建立群組（自動產生 6 碼邀請碼）/ 輸入邀請碼加入
- 新增帳戶時可勾選「設為共同帳戶」（需已加入 household）
- 共同帳戶卡片顯示藍色「共」標籤

## 2026-06-07（信用卡帳戶類型）

### 新功能：信用卡支援
- SQL：`accounts` 表新增 `account_type text DEFAULT 'general'`（`general` / `credit`）
- 新增 / 編輯帳戶加入「一般帳戶 / 信用卡」切換按鈕
- 信用卡餘額邏輯反轉：支出 → 待繳增加，退款/收入 → 待繳減少
- 轉帳到信用卡 → 視為繳卡費（待繳金額減少，而非增加）
- 刪除信用卡交易時，餘額回復邏輯同樣反轉
- 帳戶卡：信用卡顯示橘紅色「卡」標籤 + 「待繳」標籤，顏色固定為 #D85A30

---

### Bug 修復
- `household_members` RLS policy infinite recursion：建立 `get_my_household_id()` SECURITY DEFINER function，重建 household_members（簡單 `user_id = auth.uid()`）與 accounts 的 RLS policy（改用 function 查 household）
- `households` 表缺少 RLS policy：新增 SELECT（authenticated 皆可讀，供邀請碼查詢）、INSERT（created_by = auth.uid()）、UPDATE（creator 或成員可改月預算）

---

## 2026-06-07（共同帳戶預算摘要）

### 新增功能
- `households` 表新增 `monthly_budget` 欄位（`ALTER TABLE households ADD COLUMN IF NOT EXISTS monthly_budget numeric DEFAULT 0`）
- 共同帳戶設定展開後新增摘要卡：
  - 月預算輸入（失去焦點自動儲存至 households 表）
  - 本月已花：當月記帳到共同帳戶的支出加總
  - 剩餘預算：月預算 − 已花（超出顯示紅色警示）
  - 帳戶餘額：所有共同帳戶現有餘額加總
  - 進度條（綠 < 80% / 橘 80–100% / 紅超出）
  - 本月收入加總（有收入才顯示）

---

## 2026-06-07（UI 頁面分離）

### 底部導航 + 頁面拆分
- 新增底部固定導航列（記帳 / 設定），目前頁籤為紫色粗體
- 主頁只留：帳戶餘額卡片、記帳/轉帳表單、月份切換、圓餅圖、篩選、交易列表
- 設定頁包含：預算設定、共同帳戶設定、帳戶管理、分類管理
- container 加 `paddingBottom: 72px` 防止內容被底部導航遮住

### 帳戶編輯改進
- 編輯帳戶（✎）時，若已加入 household，顯示「設為共同帳戶」checkbox
- 勾選後儲存：`user_id` 設 null、`household_id` 設為當前 household（帳戶卡顯示「共」標籤）
- 取消勾選後儲存：`user_id` 改回自己、`household_id` 設 null（回到私人帳戶）
- 新增帳戶時若無 household，顯示提示文字引導用戶先建立群組

---

## 2026-06-07（資料管理）

### 帳戶餘額編輯
- 帳戶編輯表單新增「帳戶餘額」輸入欄，可直接修正錯誤的餘額數字
- `startEditAccount` 帶入現有餘額；`handleUpdateAccount` 儲存時更新 balance 欄位

### 資料管理區塊（設定頁最下方）
- 月份選擇器（input type=month），切換後自動載入該月交易
- 逐筆刪除：刪除單筆交易並自動反向修正帳戶餘額
- 清除全部交易記錄：需二次 confirm，清空後帳戶餘額需手動修正

---

## 2026-06-07（分期整合）

### 信用卡分期整合進記帳表單
- 選信用卡帳戶時，自動出現「單筆 / 分期」切換按鈕
- 選「單筆」：原有流程不變
- 選「分期」：
  - 金額欄改為「總金額」
  - 新增「期數」輸入欄
  - 即時預覽每月金額（總金額 / 期數）與首期出帳月份
  - 備註欄改為「名稱」（作為分期計畫名稱）
  - 按「建立分期」→ 寫入 installments 表（不建立交易）
- 切換帳戶時自動重置為單筆模式
- 設定頁分期管理中可用「本月繳款」逐月記帳

---

## 2026-06-07（出帳日 + 分期管理簡化）

### 信用卡出帳日（billing_day）
- SQL：`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_day integer`
- 帳戶管理 UI：新增/編輯信用卡時顯示「出帳日（每月幾號）」輸入欄
- 建立分期時自動計算 `start_month`：
  - 刷卡日 ≤ 出帳日 → 本月帳單
  - 刷卡日 > 出帳日 → 下月帳單
  - 無出帳日時預設本月
- 分期預覽欄即時顯示首期出帳月份

### 分期管理簡化
- 移除設定頁「新增分期」表單（建立分期已整合至記帳表單）
- 保留：進度追蹤、本月繳款、刪除
- 空清單提示「可在記帳頁選信用卡帳戶後建立」

---

## 2026-06-08（Bug 修復）

### Bug 修復：建立分期後信用卡待繳金額未更新
- 位置：`Budget.jsx` `handleSubmit()` 分期路徑
- 問題：`installments.insert` 成功後未呼叫 `accounts.update`，待繳金額不動
- 修法：insert 成功後將 `total_amount` 加進信用卡 balance，並呼叫 `fetchAccountsAndCategories()`

### Bug 修復：calcStartMonth 邊界條件（出帳日當天歸屬）
- 位置：`Budget.jsx` `calcStartMonth()`
- 問題：條件 `day <= billingDay` 在刷卡日等於出帳日時仍歸到本月
- 修法：改為 `day < billingDay`，刷卡日 ≥ 出帳日時一律推到下個月

### Bug 修復：本月繳款讓待繳金額反而增加
- 位置：`Budget.jsx` `handlePayInstallment()`
- 問題：信用卡繳款用 `balance + monthly_amount`（方向錯誤），越繳待繳越多；且 transaction type 為 `'expense'`，刪除時餘額回復方向也跟著錯
- 修法：改為 `balance - monthly_amount`，transaction type 改為 `'income'`（信用卡 income = 減少待繳，刪除時方向一致正確）
- 分期待繳邏輯整理：建立分期 → 待繳 +total_amount；本月繳款 → 待繳 −monthly_amount；刪除繳款紀錄 → 待繳 +monthly_amount（自動）

---

## 2026-06-08（信用卡獨立頁籤）

### 新功能：信用卡頁面（第一版）
- 底部導航新增「信用卡」頁籤，共三頁：記帳 / 信用卡 / 設定；信用卡頁籤以橘紅色 highlight
- 記帳頁帳戶卡片改為只顯示一般帳戶（`generalAccounts`），信用卡帳戶移至信用卡頁
- 信用卡頁內容：
  - 月份切換（與記帳頁共用 `selectedMonth`）
  - 各信用卡帳戶卡片（顯示待繳金額）
  - 本月摘要雙格：本月刷卡支出（credit 帳戶 expense 合計）/ 本月應繳分期款（進行中分期 monthly_amount 加總）
  - 所有分期計畫進度列表 + 本月繳款按鈕
- 設定頁移除分期管理區塊（已整合至信用卡頁）

### 新功能：信用卡頁面（完善）
- 信用卡頁新增「刷卡記帳」表單：僅顯示信用卡帳戶、固定支出類型（信用卡無收入）、單筆/分期切換與預覽
- 記帳頁表單帳戶選單改為只顯示一般帳戶（`generalAccounts`），移除信用卡/分期相關 UI
- 信用卡帳戶管理保留於設定頁，不在信用卡頁重複
- 分期提示文字更新：改為引導使用者在「刷卡記帳」選分期

---

## 2026-06-09（分期待繳重構）

### Supabase 資料表異動
- `installments` 新增兩欄：
  - `last_added_month text`：上次 auto-add 到哪個月（NULL 代表舊資料）
  - `pending_amount numeric DEFAULT 0`：已自動加入待繳但尚未結清的金額
- SQL：`ALTER TABLE installments ADD COLUMN IF NOT EXISTS last_added_month text, ADD COLUMN IF NOT EXISTS pending_amount numeric DEFAULT 0;`

### Bug 修復：從中間期數開始記帳仍顯示總額
- 問題根源：舊程式碼建立分期時直接把 `total_amount` 加進信用卡 balance；對於歷史分期（start_month 在過去），使用者已在現實中繳過前面幾期，但 app 仍顯示全額
- 第一版修法（2026-06-09）：建立時只加「剩餘期數金額」（`outstandingAmount`）—— 已廢棄，被以下設計取代

### 新功能：分期 auto-add + 已結清

**設計概念**
- 建立分期時完全不動 balance；`last_added_month = currentMonth - 1`（本月前一個月）
- 每次開 App（`fetchInstallments`）自動執行 `autoAddInstallmentCharges`：
  - 從 `last_added_month + 1` 到當前月份，逐月判斷是否在分期範圍內（`elapsed >= 0 && elapsed < total_months`），符合則將當月金額加進 `pending_amount` 和 `account.balance`
  - 只加**本月及之後**的期數；之前的月份假設使用者已在現實中繳過，不重複加
- 「已結清」按鈕：一次清掉所有 `pending_amount`（建立 income 交易 + balance -= pending_amount + pending_amount = 0）

**舊資料遷移（`last_added_month == null`）**
- 查出該分期名稱對應的舊繳款交易（note 含「分期款」或「結清」），計算 `paidSum`
- 將 `total_amount - paidSum`（舊程式碼淨貢獻）從 balance 扣除
- 設 `last_added_month = currentMonth - 1`、`pending_amount = 0`，後續 auto-add 補上本月

**UI 變化**
- 分期卡片：移除「本月繳款」，改為橘紅色「已結清・待繳 $X」（僅 `pending_amount > 0` 時顯示）
- 信用卡頁摘要：「本月應繳分期款」改為「分期總待結清」（`totalPending`，有待繳時橘紅）

---

## 2026-06-10（Bug 修復：auto-add 邏輯修正）

### Bug 修復：auto-add 仍將所有歷史期數加入待繳
- 問題：`initLastAdded` 設為 `startMonth - 1`，導致 auto-add 從 startMonth 跑到現在，把所有歷史期數一次全部加進 balance
- 修法：`initLastAdded = currentMonth - 1`，確保只從本月起算，過去期數不重加

### Bug 修復：舊資料遷移 balance 不準確
- 問題：舊資料遷移只用時間推算 `pending_amount = remaining * monthly`，但 balance 是舊程式碼加的 `total_amount`，兩者對不上，「已結清」後 balance 仍有殘值
- 修法：遷移時查出舊繳款交易算 `paidSum`，將 `total_amount - paidSum` 從 balance 扣除，再由 auto-add 補上本月金額；migration 與 auto-add 同一迴圈執行，不需第二次 fetch

---

## 2026-06-11（Bug 修復：信用卡帳單週期；新功能批次）

### Bug 修復：「本月帳單」未依出帳日切分
- 問題：`cardStatement` 的單筆部分直接加總日曆月刷卡支出，未套用 `billing_day`；前月出帳日後的消費應屬當月帳單卻被算在前月
- 修法：`fetchTransactions` 額外抓上個月的刷卡交易（`prevMonthTxns`）；`cardStatement` 改以帳單週期計算：上月出帳日（含）後 + 本月出帳日前，與 `calcStartMonth` 同標準；無出帳日維持日曆月。信用卡卡片標題改顯示週期範圍（例：本月帳單（5/15～6/14））

### Supabase 資料表異動（需執行 supabase-migration-20260611.sql）
- `accounts` 新增 `payment_due_day integer`（信用卡繳款截止日，繳款提醒用）
- 新增 `recurrings` 表：id, user_id, account_id, category_id, amount, type, note, day_of_month, last_added_month；RLS 啟用
- 新增 `templates` 表：id, user_id, name, account_id, category_id, amount, type, note；RLS 啟用

### 新功能：信用卡繳款提醒
- 帳戶管理的信用卡表單新增「繳款截止日」輸入欄（`payment_due_day`）
- 帳戶有 `payment_due_day` 且待繳金額 > 0、7 天內到期時，記帳主頁與信用卡頁頂部顯示提醒橫幅；剩 2 天內以紅色顯示，含卡名、繳款日、倒數天數、待繳金額

### 新功能：交易搜尋
- 主頁月份切換下方新增關鍵字搜尋框，比對備註、分類名、帳戶名
- 搜尋與現有分類/帳戶篩選組合使用；匯出 CSV 連動（依目前搜尋+篩選結果匯出）

### 新功能：快速記帳範本
- 記帳表單右下角新增「存範本」按鈕（需先填好帳戶/分類/金額），點後跳出命名視窗
- 已儲存範本以紫色 chips 顯示在表單上方，點一下帶入帳戶/分類/金額/備註，chips 的 × 刪除範本
- 範本資料存在 `templates` 表

### 新功能：週期性消費
- 設定頁新增「週期性消費」管理區塊（帳戶、分類、金額、每月幾號、備註）
- 每次開 App 執行 `autoAddRecurringTxns`：從 `last_added_month + 1` 起逐月，日子已到（含今天）就補建交易並調整餘額；信用卡帳戶會加到待繳
- 刪除週期設定不影響已建立的交易

### 新功能：年度統計
- 設定頁新增「年度統計」區塊，年份左右切換，純 SVG 雙色長條圖（紅=支出、綠=收入）顯示 12 個月趨勢，下方列年支出/收入/結餘

### 新功能：匯入 CSV
- 資料管理頁新增「匯入 CSV」按鈕，格式同匯出（日期,類型,帳戶,分類,金額,備註）
- 依帳戶名稱、分類名稱對應現有資料；無法對應的列略過並告知筆數；匯入前確認視窗，匯入後自動調整餘額

### 新功能：完整備份 / 還原
- 資料管理頁新增「匯出完整備份（JSON）」與「還原備份（JSON）」
- 備份包含 accounts、categories、transactions、budgets、installments、recurrings、templates 全部 7 張表
- 還原採「新增」方式（id 重新對應），共同帳戶轉為私人；不覆蓋現有資料
