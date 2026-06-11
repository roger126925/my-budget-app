-- 2026-06-11 新功能 migration
-- 請在 Supabase Dashboard → SQL Editor 貼上執行一次
-- 內容：信用卡繳款截止日欄位、週期性消費表、快速記帳範本表

-- 1. 信用卡繳款截止日（繳款提醒用）
alter table accounts add column if not exists payment_due_day int;

-- 2. 週期性消費（每月自動建立交易）
create table if not exists recurrings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  amount numeric not null,
  type text not null default 'expense',
  note text default '',
  day_of_month int not null,
  last_added_month text,
  created_at timestamptz default now()
);
alter table recurrings enable row level security;
create policy "own recurrings" on recurrings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. 快速記帳範本（一鍵帶入常用消費）
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  account_id uuid references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  amount numeric,
  type text default 'expense',
  note text default '',
  created_at timestamptz default now()
);
alter table templates enable row level security;
create policy "own templates" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
