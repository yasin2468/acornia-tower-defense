# TASKS — Carbon ↔ GLM-5.3 kuyruğu

Kural: **Carbon satır açar**, **GLM uygular**, **Carbon doğrular**. Aynı satırı iki taraf
aynı anda değiştirmez. Durumlar: `planlandi` → `devam` → `dogrulaniyor` → `dogrulandi`.

## Aktif / Doğrulanan

| # | İş | Sorumlu | Durum | Doğrulama |
|---|---|---|---|---|
| T1 | `git init` + `.gitignore` + ilk commit | Carbon | dogrulandi | `git log --oneline` → d8c3be1 |
| T2 | Mevcut oyunun baseline'ını doğrula (`npm test`, `tsc --noEmit`) | GLM-5.3 | dogrulandi | 28 pass / 0 fail, tsc OK, build ✓ |
| D1–D4 | Dalga HP eğrisi, L4 regresyonu, L12 altın/HP erozyonu, sniper & boss TTK | GLM-5.3 | dogrulandi | `99fa29f` · `tests/balance.test.ts` (5/5 pass, Carbon doğruladı) |
| K1–K4 | `boot()` hata kurtarma, düşman materyal `.dispose()`, `SaveManager` v3, i18n paritesi | GLM-5.3 | dogrulandi | `99fa29f` · `185/185` anahtar paritesi + regresyon testleri ✓ |
| A1, B1, C1 | HP bar WCAG AA kontrast, sandık olasılık metni, `DrawCallCounter` + PNG ikonlar | GLM-5.3 | dogrulandi | `34d830a` · `contrast.test.ts` & `drawcall.test.ts` ✓ |
| O3-A | Mağaza metin/davranış tutarlılığı (aylık VIP günlük zümrüt, referans fiyat, AFK birimi, promo kapısı) | GLM-5.3 | dogrulandi | `15e7891` · `tests/vip.test.ts` (7/7 pass, Carbon incelemesiyle eksiklik yakalandı) |
| O3-B | Süresi dolan aylık VIP ayrıcalık sızıntısını kapat (`isVipActive`: reklam atlama, 16h AFK, x2/x3 hız) | Carbon | dogrulandi | `87f93f6` · `tests/vip.test.ts` 10/10 + `simulation.test.ts`, 59/59 pass, build ✓ |
| M1 | Baykuş V4 chibi kule modellerini (`t1`, `t2`, `chain`, `blizzard`) `scripts/blender_build_chibi_units.py` ile üret ve doğrula | Carbon | dogrulandi | Blender `--verify` Cycles + canlı tarayıcı (`http://localhost:5173/?promo=1`) HTTP 200 & 0 hata ✓ |

## Kuyruk (Carbon doldurur)

| # | İş | Not |
|---|---|---|
| G1 | 674 çizim çağrısı: LOD / `env_castle` 23 materyal atlas birleştirme (ayrı iş, varlık hattı) | bekliyor |
| O1 | Çok oyunculu gerçek soket katmanı | bekliyor |

## Devir notu
GLM'e iş verirken satır numarasını yaz: `TASKS T2` + tek cümle hedef + kabul kriteri.
GLM bitince `TASKS.md`'de durumu `dogrulaniyor` yapar ve komut çıktısını yorum olarak ekler.
