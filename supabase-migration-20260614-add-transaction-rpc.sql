-- 桌面快速記帳（3）— iOS 捷徑 / 外部 API 用的記帳 RPC
-- 在 Supabase Dashboard → SQL Editor 執行一次。
--
-- 用途：讓 iOS「捷徑」App（或任何外部呼叫）透過單一 API 端點記一筆交易，
--       並在同一個資料庫交易內自動更新帳戶餘額，避免餘額不同步。
--
-- 餘額邏輯與前端 Budget.jsx handleSubmit 完全一致：
--   一般帳戶：expense -> balance - amount；income -> balance + amount
--   信用卡  ：expense -> balance + amount（待繳增加）；income -> balance - amount（繳費）
--
-- 呼叫方式（PostgREST）：
--   POST {SUPABASE_URL}/rest/v1/rpc/add_transaction
--   Header: apikey: <publishable key>
--           Authorization: Bearer <使用者 access_token>
--           Content-Type: application/json
--   Body:   { "p_account_id": "...", "p_category_id": "...",
--             "p_amount": 120, "p_type": "expense",
--             "p_note": "午餐", "p_txn_date": "2026-06-14" }

create or replace function add_transaction(
  p_account_id  uuid,
  p_category_id uuid,
  p_amount      numeric,
  p_type        text,
  p_note        text default '',
  p_txn_date    date default current_date
)
returns uuid
language plpgsql
security invoker          -- 沿用呼叫者 JWT，RLS 照常生效，只能動自己的資料
as $$
declare
  v_is_credit boolean;
  v_delta     numeric;
  v_txn_id    uuid;
begin
  if p_type not in ('expense', 'income') then
    raise exception 'p_type 必須是 expense 或 income';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount 必須大於 0';
  end if;

  -- 取得帳戶類型（RLS 確保只能讀到自己的帳戶）
  select account_type = 'credit' into v_is_credit
  from accounts where id = p_account_id;

  if v_is_credit is null then
    raise exception '找不到帳戶或無權限存取';
  end if;

  -- 插入交易（user_id 取 JWT 中的 auth.uid()，符合 RLS）
  insert into transactions (user_id, account_id, category_id, amount, type, note, txn_date)
  values (auth.uid(), p_account_id, p_category_id, p_amount, p_type, p_note, p_txn_date)
  returning id into v_txn_id;

  -- 計算餘額變化
  if v_is_credit then
    v_delta := case when p_type = 'expense' then  p_amount else -p_amount end;
  else
    v_delta := case when p_type = 'expense' then -p_amount else  p_amount end;
  end if;

  update accounts set balance = balance + v_delta where id = p_account_id;

  return v_txn_id;
end;
$$;
