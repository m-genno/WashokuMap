-- seed/genres.sql
-- 和食の代表的ジャンル。再実行しても安全なよう upsert。
insert into genre (code, name_translations) values
  ('sushi',     '{"ja":"寿司","en":"Sushi","zh-Hans":"寿司","ko":"스시"}'),
  ('tempura',   '{"ja":"天ぷら","en":"Tempura","zh-Hans":"天妇罗","ko":"덴푸라"}'),
  ('soba',      '{"ja":"蕎麦","en":"Soba","zh-Hans":"荞麦面","ko":"소바"}'),
  ('udon',      '{"ja":"うどん","en":"Udon","zh-Hans":"乌冬面","ko":"우동"}'),
  ('unagi',     '{"ja":"うなぎ","en":"Unagi (Eel)","zh-Hans":"鳗鱼","ko":"장어"}'),
  ('yakitori',  '{"ja":"焼き鳥","en":"Yakitori","zh-Hans":"烤鸡肉串","ko":"야키토리"}'),
  ('tonkatsu',  '{"ja":"とんかつ","en":"Tonkatsu","zh-Hans":"炸猪排","ko":"돈카츠"}'),
  ('ramen',     '{"ja":"ラーメン","en":"Ramen","zh-Hans":"拉面","ko":"라멘"}'),
  ('izakaya',   '{"ja":"居酒屋","en":"Izakaya","zh-Hans":"居酒屋","ko":"이자카야"}'),
  ('kaiseki',   '{"ja":"懐石・会席","en":"Kaiseki","zh-Hans":"怀石料理","ko":"가이세키"}'),
  ('teppanyaki','{"ja":"鉄板焼き","en":"Teppanyaki","zh-Hans":"铁板烧","ko":"테판야키"}'),
  ('shabushabu','{"ja":"しゃぶしゃぶ","en":"Shabu-shabu","zh-Hans":"涮涮锅","ko":"샤브샤브"}'),
  ('sukiyaki',  '{"ja":"すき焼き","en":"Sukiyaki","zh-Hans":"寿喜烧","ko":"스키야키"}'),
  ('donburi',   '{"ja":"丼もの","en":"Donburi (Rice Bowl)","zh-Hans":"盖饭","ko":"덮밥"}'),
  ('washoku',   '{"ja":"和食全般","en":"Washoku (General)","zh-Hans":"日本料理","ko":"일식"}')
on conflict (code) do update
  set name_translations = excluded.name_translations;
