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
| `accounts` | id, user_id, household_id, name, balance, color, account_type, billing_day | 帳戶，RLS 隔離（私人 or 共同）；account_type: general/credit；billing_day: 信用卡每月出帳日 |
| `categories` | id, user_id, name, icon, type | 分類，RLS 隔離（每人各自管理） |
| `transactions` | id, user_id, account_id, category_id, amount, type, note, txn_date | 交易紀錄，RLS 隔離 |
| `budgets` | id, user_id, category_id, month, amount | 每月分類預算，unique(user_id, category_id, month) |
| `households` | id, name, invite_code, created_by, monthly_budget | 共同帳戶群組（含月預算） |
| `household_members` | household_id, user_id | 群組成員，RLS 只能看自己的記錄 |
| `installments` | id, user_id, account_id, category_id, name, total_amount, monthly_amount, total_months, start_month, note | 信用卡分期計畫 |

## 頁面結構

### 主頁（記帳）
- 帳戶餘額卡片
- 記帳 / 轉帳 表單（選信用卡帳戶後可切換單筆 / 分期）
- 月份切換 + 圓餅圖
- 篩選 + 交易列表

### 設定頁（設定）
- 預算設定
- 共同帳戶設定
- 帳戶管理
- 分類管理
- 分期管理
- 資料管理

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
- 信用卡分期 — 記帳表單選信用卡後切換單筆 / 分期，依出帳日自動計算首期月份；信用卡頁追蹤進度、本月繳款、刪除
- 信用卡獨立頁籤 — 刷卡記帳表單（固定支出、單筆/分期）、信用卡帳戶卡片、本月刷卡支出、本月應繳分期款合計、分期進度列表

## 待開發

- [ ] 共同帳戶交易標記「誰付的」+ 自動計算每人應付金額
- [ ] 週期性收支（固定每月自動建立交易）
- [ ] 常用 EMOJI 無法點擊（分類管理頁）
- [ ] 抑制 Google 翻譯彈出通知
- [ ] 可調色盤
- [ ] 週期性消費

## 已知 Bug

- [x] **分期建立後信用卡待繳未更新**：`handleSubmit()` 補上 `accounts.update`，建立分期後待繳 +total_amount（已修復）
- [x] **calcStartMonth 邊界條件**：`day <= billingDay` 改為 `day < billingDay`，刷卡日等於出帳日時正確推入下個月（已修復）
- [x] **本月繳款待繳反增**：`handlePayInstallment()` 改為 `balance - monthly_amount`，type 改為 `'income'`，繳款後待繳正確減少（已修復）

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
