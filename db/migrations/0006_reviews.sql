-- 0006_reviews.sql
-- 口コミ・評価と通報、店舗の評価キャッシュ列を維持するトリガ。
-- 投稿資格(当該店で予約実績がある=confirmed/completed)はアプリ層で検証する。

create table review (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurant(id) on delete cascade,
  user_id           uuid not null references app_user(id) on delete cascade,
  reservation_id    uuid references reservation(id) on delete set null,  -- 予約実績との紐付け(任意)
  rating            smallint not null check (rating between 1 and 5),
  body              text,                                -- 本文(原文)
  body_lang         text not null default 'en',          -- 投稿言語
  body_translations jsonb not null default '{}'::jsonb,  -- オンデマンド翻訳キャッシュ
  status            text not null default 'published'
                      check (status in ('published', 'pending', 'hidden', 'reported')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, user_id)                        -- 1ユーザ1店舗1件(編集は更新)
);

create index idx_review_restaurant_status on review (restaurant_id, status);

create trigger trg_review_updated_at
  before update on review
  for each row execute function set_updated_at();

-- review_report: モデレーション用の通報
create table review_report (
  id               uuid primary key default gen_random_uuid(),
  review_id        uuid not null references review(id) on delete cascade,
  reporter_user_id uuid references app_user(id) on delete set null,
  reason           text not null,
  created_at       timestamptz not null default now()
);

create index idx_review_report_review on review_report (review_id);

-- 評価キャッシュ(restaurant.rating_avg / rating_count)を published の口コミから再計算。
create or replace function review_rating_recalc()
returns trigger as $$
declare
  target_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
begin
  update restaurant r
  set rating_count = sub.cnt,
      rating_avg   = coalesce(sub.avg, 0)
  from (
    select count(*)                         as cnt,
           round(avg(rating)::numeric, 1)   as avg
    from review
    where restaurant_id = target_id
      and status = 'published'
  ) sub
  where r.id = target_id;
  return null;
end;
$$ language plpgsql;

create trigger trg_review_rating
  after insert or update or delete on review
  for each row execute function review_rating_recalc();
