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
| P1 | Boz Pençe akıllı nöbet takip, melee saldırı/vuruş VFX, menü kapatma koruması, 3 sınıf ultisi ve sağ-alt `#bw-skill-hero` madalyonu | Carbon | dogrulandi | `2fe85d2` · `tests/gameplay.test.ts` (4/4 pass) + build ✓ + tarayıcıda Lv/HP/Ulti bekleme süresi doğrulandı |
| P2 | 12 bölüm çatallı ikincil yol (`secondaryPath`), görüş alanı/mesafe garantili taktik yuvalar ve boş yuvada canlı menzil halkası (`previewTowerId`) | Carbon | dogrulandi | `88fd10d` · `tests/gameplay.test.ts` (2/2 geometri & iki koridor testi) + build ✓ + tarayıcı Seviye 2 çatallı yol doğrulandı |
| P3 | Biyom atmosferi & güneş ışığı, `ambientMotes` hava partikülleri, Kanyon patlayıcı fıçıları, Mağara rün yuvaları, Karlı Zirve buz bölgeleri | Carbon | dogrulandi | `2094ffa` · `tests/gameplay.test.ts` (3/3 fıçı/rün/buz testi) + build ✓ + Seviye 1 mor kristalsiz/polenli görsel doğrulandı |
| P4 | Dalga 1 hazırlık fazı (`waitForFirstWave`), sonraki dalga önizleme şeridi (`#bw-wave-preview`), vurgulu `Savaşı Başlat` / erken bonus & üst `#bw-boss-bar` | Carbon | dogrulandi | `tests/gameplay.test.ts` (2/2 hazırlık & erken bonus testi, toplam 70/70 pass) + `tsc/build` ✓ + canlı QA `0` hata ✓ |
| G1 | Tekli UV atlas birleştirme (`scripts/blender_optimize_env.py`), `InstancedMesh` yığınlama ve ağaç `THREE.LOD` optimizasyonu | Carbon | dogrulandi | `83c2dc4` · `tests/drawcall.test.ts` (7/7 pass, GLB 1-mesh/1-mat doğrulaması + LOD + 72/72 tüm testler + build ✓) |
| O1 | Gerçek RFC 6455 WebSocket rölesi (`wsRelay.ts` + Vite `/ws`), `NetworkService`, 2P Co-op & 1v1 PvP + `SmartBotDirector` yedeği | Carbon | dogrulandi | `tests/multiplayer.test.ts` (4/4 gerçek soket testi, toplam 76/76 pass) + `tsc/build` ✓ + tarayıcıda canlı oda + PvP `#bw-multi-bar` 0 hata ✓ |
| T-A | Kopya yıldız/ödül sabitlerinin tekilleştirilmesi, Three.js `manualChunks` paket bölme ve seviye-öncelikli lazy GLB yükleme | Carbon | dogrulandi | `tests/drawcall.test.ts` (8/8 pass, toplam 77/77 pass) + `tsc` OK + `vite build` 0 chunk uyarısı ✓ |

## Kuyruk (Carbon doldurur)

| # | İş | Not |
|---|---|---|
| F3-1 | 4 dallı Taktik Yetenek Ağacı (`SaveManager` v4 + `SimulationEngine` + `MetaView`) | devam |
| F3-2 | 2 yeni kahraman: Kızıl Kuyruk (`hero_fox.glb`) ve Kaya Diş (`hero_boar.glb`) | sirada |
| F3-3 | Orman Günlüğü (`360°` 3D vitrin + Zümrüt ödülü) & Akustik Biyom Müzikleri (`F3-6`) | sirada |
| F3-4 | Kayıp Orman Seferi (5 aşamalı Roguelike oyun sonu + 6 Orman Tılsımı) | sirada |
| F3-5 | 14 Günlük PvP Kupa Ligi, Harita Pin/Emoji, 30 Kademeli Sezonluk Orman Bileti & Haptics/SDK kancaları | sirada |

## Devir notu
GLM'e iş verirken satır numarasını yaz: `TASKS T2` + tek cümle hedef + kabul kriteri.
GLM bitince `TASKS.md`'de durumu `dogrulaniyor` yapar ve komut çıktısını yorum olarak ekler.
