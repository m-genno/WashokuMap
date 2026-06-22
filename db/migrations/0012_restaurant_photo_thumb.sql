-- 店舗写真にもサムネイルURLを追加(口コミ写真と同じ軽量化)。
-- 管理画面からアップロードした写真は sharp で表示用(<=1600px)とサムネ(<=400px)を
-- 生成し、url=表示用 / thumb_url=サムネ を保存する。外部URL貼り付け時は thumb_url NULL。
alter table restaurant_photo
  add column if not exists thumb_url text;
