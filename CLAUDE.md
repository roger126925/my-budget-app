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
| `accounts` | id, user_id, household_id, name, balance, color, account_type | 帳戶，RLS 隔離（私人 or 共同帳戶），account_type: general/credit |
| `categories` | id, user_id, name, icon, type | 分類，RLS 隔離（每人各自管理） |
| `transactions` | id, user_id, account_id, category_id, amount, type, note, txn_date | 交易紀錄，RLS 隔離 |
| `budgets` | id, user_id, category_id, month, amount | 每月分類預算，unique(user_id, category_id, month) |
| `households` | id, name, invite_code, created_by, monthly_budget | 共同帳戶群組（含月預算） |
| `household_members` | household_id, user_id | 群組成員，RLS 只能看自己的記錄 |

## 頁面結構

### 主頁（記帳）
- 帳戶餘額卡片
- 記帳 / 轉帳 表單
- 月份切換 + 圓餅圖
- 篩選 + 交易列表

### 設定頁（設定）
- 預算設定
- 共同帳戶設定
- 帳戶管理
- 分類管理
- 資料管理

## 目前功能

- Email + 密碼 登入 / 註冊（Supabase Auth）
- 底部導航列 — 「記帳」/ 「設定」兩頁切換
- 帳戶餘額卡片顯示（新增/編輯/刪除交易時自動更新）
- 新增 / 編輯收支（選帳戶、分類、金額、日期、備註）
- 刪除交易
- 帳戶間轉帳
- 月份篩選 — 左右箭頭切換月份，顯示該月所有記錄
- 分類統計圓餅圖 — 每月各分類支出比例（純 SVG，無外部套件）
- 預算設定 — 每月各支出分類設定預算，進度條顯示使用比例（綠/橘/紅）（設定頁）
- 篩選交易 — 依分類或帳戶過濾列表
- 匯出 CSV — 依目前篩選條件匯出，含 BOM 讓 Excel 正確顯示中文
- 帳戶管理 UI — 新增 / 編輯（名稱、餘額、顏色、類型）/ 刪除帳戶，可切換共同 ↔ 私人（設定頁）
- 分類管理 UI — 新增 / 編輯 / 刪除分類（設定頁）
- 共同帳戶（household）— 建立群組 / 邀請碼加入 / 共同帳戶標「共」標籤 / 月預算 / 本月已花、剩餘預算、帳戶餘額摘要、進度條（設定頁）
- 資料管理 — 依月份檢視交易、單筆刪除（自動修正帳戶餘額）、清除全部交易（設定頁）

## 待開發功能

### 🔴 高優先（✅ 已完成）
- [x] `accounts` 加 `user_id` + 開啟 RLS
- [x] `transactions` 加 `user_id` + 開啟 RLS
- [x] 前端新增交易時帶入 `user_id`
- [x] 前端帳戶管理 UI（新增、編輯、刪除帳戶）

### 🔴 高優先（✅ 已完成）
- [x] `categories` 加 `user_id` + 開啟 RLS（各自管理分類）
- [x] 前端分類管理 UI（新增、編輯、刪除分類） 
- [x] 現有分類資料補上 `user_id`

### 🟡 中優先
- [x] 新增 `households` 表（id, name, invite_code）
- [x] 新增 `household_members` 表（household_id, user_id）
- [x] `accounts` 加 `household_id`（共同帳戶綁定 household）
- [x] 共同帳戶 RLS — household 成員都看得到
- [x] 前端：建立 household / 用邀請碼加入
- [x] 前端：共同帳戶顯示預算、已花、剩餘金額

### ⚠️ 已知 Bug（✅ 全部已修）
- [x] `household_members` RLS policy 造成 infinite recursion — 建立 `get_my_household_id()` SECURITY DEFINER function，重建 household_members 與 accounts 的 RLS policy
- [x] `households` 表缺少 RLS SELECT policy — 導致 `fetchHousehold` 拿不到資料，共同帳戶 checkbox 消失。修復：新增 authenticated 可讀、creator 可寫的 policy

### 🟡 中優先（✅ 已完成）
- [x] **信用卡帳戶類型**
  - SQL：`accounts` 加 `account_type` 欄位（`general` / `credit`）
  - 新增 / 編輯帳戶時可選類型（一般帳戶 / 信用卡）
  - 信用卡支出邏輯反轉：expense → balance 增加（欠款增加），付款 → balance 減少
  - 帳戶卡顯示：信用卡橘紅色「卡」標籤 + 「待繳 $X」
  - 轉帳到信用卡視為繳卡費（待繳金額減少）

### 🟡 中優先（✅ 已完成）
- [x] **信用卡分期（方案 A：installments 表）**
  - SQL：新增 `installments` 表（id, user_id, account_id, category_id, name, total_amount, monthly_amount, total_months, start_month, note）
  - 設定頁新增「分期管理」區塊：顯示每筆分期進度、剩餘金額、「本月繳款」與刪除按鈕
  - 記帳表單整合：選信用卡帳戶後自動出現「單筆 / 分期」切換
  - 選分期 → 填期數 → 即時顯示每月金額，按「建立分期」寫入 installments 表

### 🟢 低優先
- [ ] 共同帳戶交易標記「誰付的」
- [ ] 自動計算每人應付金額與差額
- [x] 記住帳號及密碼（Supabase 預設已有 session 持久化，需確認是否真的需要）
- [ ] 週期性開銷或收入
- [ ] 讓Google不要跳出要不要翻譯通知
- [ ] 常用 EMOJI 無法點擊（分類管理頁）

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
- 如果我打**更新**，請更新claude.md跟log.md
