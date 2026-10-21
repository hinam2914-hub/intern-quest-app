# アバター実装用パーツ（ChatGPT 制作）納品規約
- すべて 1024×1024 透過 PNG。共通座標：中心 x=512、頭頂 y≈120、足元 y≈960。正面向き。
- body/<base>__<skin>.png            素体（f|m × light|fair|tan|deep）
- hair_back/<hairId>__<color>.png    後ろ髪（f_long … m_long × brown|black|darkbrown|beige|pink|ash|blue）
- hair_front/<hairId>__<color>.png   前髪（同上）
- outfit_back/<job>_default__<base>.png / outfit_front/<job>_default__<base>.png  衣装（6職業 × f|m）
- head/<id>.png  cape/<id>.png  weapon/<id>.png  accessory/<id>.png   ID は app/lib/avatar/catalog.ts の GEAR を参照
納品後、catalog.ts の該当パーツの src を null → "" 以外（例 "ok"）に変えると描画対象になる。
