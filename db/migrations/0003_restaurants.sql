-- 0003_restaurants.sql
-- 店舗本体と付随情報(ジャンル/写真/営業時間)、CSVインポート履歴。

-- ジャンル(寿司/天ぷら/蕎麦/居酒屋/懐石 ...)
create table genre (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- 例: sushi, tempura, soba
  name_translations jsonb not null default '{}'::jsonb    -- {"ja":"寿司","en":"Sushi"}
);

-- import_batch: CSV一括投入の実行単位(失敗行の再投入・出所追跡)。restaurant より先に定義。
create table import_batch (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  uploaded_by   uuid references app_user(id) on delete set null,
  total_rows    integer not null default 0,
  success_count integer not null default 0,
  error_count   integer not null default 0,
  error_report  jsonb,                                     -- 行番号・理由のリスト
  status        text not null default 'pending'
                  check (status in ('pending', 'validating', 'completed', 'failed')),
  created_at    timestamptz not null default now()
);

-- restaurant: 店舗本体
create table restaurant (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  name_translations        jsonb not null default '{}'::jsonb,
  description              text,
  description_translations jsonb not null default '{}'::jsonb,
  address                  text,
  location                 geography(Point, 4326),         -- 緯度経度(PostGIS)
  phone                    text,
  website_url              text,
  listing_type             text not null default 'unlisted'
                             check (listing_type in ('unlisted', 'listed')),
  reservation_mode         text not null default 'request'
                             check (reservation_mode in ('request', 'external', 'phone_only')),
  reservation_url          text,
  price_range              smallint check (price_range between 1 and 4),
  rating_avg               numeric(2, 1) not null default 0,   -- 口コミ平均(キャッシュ)
  rating_count             integer not null default 0,         -- 口コミ件数(キャッシュ)
  status                   text not null default 'draft'
                             check (status in ('draft', 'published', 'closed')),
  source                   text not null default 'manual'
                             check (source in ('manual', 'csv', 'api')),
  import_batch_id          uuid references import_batch(id) on delete set null,
  search_vector            tsvector,                           -- 全文検索インデックス
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_restaurant_location     on restaurant using gist (location);
create index idx_restaurant_search       on restaurant using gin (search_vector);
create index idx_restaurant_status       on restaurant (status);

create trigger trg_restaurant_updated_at
  before update on restaurant
  for each row execute function set_updated_at();

-- search_vector を name / address / 多言語名 から自動生成。
-- 多言語対応のため 'simple' 設定(言語別ステミングをせず素直にトークン化)。
-- ジャンルでの絞り込みは restaurant_genre の join で行う。
create or replace function restaurant_search_vector_update()
returns trigger as $$
begin
  new.search_vector := to_tsvector(
    'simple',
    coalesce(new.name, '') || ' ' ||
    coalesce(new.address, '') || ' ' ||
    coalesce(
      (select string_agg(value, ' ') from jsonb_each_text(new.name_translations)),
      ''
    )
  );
  return new;
end;
$$ language plpgsql;

create trigger trg_restaurant_search_vector
  before insert or update of name, address, name_translations on restaurant
  for each row execute function restaurant_search_vector_update();

-- restaurant_genre: 店舗×ジャンル(多対多)
create table restaurant_genre (
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  genre_id      uuid not null references genre(id) on delete cascade,
  primary key (restaurant_id, genre_id)
);

create index idx_restaurant_genre_genre on restaurant_genre (genre_id);

-- restaurant_photo: 店舗写真
create table restaurant_photo (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  url           text not null,
  caption       text,
  sort_order    integer not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_restaurant_photo_restaurant on restaurant_photo (restaurant_id);

-- restaurant_hours: 営業時間(曜日×区間。昼/夜の二部営業に対応)
create table restaurant_hours (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),  -- 0=日 .. 6=土
  open_time     time not null,
  close_time    time not null,
  note          text
);

create index idx_restaurant_hours_restaurant on restaurant_hours (restaurant_id);
