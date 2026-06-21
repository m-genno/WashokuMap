-- 0002_users_auth.sql
-- ユーザー(匿名/ログイン一元管理)と外部認証ID。

-- app_user: 匿名でもログインでも必ず1行を持つ。サインインで匿名行を「昇格」させる。
create table app_user (
  id              uuid primary key default gen_random_uuid(),
  anonymous_id    uuid unique,                      -- 端末発行の匿名トークン(localStorageと一致)
  is_registered   boolean not null default false,   -- OAuth連携済みなら true
  role            text not null default 'user'
                    check (role in ('user', 'staff', 'admin')),  -- 運用者ロール(管理画面用)
  display_name    text,
  email           citext,                           -- ログイン/通知用(任意)
  preferred_lang  text not null default 'en',       -- 既定表示言語(en, ja, zh-Hans ...)
  default_contact jsonb,                            -- 予約オートフィル用(氏名/電話/メール)。ログイン時のみ保持
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_app_user_updated_at
  before update on app_user
  for each row execute function set_updated_at();

-- auth_identity: 1ユーザに複数プロバイダ(Google/Apple)を紐付け可能。
create table auth_identity (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references app_user(id) on delete cascade,
  provider         text not null check (provider in ('google', 'apple')),
  provider_user_id text not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index idx_auth_identity_user on auth_identity (user_id);
