-- 口コミ写真にサムネイルURLを追加。
-- アップロード時にサーバ(sharp)で表示用(<=1600px)とサムネ(<=400px)を生成し、
-- url=表示用 / thumb_url=サムネ を保存する。既存行は thumb_url NULL(url で代替表示)。
alter table review_photo
  add column if not exists thumb_url text;
