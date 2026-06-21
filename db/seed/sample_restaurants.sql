-- seed/sample_restaurants.sql
-- 開発・動作確認用のサンプル店舗(本番では使わない)。再実行しても安全(固定UUID + upsert)。
-- 適用: docker exec -i washoku-db psql -U postgres -d washokumap -f - < db/seed/sample_restaurants.sql
begin;

insert into restaurant
  (id, name, name_translations, description, address, location, phone,
   listing_type, reservation_mode, reservation_url, price_range, status, source)
values
  ('11111111-1111-1111-1111-111111111111', '鮨 田中',
   '{"en":"Sushi Tanaka","zh-Hans":"寿司田中"}', 'カウンター10席の江戸前鮨。',
   '東京都渋谷区道玄坂1-2-3',
   ST_SetSRID(ST_MakePoint(139.6995, 35.6580), 4326)::geography,
   '03-1111-1111', 'unlisted', 'request', null, 4, 'published', 'manual'),

  ('22222222-2222-2222-2222-222222222222', '天ぷら 山田',
   '{"en":"Tempura Yamada"}', '揚げたてを一品ずつ供する天ぷら専門店。',
   '東京都新宿区新宿3-1-1',
   ST_SetSRID(ST_MakePoint(139.7005, 35.6905), 4326)::geography,
   '03-2222-2222', 'unlisted', 'request', null, 3, 'published', 'manual'),

  ('33333333-3333-3333-3333-333333333333', '蕎麦 鈴木',
   '{"en":"Soba Suzuki"}', '石臼挽きの十割蕎麦。',
   '東京都中央区銀座6-2-2',
   ST_SetSRID(ST_MakePoint(139.7670, 35.6710), 4326)::geography,
   '03-3333-3333', 'listed', 'external', 'https://example.com/reserve/soba-suzuki',
   2, 'published', 'manual'),

  ('44444444-4444-4444-4444-444444444444', '焼き鳥 佐藤',
   '{"en":"Yakitori Sato"}', '備長炭で焼く地鶏の串焼き。',
   '東京都台東区浅草1-1-1',
   ST_SetSRID(ST_MakePoint(139.7960, 35.7140), 4326)::geography,
   '03-4444-4444', 'unlisted', 'phone_only', null, 2, 'published', 'manual'),

  ('55555555-5555-5555-5555-555555555555', '居酒屋 ほろ酔い',
   '{"en":"Izakaya Horoyoi"}', '渋谷の路地裏にある小さな居酒屋。',
   '東京都渋谷区宇田川町2-3',
   ST_SetSRID(ST_MakePoint(139.6980, 35.6615), 4326)::geography,
   '03-5555-5555', 'unlisted', 'request', null, 2, 'published', 'manual')
on conflict (id) do update set
  name = excluded.name,
  name_translations = excluded.name_translations,
  address = excluded.address,
  location = excluded.location,
  reservation_mode = excluded.reservation_mode,
  reservation_url = excluded.reservation_url,
  price_range = excluded.price_range,
  status = excluded.status;

-- ジャンル紐付け
insert into restaurant_genre (restaurant_id, genre_id)
select m.rid::uuid, g.id
from (values
  ('11111111-1111-1111-1111-111111111111', 'sushi'),
  ('22222222-2222-2222-2222-222222222222', 'tempura'),
  ('33333333-3333-3333-3333-333333333333', 'soba'),
  ('44444444-4444-4444-4444-444444444444', 'yakitori'),
  ('55555555-5555-5555-5555-555555555555', 'izakaya')
) as m(rid, code)
join genre g on g.code = m.code
on conflict do nothing;

commit;
