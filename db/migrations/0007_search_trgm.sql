-- 0007_search_trgm.sql
-- 日本語(CJK)検索の改善。
--
-- 背景: search_vector は to_tsvector('simple', ...) で作るが、'simple' 設定は
--       日本語を語に分割できない(空白でしか切れない)。そのため「寿司」のような
--       部分一致や、店名の途中文字での検索がヒットしない。
-- 対策: pg_trgm によるトライグラム部分一致(ILIKE '%...%')を併用する。
--       全文検索(英数・空白区切り)とトライグラム部分一致(日本語の途中一致)の
--       両方で OR 検索することで、言語によらず素直にヒットさせる。

-- トライグラム拡張(標準 contrib。postgis イメージに同梱)
create extension if not exists pg_trgm;

-- 部分一致用の平文列。name / address / 多言語名 / 説明 を連結して保持。
alter table restaurant add column if not exists search_text text;

-- search_vector に加えて search_text も同じトリガで更新する。
-- description / description_translations も対象に含めるため WHEN 列も拡張。
create or replace function restaurant_search_vector_update()
returns trigger as $$
declare
  name_tr text;
  desc_tr text;
begin
  name_tr := coalesce(
    (select string_agg(value, ' ') from jsonb_each_text(new.name_translations)), '');
  desc_tr := coalesce(
    (select string_agg(value, ' ') from jsonb_each_text(new.description_translations)), '');

  new.search_vector := to_tsvector(
    'simple',
    coalesce(new.name, '') || ' ' ||
    coalesce(new.address, '') || ' ' ||
    name_tr
  );

  new.search_text :=
    coalesce(new.name, '') || ' ' ||
    coalesce(new.address, '') || ' ' ||
    name_tr || ' ' ||
    coalesce(new.description, '') || ' ' ||
    desc_tr;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_restaurant_search_vector on restaurant;
create trigger trg_restaurant_search_vector
  before insert or update of
    name, address, name_translations, description, description_translations
  on restaurant
  for each row execute function restaurant_search_vector_update();

-- 既存行の search_text を埋める(トリガを発火させる no-op 更新)。
update restaurant set name = name;

-- 部分一致(ILIKE '%...%')を高速化するトライグラム GIN インデックス。
create index if not exists idx_restaurant_search_text_trgm
  on restaurant using gin (search_text gin_trgm_ops);
