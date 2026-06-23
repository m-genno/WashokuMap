-- seed/bulk_restaurants.sql
-- 動作確認・負荷感確認用に約200件の店舗を生成する(本番では使わない)。
-- 決定的UUID(bbbb0000-...-<連番>)+ upsert なので再実行しても安全。
-- id 接頭辞 'bbbb0000-' で識別でき、まとめて削除も可能:
--   delete from restaurant where id::text like 'bbbb0000-%';
-- (source は制約上 manual/csv/api のみ。バルク分は 'csv' を使う)
-- 適用:
--   docker exec -i washoku-db psql -U postgres -d washokumap -f - < db/seed/bulk_restaurants.sql
begin;

with
g as (
  select * from (values
    (0 ,'sushi'     ,'鮨'      ,'Sushi'),
    (1 ,'tempura'   ,'天ぷら'  ,'Tempura'),
    (2 ,'soba'      ,'蕎麦'    ,'Soba'),
    (3 ,'udon'      ,'うどん'  ,'Udon'),
    (4 ,'unagi'     ,'鰻'      ,'Unagi'),
    (5 ,'yakitori'  ,'焼き鳥'  ,'Yakitori'),
    (6 ,'tonkatsu'  ,'とんかつ','Tonkatsu'),
    (7 ,'ramen'     ,'ラーメン','Ramen'),
    (8 ,'izakaya'   ,'居酒屋'  ,'Izakaya'),
    (9 ,'kaiseki'   ,'懐石'    ,'Kaiseki'),
    (10,'teppanyaki','鉄板焼'  ,'Teppanyaki'),
    (11,'shabushabu','しゃぶしゃぶ','Shabu-shabu'),
    (12,'sukiyaki'  ,'すき焼き','Sukiyaki'),
    (13,'donburi'   ,'丼'      ,'Donburi'),
    (14,'washoku'   ,'和食'    ,'Washoku')
  ) as t(idx, code, ja, en)
),
s as (
  select * from (values
    (0,'田中','Tanaka'),(1,'佐藤','Sato'),(2,'鈴木','Suzuki'),(3,'高橋','Takahashi'),
    (4,'渡辺','Watanabe'),(5,'伊藤','Ito'),(6,'山本','Yamamoto'),(7,'中村','Nakamura'),
    (8,'小林','Kobayashi'),(9,'加藤','Kato')
  ) as t(idx, ja, en)
),
nums as (select generate_series(1, 200) as n)
insert into restaurant
  (id, name, name_translations, description, address, location, phone,
   listing_type, reservation_mode, reservation_url, price_range, status, source)
select
  ('bbbb0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  g.ja || ' ' || s.ja || ' ' || n::text || '号店',
  jsonb_build_object('en', g.en || ' ' || s.en || ' #' || n::text),
  g.ja || 'を中心に旬の和食を供する店(サンプル' || n::text || ')。',
  '東京都'
    || (array['千代田区','中央区','港区','新宿区','渋谷区','台東区','文京区','目黒区'])[1 + (n % 8)]
    || (1 + (n % 5))::text || '-' || (1 + (n % 9))::text || '-' || (1 + (n % 20))::text,
  ST_SetSRID(
    ST_MakePoint(
      139.70 + ((n * 37) % 120) / 1000.0,
      35.65  + ((n * 53) % 120) / 1000.0
    ), 4326)::geography,
  '03-' || lpad((1000 + n)::text, 4, '0') || '-' || lpad(((n * 7) % 10000)::text, 4, '0'),
  case when (n % 3) = 1 then 'listed' else 'unlisted' end,
  (array['request','external','phone_only'])[1 + (n % 3)],
  case when (n % 3) = 1 then 'https://example.com/reserve/bulk-' || n::text else null end,
  1 + (n % 4),
  -- 状態はジャンル(n%15)と独立にするため n%7 で決める(published寄り)。
  (array['published','published','published','published','draft','draft','closed'])[1 + (n % 7)],
  'csv'
from nums
join g on g.idx = (n % 15)
join s on s.idx = (n % 10)
on conflict (id) do update set
  name              = excluded.name,
  name_translations = excluded.name_translations,
  description       = excluded.description,
  address           = excluded.address,
  location          = excluded.location,
  phone             = excluded.phone,
  listing_type      = excluded.listing_type,
  reservation_mode  = excluded.reservation_mode,
  reservation_url   = excluded.reservation_url,
  price_range       = excluded.price_range,
  status            = excluded.status,
  source            = excluded.source;

-- ジャンル紐付け(店名と同じく連番 n に対応するコードを1件)。
insert into restaurant_genre (restaurant_id, genre_id)
select r.id, gg.id
from restaurant r
cross join lateral (select (right(r.id::text, 12))::int as n) x
join genre gg
  on gg.code = (array['sushi','tempura','soba','udon','unagi','yakitori','tonkatsu',
                      'ramen','izakaya','kaiseki','teppanyaki','shabushabu','sukiyaki',
                      'donburi','washoku'])[1 + (x.n % 15)]
where r.id::text like 'bbbb0000-%'
on conflict do nothing;

commit;
