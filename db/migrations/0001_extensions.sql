-- 0001_extensions.sql
-- 必要な拡張と共通トリガ関数。
-- 対象: PostgreSQL 15+ / PostGIS

-- 地理検索(緯度経度・半径検索)
create extension if not exists postgis;

-- 大文字小文字を区別しないメール等
create extension if not exists citext;

-- updated_at を自動更新する共通トリガ関数
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;
