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
| `accounts` | id, name, balance, color | 帳戶（現金、銀行等） |
| `categories` | id, name, icon, type | 分類，type = `expense` / `income` |
| `transactions` | id, account_id, category_id, amount, type, note, txn_date | 交易紀錄 |
| `budgets` | id, user_id, category_id, month, amount | 每月分類預算，unique(user_id, category_id, month) |

## 目前功能

- Email + 密碼 登入 / 註冊（Supabase Auth）
- 帳戶餘額卡片顯示（新增/編輯/刪除交易時自動更新）
- 新增 / 編輯收支（選帳戶、分類、金額、日期、備註）
- 刪除交易
- 帳戶間轉帳
- 月份篩選 — 左右箭頭切換月份，顯示該月所有記錄
- 分類統計圓餅圖 — 每月各分類支出比例（純 SVG，無外部套件）
- 預算設定 — 每月各支出分類設定預算，進度條顯示使用比例（綠/橘/紅）
- 篩選交易 — 依分類或帳戶過濾列表
- 匯出 CSV — 依目前篩選條件匯出，含 BOM 讓 Excel 正確顯示中文

## 待開發功能

### 🔴 高優先（要加第二個人之前必須先做）
- [ ] `accounts` 加 `user_id` + 開啟 RLS — 防止不同用戶看到彼此私人帳戶
- [ ] `transactions` 加 `user_id` + 開啟 RLS — 防止不同用戶看到彼此交易
- [ ] `categories` 保持全域共用（不隔離）
- [ ] 前端新增資料時帶入 `user_id`

### 🟡 中優先（RLS 完成後再做）
- [ ] 新增 `households` 表（id, name, invite_code）
- [ ] 新增 `household_members` 表（household_id, user_id）
- [ ] `accounts` 加 `household_id`（共同帳戶綁定 household）
- [ ] 共同帳戶 RLS — household 成員都看得到
- [ ] 前端：建立 household / 用邀請碼加入
- [ ] 前端：共同帳戶顯示預算、已花、剩餘金額

### 🟢 低優先（共同帳戶完成後再做）
- [ ] 共同帳戶交易標記「誰付的」
- [ ] 自動計算每人應付金額與差額
- [ ] 記住帳號及密碼（Supabase 預設已有 session 持久化，需確認是否真的需要）

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
