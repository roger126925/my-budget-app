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
