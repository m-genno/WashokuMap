-- 0005_reservations.sql
-- リクエスト型予約(在庫管理なし)と、状態遷移の監査ログ。

create table reservation (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurant(id) on delete restrict,
  user_id           uuid references app_user(id) on delete set null,  -- 匿名予約もあり得る
  status            text not null default 'requested'
                      check (status in ('requested', 'confirmed', 'declined',
                                        'counter_offer', 'cancelled', 'completed', 'no_show')),
  party_size        smallint not null check (party_size > 0),
  desired_at        timestamptz not null,                -- 第1希望日時
  desired_alt_at    timestamptz,                         -- 代替希望
  guest_name        text not null,
  guest_email       citext,
  guest_phone       text,
  guest_lang        text not null default 'en',          -- 客の言語(翻訳・返信用)
  requests          text,                                -- 自由要望(原文)
  requests_ja       text,                                -- 店舗向け日本語訳
  dietary           jsonb,                               -- アレルギー/宗教制限/ベジ等の定型項目
  budget_per_person integer,
  confirmed_at      timestamptz,
  handled_by        text,                                -- 予約デスク担当者 or 'store'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_reservation_restaurant_status on reservation (restaurant_id, status);
create index idx_reservation_user              on reservation (user_id);
create index idx_reservation_desired_at        on reservation (desired_at);

create trigger trg_reservation_updated_at
  before update on reservation
  for each row execute function set_updated_at();

-- reservation_event: 誰がいつステータスを変えたか、店舗とのやり取りを記録。
-- 人手運用のため監査性が重要。
create table reservation_event (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservation(id) on delete cascade,
  from_status    text,
  to_status      text not null,
  channel        text check (channel in ('email', 'sms', 'phone', 'fax', 'desk')),
  note           text,
  actor          text not null default 'system',         -- system / desk:担当者 / store / user
  created_at     timestamptz not null default now()
);

create index idx_reservation_event_reservation on reservation_event (reservation_id);
