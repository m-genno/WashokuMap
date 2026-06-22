-- 口コミに添付する写真。アップロードしたファイルは別ストレージ(ローカル等)に
-- 保存し、ここには参照URL(/api/uploads/<name>)を持つ。口コミ削除/非表示の
-- 連動は review への FK(on delete cascade)で担保。
create table if not exists review_photo (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references review(id) on delete cascade,
  url         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_review_photo_review on review_photo (review_id);
