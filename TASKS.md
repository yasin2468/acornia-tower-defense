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
| F3-1 | 4 dallı Taktik Yetenek Ağacı (`SaveManager` v4 + `SimulationEngine` + `MetaView`) | Carbon | dogrulandi | `tests/faz3.test.ts` (3/3 pass, toplam 80/80 pass) + `tsc` OK + build ✓ |
| F3-2 | 2 yeni kahraman: Kızıl Kuyruk (`hero_fox.glb`) ve Kaya Diş (`hero_boar.glb`) | Carbon | dogrulandi | Blender Cycles portre + `hero_fox`/`hero_boar.glb` + `tests/faz3.test.ts` (84/84 pass) + build ✓ |
| F3-3 | Orman Günlüğü (`360°` 3D vitrin + Zümrüt ödülü) & Akustik Biyom Müzikleri (`F3-6`) | Carbon | dogrulandi | `SceneManager.renderJournalShowcase` + `SoundEngine` biyom müziği + `tests/faz3.test.ts` (86/86 pass) + build ✓ |
| F3-4 | Kayıp Orman Seferi (5 aşamalı Roguelike oyun sonu + 6 Orman Tılsımı) | Carbon | dogrulandi | `roguelike.ts` + `SimulationEngine` 6 tılsım/kısıt + `MetaView`/`BattleView` sefer akışı + `tests/faz3.test.ts` (89/89 pass) + build ✓ |
| F3-5 | 14 Günlük PvP Kupa Ligi, Harita Pin/Emoji, 30 Kademeli Sezonluk Orman Bileti & Haptics/SDK kancaları | Carbon | dogrulandi | `season.ts` + `wsRelay`/`NetworkService` `SOCIAL_PING` + `CommercialServices` `HapticsService`/SDK köprüsü + `tests/faz3.test.ts` & `multiplayer.test.ts` (93/93 pass) + build ✓ |
| GF-2 | Vuruş hissiyatı, katmanlı ses miksajı, kahraman kesiş izi, parabolik ölüm ve kale hasar geri bildirimi | Carbon | dogrulandi | `SimulationEngine`/`JuiceController`/`SceneManager`/`SoundEngine`/`CameraController`/`ModelFactory`/`BattleView`/`main.ts` + `tests/gamefeel.test.ts` (95/95 pass) + build + canlı ?promo=1 tarayıcı QA (0 hata) ✓ |
| UI-1 | "Ulu Meşe Parşömeni" ana menü yenilemesi, Kenney Adventure UI (CC0) 9-slice çerçeveler ve 5'li alt navigasyon | Carbon | dogrulandi | `public/ui/kenney/*` (CC0) + `MetaView`/`styles.css`/`icons.ts`/`theme.ts`/`locales.ts`/`main.ts` + `tests/menu_ui.test.ts` (99/99 pass) + build + canlı tarayıcı QA (0 hata) ✓ |
| UI-1B | Konsept 1'e birebir görsel sadakat yenilemesi (tam ekran boyama harita, 13 RGBA ikon/bot rozeti, kalkan düğümler & pirinç köşe çerçeveler) | Carbon | dogrulandi | `public/ui/oak/*` (world_map_oak + 13 RGBA PNG) + `MetaView`/`styles.css`/`icons.ts`/`locales.ts` + `tests/menu_ui.test.ts` (99/99 pass) + build + canlı tarayıcı QA (0 hata) ✓ |
| P5 / GF-3 | Kahraman/slot takılma çözümü, 6 adet 3B yetenek modeli (`skill_*.glb`) & dinamik VFX/SFX, 14 düşman + 16 bölüm Kor Dökümhanesi genişlemesi | Carbon | dogrulandi | Blender 5.2 CLI + `AssetLoader`/`SimulationEngine`/`SceneManager`/`SoundEngine`/`levels`/`enemies`/`MetaView` + `99/99` test pass + `tsc/vite build` + canlı tarayıcı QA (0 hata) ✓ |
| GF-4 / E-OPT2 | 14 düşman biriminin "Seçenek 2 · Buharlı Hurda" konseptlerine birebir 3B `.glb` (`SpinBone_*`, `Walk`/`Attack`) + 14 adet `160×160` RGBA portre yenilemesi | Carbon | dogrulandi | Blender 5.2 CLI (`blender_build_enemies_opt2.py`, `extract_enemy_opt2_portraits.py`) + yan yana konsept/3B doğrulama + `ModelFactory`/`icons`/`MetaView`/`BattleView`/`enemies` + `100/100` test pass + `tsc/vite build` + canlı QA ✓ |
| UI-2 / P6 | Yatay kayan dünya haritası (`1→16` sağa geçiş okları, kaydırma, numara şeridi, mini harita & `1..10` açık erişim) + 16 benzersiz 3B bölüm konsepti (dere, gölet, hendek, köprü, değirmen, maden, ley halkası, ayna gölü, cüruf/magma, çarklar, Tesla) | Carbon | dogrulandi | `levels.ts`/`locales.ts`/`ProceduralTextures.ts`/`StageConcepts.ts`/`SceneManager.ts`/`MetaView.ts`/`styles.css` + `101/101` test pass (`26 suites, 0 fail`) + `tsc/vite build` + canlı QA (`0` hata, sıfır pin/ok çakışması) ✓ |

## Kuyruk (Carbon doldurur)

| # | İş | Not |
|---|---|---|

## Devir notu
GLM'e iş verirken satır numarasını yaz: `TASKS T2` + tek cümle hedef + kabul kriteri.
GLM bitince `TASKS.md`'de durumu `dogrulaniyor` yapar ve komut çıktısını yorum olarak ekler.
