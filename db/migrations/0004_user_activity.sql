-- 0004_user_activity.sql
-- ユーザー行動データ(お気に入り/検索履歴)。
-- 匿名時はクライアントの localStorage が主、ログイン時にサーバへ同期/マージ。

create table favorite (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index idx_favorite_restaurant on favorite (restaurant_id);

create table search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  query       text not null,
  filters     jsonb,                                  -- ジャンル/価格/位置などの絞り込み
  searched_at timestamptz not null default now()
);

-- 最近の履歴を引きやすいよう (user_id, searched_at desc) で索引。
-- 保持期間に上限を設ける運用を想定(例: 直近50件/90日)。
create index idx_search_history_user on search_history (user_id, searched_at desc);
