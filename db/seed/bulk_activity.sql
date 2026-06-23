-- seed/bulk_activity.sql
-- bulk_restaurants.sql の後に実行する、関連データ(ユーザ/口コミ/予約/通報/営業時間)の
-- 多様なテストデータ。再実行しても安全(決定的ID + on conflict / NOT EXISTS ガード)。
-- 適用:
--   docker exec -i washoku-db psql -U postgres -d washokumap -f - < db/seed/bulk_activity.sql
-- 削除(関連はFK cascade / set null):
--   delete from app_user   where id::text like 'cccc0000-%';
--   delete from reservation where id::text like 'dddd0000-%';
begin;

-- 1) 匿名ユーザ 50人(口コミ・予約の紐付け用)。
insert into app_user (id, anonymous_id, preferred_lang)
select
  ('cccc0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('cccc0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  (array['en','ja','zh-Hans','zh-Hant','ko'])[1 + (n % 5)]
from generate_series(1, 50) n
on conflict (id) do nothing;

-- 2) 口コミ。公開中のバルク店舗に、店ごとに 1〜4 件を別ユーザから付与。
--    件数・言語・評価は公開判定(rn%5)と独立にばらけさせ、全5言語+和訳を混在、
--    一部は hidden。lang は (rn*3+j)%5 で 5言語へ均等に分散。
insert into review
  (restaurant_id, user_id, rating, body, body_lang, body_translations, status)
select
  r.id,
  u.id,
  1 + ((r.rn * 2 + j) % 5),
  (array[
    'Fresh and delicate, highly recommended.',
    'とても美味しかったです。また来ます。',
    '非常好吃，服务也很周到。',
    '맛있고 분위기도 좋았어요.',
    '食材新鮮，值得再訪。'
  ])[1 + ((r.rn * 3 + j) % 5)] || ' (#' || r.rn::text || '-' || j::text || ')',
  (array['en','ja','zh-Hans','ko','zh-Hant'])[1 + ((r.rn * 3 + j) % 5)],
  case
    when (array['en','ja','zh-Hans','ko','zh-Hant'])[1 + ((r.rn * 3 + j) % 5)] = 'ja'
    then '{}'::jsonb
    else jsonb_build_object('ja', '（和訳サンプル）とても良いお店でした。')
  end,
  case when (r.rn + j) % 11 = 0 then 'hidden' else 'published' end
from (
  select id, right(id::text, 12)::int as rn
  from restaurant
  where id::text like 'bbbb0000-%' and status = 'published'
) r
cross join generate_series(0, 3) j
join app_user u
  on u.id = ('cccc0000-0000-4000-8000-'
             || lpad((((r.rn + j) % 50) + 1)::text, 12, '0'))::uuid
where j <= (r.rn % 4)
on conflict (restaurant_id, user_id) do nothing;

-- 3) 予約 100件。全ステータス・多言語・過去/未来日時・人数・食事制限を混在。
insert into reservation
  (id, restaurant_id, user_id, status, party_size, desired_at, desired_alt_at,
   guest_name, guest_email, guest_phone, guest_lang, requests, requests_ja,
   dietary, budget_per_person)
select
  ('dddd0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  r.id,
  u.id,
  (array['requested','confirmed','completed','declined',
         'counter_offer','cancelled','no_show'])[1 + (n % 7)],
  1 + (n % 8),
  now() + ((n % 60) - 30) * interval '1 day' + (n % 24) * interval '1 hour',
  case when n % 4 = 0
       then now() + ((n % 60) - 25) * interval '1 day' else null end,
  (array['Guest','ゲスト','客人','손님','訪客'])[1 + (n % 5)] || ' ' || n::text,
  ('guest' || n::text || '@example.com')::citext,
  '090-' || lpad((1000 + n)::text, 4, '0') || '-' || lpad(((n * 3) % 10000)::text, 4, '0'),
  (array['en','ja','zh-Hans','ko','zh-Hant'])[1 + (n % 5)],
  case when n % 3 = 0 then 'Window seat please / quiet table' else null end,
  case when n % 3 = 0 then '窓際の静かな席を希望' else null end,
  case
    when n % 5 = 0 then jsonb_build_object('vegetarian', true,
                          'allergies', jsonb_build_array('shrimp','soba'))
    when n % 5 = 2 then jsonb_build_object('halal', true)
    else null
  end,
  case when n % 2 = 0 then 3000 + (n % 5) * 1500 else null end
from generate_series(1, 100) n
join (
  select id, row_number() over (order by id) as rk
  from restaurant where id::text like 'bbbb0000-%'
) r on r.rk = 1 + (n % 200)
join app_user u
  on u.id = ('cccc0000-0000-4000-8000-'
             || lpad(((n % 50) + 1)::text, 12, '0'))::uuid
on conflict (id) do nothing;

-- 4) 通報。低評価(<=2)の公開口コミにモデレーション用の通報を付与(未通報のみ)。
insert into review_report (review_id, reporter_user_id, reason)
select
  rv.id,
  null,
  (array['不適切な表現がある','事実と異なる','スパムの疑い'])[1 + (rv.rating % 3)]
from review rv
where rv.status = 'published'
  and rv.rating <= 2
  and not exists (select 1 from review_report rr where rr.review_id = rv.id);

-- 5) 営業時間。バルク店舗の一部(rn%4=0)に平日(月〜金)の昼/夜を付与(未登録のみ)。
insert into restaurant_hours (restaurant_id, day_of_week, open_time, close_time, note)
select r.id, d.dow, t.ot, t.ct, t.note
from (
  select id, right(id::text, 12)::int as rn
  from restaurant
  where id::text like 'bbbb0000-%' and right(id::text, 12)::int % 4 = 0
) r
cross join (select generate_series(1, 5) as dow) d
cross join (values
  (time '11:30', time '14:00', 'ランチ L.O.13:30'),
  (time '17:30', time '22:00', 'ディナー L.O.21:30')
) as t(ot, ct, note)
where not exists (
  select 1 from restaurant_hours h where h.restaurant_id = r.id
);

commit;
