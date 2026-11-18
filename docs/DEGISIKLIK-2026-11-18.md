# PALAMUT KALESİ — Düzeltme Turu Raporu (2026-11-18)

Uygulayan: GLM-5.3 (yerel köprü). Doğrulayacak: DSH / Carbon.
Kapsam: D1–D5 (denge) + K1–K4 (kod sağlığı). Yeni bağımlılık YOK, public API kırılımı YOK.

**Doğrulama özeti:** `npx tsc --noEmit` ✅ · `npm test` **40/40 geçti** (28 mevcut + 12 yeni) ✅ · `npm run build` ✅
**Test sabiti güncellemesi: YOK** — hiçbir mevcut test eski denge sayısını sabitlemediği için tek bir test sabiti değiştirilmedi; 28 mevcut test aynen geçti.

---

## D1 — Dalga Eğrisi (src/data/levels.ts)

**Sorun:** L1 dalga HP katları `1.69 / 1.05 / 1.43 / 1.31 / 1.25 / 2.04` — hem bandın dışında hem düzensiz. L5/L7/L8'de toplam HP **düşen** dalgalara bile rastlanıyordu (L5: W8 3591 → W9 3525).

**Yöntem:** Her seviye için doğal geometrik oran `r = (sonDalgaHP/ilkDalgaHP)^(1/(n−1))` hesaplanıp `[1.13, 1.17]` bandına sıkıştırıldı (hedef bant 1.12–1.18 ±0.03 ⇒ kabul 1.09–1.21). `W1 = SeviyeToplamHP / Σr^i` çözülerek **seviye toplam HP %100 korundu** (yuvarlamadan ±0.1'e kadar sapma). Her dalganın hedef toplamı, mevcut gruplar arasında oransal paylaştırıldı; yük count/hp **√f bölüşümüyle** (count = round(count·√f), hp kalan pay) dağıtıldı; boss HP'leri sabit tutuldu. Üretici araç: `tmp/gen_balance.ts`.

**Öncesi → sonrası (dalga katları, seviye bazında):**

| Sv | Önce katlar | Sonra katlar | Toplam HP (önce→sonra) |
|---|---|---|---|
| L1 | 1.69/1.05/1.43/1.31/1.25/2.04 | 1.170/1.171/1.169/1.173/1.167/1.169 | 8725 → 8727 |
| L2 | düzensiz (0.99–1.68 arası) | 1.167–1.173 (8 dalga) | 12789 → 12800 |
| L3 | düzensiz | 1.166–1.173 (9 dalga) | 18723 → 18715 |
| L4 | düzensiz | 1.165–1.174 (8 dalga) | 13242 → 20606 (D2) |
| L5 | **monoton değil** (W9 < W8) | 1.160–1.173 (9 dalga) | 17489 → 17504 |
| L6 | düzensiz | 1.169–1.171 (9 dalga) | 24778 → 24764 |
| L7 | **monoton değil** | 1.167–1.173 (9 dalga) | 21458 → 21459 |
| L8 | **monoton değil** (W3, W7, W9 düşer) | 1.156–1.158 (10 dalga) | 29679 → 29684 |
| L9 | **monoton değil** (W7 düşer) | 1.140–1.145 (10 dalga) | 38905 → 38890 |
| L10 | **monoton değil** (W6 düşer) | 1.143–1.146 (10 dalga) | 42744 → 42755 |
| L11 | **monoton değil** (W2 düşer) | 1.128–1.132 (11 dalga) | 58434 → 58427 |
| L12 | **monoton değil** (W3 düşer) | 1.142–1.148 (12 dalga) | 74987 → 74997 |

- Tüm katlar 1.09–1.21 kabul bandında ✅, tüm dalga HP'leri monoton artıyor ✅ (önce 5 seviyede monotonluk bozuluyordu, şimdi 12/12).
- Toplam HP sapması (L4 hariç, D2 bilinçli): en fazla **%0.1** (hedef ±%10) ✅.
- Kabul testi: `tests/balance.test.ts` → "D1: 12 seviyede dalga HP katları 1.09-1.21 bandında..." (`npm test` içinde çalışır).

**Değişen dosya:** `src/data/levels.ts` — 12 seviyenin `waves` blokları (satır ~87–869); 221 `hpOverride`, 221 `count`, 112 `clearBonus` değeri güncellendi. `spacing`/`speedOverride`/`bountyOverride`/rota/slot dokunulmadı.

## D2 — Seviye 4 Regresyonu

**Sorun:** L3 toplam 18.723 HP → L4 13.242 HP (**−%29**), L4/L3 = **0.707**.

| Metrik | Önce | Sonra | Hedef |
|---|---|---|---|
| L4 toplam HP | 13242 | **20606** | — |
| L3 toplam HP | 18723 | 18715 | — |
| L4/L3 oranı | 0.707 | **1.101** | 1.05–1.20 ✅ |

- L4, L3'ün yeni toplamının %110'una normalize edildi (aynı 1.17 dalga eğrisi şekliyle).
- **Canyon teması korundu:** düşman seti değişmedi — `scout_bot, turbo_hopper, swarm_saw, shield_loader, hover_drone, mega_harvester` (testte assertion olarak kilitli). Sadece count/hpOverride büyüdü (örn. W2 turbo_hopper 8×58 → 15×109; W8 eskort 12×78 → 20×127; boss 1650 HP aynı).
- Kabul testi: `tests/balance.test.ts` → "D2: L4/L3 toplam HP orani 1.05-1.20 bandinda".
- Not: D1'in "±%10 toplam korunumu" kuralı L4 için bilinçli olarak D2 tarafından geçersiz kılıındı (+%55.6); test L4'ü ±%10 kuralından muaf tutup L4/L3 oranıyla doğruluyor.

## D3 — Altın/HP Erozyonu

**Sorun:** clearBonus/HP oranı L1 **0.0195** → L12 **0.0112** (**−%43**). (Metrik görev metnindeki sayılarla birebir örtüşüyor: L1 170/8725, L12 843/74987.)

**Yöntem:** Bounty değerleri ve düşman sayıları ekonomisi değiştirilmedi; yalnızca **clearBonus** seviyelere `0.0195 → 0.0148` doğrusal hedef oranıyla (mevcut dağılımı koruyarak, boss dalgası farkı yutacak şekilde) artırıldı.

**Ekonomi tablosu (önce → sonra):**

| Sv | HP (önce→sonra) | Bounty altın | clearBonus (önce→sonra) | clearBonus/HP (önce→sonra) |
|---|---|---|---|---|
| L1 | 8725 → 8727 | 709 | 170 → **170** (değişmedi) | 0.0195 → **0.0195** |
| L2 | 12789 → 12800 | 995 | 226 → 244 | 0.0177 → 0.0191 |
| L3 | 18723 → 18715 | 1350 | 280 → 349 | 0.0150 → 0.0186 |
| L4 | 13242 → 20606 | 969 | 268 → 375 | 0.0202 → 0.0182 |
| L5 | 17489 → 17504 | 1279 | 300 → 311 | 0.0172 → 0.0178 |
| L6 | 24778 → 24764 | 1687 | 341 → 430 | 0.0138 → 0.0174 |
| L7 | 21458 → 21459 | 1410 | 345 → 363 | 0.0161 → 0.0169 |
| L8 | 29679 → 29684 | 1951 | 435 → 490 | 0.0147 → 0.0165 |
| L9 | 38905 → 38890 | 2557 | 491 → 625 | 0.0126 → 0.0161 |
| L10 | 42744 → 42755 | 2695 | 520 → 669 | 0.0122 → 0.0156 |
| L11 | 58434 → 58427 | 3457 | 632 → 890 | 0.0108 → 0.0152 |
| L12 | 74987 → 74997 | 4292 | 843 → **1110** | 0.0112 → **0.0148** |

- **L1 ±%15 korundu:** 0.0195 (band 0.0166–0.0224) ✅ — clearBonus hiç artırılmadı.
- **L12 ≥ 0.014:** 0.0148 ✅ ve **≥ 1050 altın:** 1110 ✅.
- Erozyon −%43'ten **−%24'e** indi (0.0195 → 0.0148); eğri artık monoton ve yumuşak.
- Kabul testi: `tests/balance.test.ts` → "D3: altin/HP erozyonu kapandi…".

## D4 — Sniper Dengesi (src/data/towers.ts)

| Metrik | Önce | Sonra | Hedef |
|---|---|---|---|
| Hasar / atış hızı | 48 / 1.8 | **40 / 1.8** | — |
| critChance / critMultiplier | 0.30 / 2.5 | **0.25 / 2.5** | — |
| Maliyet | 120 | 120 (değişmedi) | — |
| Efektif DPS = `dmg·rate·(1+cc·(cm−1))` | 125.3 | **99.0** | 85–100 ✅ |
| Marjinal = `(evoDPS − tier2DPS)/maliyet` | 0.680 | **0.461** | ≤ 0.50 ✅ |

- Efektif DPS 85'in altına inmedi (sniper işe yarar durumda: 99.0) ✅.
- Diğer evrimlerin hiçbirine dokunulmadı (test sadece sniper'ı sabitler).
- i18n açıklaması güncellendi: `%30 kritik 2.5x` → `%25 kritik 2.5x` (`locales.ts:53` tr, `:211` en).

**Değişen satırlar:** `src/data/towers.ts:92-98` · `src/i18n/locales.ts:53,211`.

## D5 — Boss TTK (veri değişikliği gerekmedi)

**Formül:** `TTK = bossHP / (kuleSayısı × damage × fireRate × (1 − armor))`
mega_harvester (L1 W7): HP **1320** (D1 normalizasyonunda sabit tutuldu), zırh **0.35**; squirrel T1: 12 hasar × 2.0 atış/sn.

| Senaryo | Hesap | TTK | Hedef | Sonuç |
|---|---|---|---|---|
| Tek T1 kule | 1320 / (12·2.0·0.65) = 1320/15.6 | **84.6 sn** | > 35 sn | ✅ |
| 3× T1 kule | 1320 / 46.8 | **28.2 sn** | ≤ 35 sn | ✅ |
| 3 kule toplam efektif DPS | 3 × 15.6 | **46.8** | ≥ ~37.7 | ✅ |

- Geçiş penceresi 35 sn: L1 patika uzunluğu ≈ 33.7 m / boss hızı 0.95 m/sn ≈ 35.4 sn — görevdeki pencereyle uyumlu.
- Mevcut değerler hedefi zaten sağlıyordu (görevin "önce" ölçümüyle aynı: 84.6 sn); bossBonusPct/boss HP oynaması **gerekmedi**. D1 sırasında boss HP'si sabit tutularak bu denge korundu ve testle kilitlendi: `tests/balance.test.ts` → "D5: mega_harvester TTK…".

## K1 — Boot Hata Yakalama (src/main.ts:268-321)

- `boot()` gövdesi try/catch içine alındı: model yükleme, `renderMeta`/`startLevel` ve rAF kaydı hata verse bile yükleme ekranı asla sonsuz döngüde kalmıyor.
- Hata durumunda yükleme ekranında Türkçe başlık + açıklama + hata adı + **"Yeniden Dene"** butonu gösteriliyor (`renderBootError`, `main.ts:282-296`); buton `boot()`'u yeniden çağırıyor.
- Konsola hata adı yazılıyor: `console.error('[PalamutKalesi] boot hatası: <ErrorName>', err)` (`main.ts:317`).
- **Retry gerçekten çalışsın diye:** `AssetLoader.preloadAllModels` başarısız olursa `preloadPromise = null` yapılıyor (`src/rendering/AssetLoader.ts:118`) — aksi halde ikinci çağrı cache'lenmiş reddedilen promise'i dönerdi ve Yeniden Dene asla deneyemezdi. Kısmen yüklenmiş modeller cache'te kalır, deneme kaldığı yerden devam eder.
- Metinler i18n'den: `boot.errorTitle`, `boot.errorMessage`, `boot.retry` (tr + en).

## K2 — Dispose (src/rendering/SceneManager.ts:1904-1930)

Ölen düşmanın gövdesi `dyingBodies` süresi bitince gruptan çıkarılırken artık **klonlanmış materyaller dispose ediliyor** (Set ile tekilleştirilmiş traverse; aynı materyal iki kez dispose edilmiyor).

**Kod doğrulaması (klon/paylaşımlı ayrımı):**
- **Materyaller → KLON, dispose EDİLDİ:** düşman gövdeleri `createEnemyRig` → `instantiateModel('enemy_…', true)` (`ModelFactory.ts:342`) ile üretilir; `cloneMaterials=true` dalında her mesh'in materyali örnek başına `matCloneMap` üzerinden `m.clone()` ile kopyalanır (`AssetLoader.ts:144-163`). Önbellekteki orijinal GLTF materyallerine dokunulmaz. Model yoksa kullanılan `fallbackBox` da çağrı başına `new THREE.MeshStandardMaterial` üretir (`ModelFactory.ts:11`) — o da tek kullanımlık.
- **Geometriler → PAYLAŞIMLI, dispose EDİLMEDİ:** `SkeletonUtils.clone` içte `source.clone()` çağırır (`three/examples/jsm/utils/SkeletonUtils.js:362`); `Object3D.clone` geometriyi **referansla paylaşır**. Yani her düşman örneğinin geometrisi önbellekteki GLTF sahnesiyle ortaktır — dispose edilirse sonraki düşmanlar bozulur. Bu yüzden dispose bloğu yalnız materyale bakar, geometriye `geometry.dispose()` uygulamaz.
- `dyingBodies`'ye yalnızca düşman gövdeleri eklenir (`SceneManager.ts:1334`) — kule/çevre modelleri (paylaşımlı materyal) bu bloğa girmez.
- Değişiklik sadece `db.life <= 0` bloğu; başka hiçbir dispose mantığına dokunulmadı.

## K3 — Save Migration & Kurtarma (src/services/SaveManager.ts)

- **`SAVE_VERSION = 2`** (`SaveManager.ts:42`); `createInitialSave` artık `version: 2` yazar (`:66`).
- **`migrateSave(parsed, nowMs)`** eklendi (dışa açıldı, `:107-110`): v1 → v2 **alan ekleme yok** → sadece sürümü yazar, veriyi `createInitialSave` varsayılanlarıyla birleştirip korur ve `migrated` bayrağı döndürür. Migrate edilen kayıt constructor'da anında depoya yazılır (yeni geçerli checksum ile).
- **Sessiz sıfırlama kaldırıldı:** checksum bozuk ama JSON okunabilirse → veriler **kurtarılır** (sıfırlama yok), `saveRecovered: true` uyarısı döner (`:115,120`) ve konsola `console.warn('[SaveManager] Save checksum bozuk — … KURTARILDI (sıfırlama yapılmadı), uyarı: saveRecovered')` yazılır (`:144`). Kurtarma sonrası kayıt geçerli checksum'la yeniden yazılır.
- JSON çözümlenemiyorsa (bozuk metin) → temiz başlangıç kaydı (tek çare bu; kurtarma iddiası yok, `saveRecovered: false`).
- `STORAGE_KEY` bilinçli olarak `palamut_kalesi_save_v1` olarak korundu — anahtar değişirse mevcut oyuncu kayıtları sahipsiz kalırdı; şema sürümü kaydın içindeki `version` alanında taşınır.
- Testler: `tests/balance.test.ts` → migrateSave v1→v2, bozuk-checksum kurtarma (localStorage stub'ıyla), geçerli v1 otomatik migrate, çözümsüz JSON → temiz başlangıç.

## K4 — i18n (155 → 174 anahtar, tr = en)

Taşınan gömülü metinler (kullanım yeri → anahtar):

| Yer (eski) | Anahtar | tr / en |
|---|---|---|
| main.ts:272 | `loading.title` | PALAMUT KALESİ / ACORN BASTION |
| main.ts:276,288 | `loading.models` | 3D Modeller Yükleniyor... / Loading 3D Models... |
| main.ts (K1, yeni) | `boot.errorTitle` / `boot.errorMessage` / `boot.retry` | Bir Hata Oluştu / … / Yeniden Dene (+en) |
| BattleView.ts:535,558,564 | `hud.sellShort` | SAT / SELL |
| BattleView.ts:289,655 | `promo.hudShow` / `promo.hudHide` | HUD Aç / HUD Gizle (+en) |
| BattleView.ts:658 | `promo.swarmBtn` | +30 Testere Sürüsü / +30 Saw Swarm |
| BattleView.ts:685 | `cur.oak` / `cur.gem` | Palamut / Zümrüt (+Acorns / Gems) |
| MetaView.ts:287 | `bestiary.hp` / `bestiary.speed` / `bestiary.armor` | HP / Hız / Zırh (+HP / Spd / Armor) |
| MetaView.ts:428,434 (alt) | mevcut `shop.freeChest` / `shop.epicChest` yeniden kullanıldı | — |
| MetaView.ts:430 | `shop.chestsRemaining` | Kalan / left |
| MetaView.ts:431 | `shop.openChest` | AÇ (Reklam) / OPEN (Ad) |
| MetaView.ts:436 | `shop.epicChestContents` | +10 Epik Kart / +10 Epic Cards |
| MetaView.ts:437,557,568 | `cur.gem` / `cur.oak` / `cards.plusTen` | Zümrüt / Palamut / +10 Kart (+en) |
| MetaView.ts:585 | `multi.statusReady` | SmartBotDirector hazır… / SmartBotDirector ready… |

- **Parite:** tr = en = **174 anahtar** (155 + 19 yeni; testle kilitli). `tests/balance.test.ts` ayrıca kaynak dosyalarda `>SAT<`, `3D Modeller Yükleniyor`, `AÇ (Reklam)`, `/2 Kalan`, `· Hız `, `HUD Aç` gibi gömülü metin kalmadığını assert eder (gerileme koruması).
- D4 kapsamında `evo.squirrel_sniper.desc` içeriği güncellendi (%30 → %25 kritik).

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/data/levels.ts` | D1+D2+D3: 12 seviyenin dalga count/hpOverride + clearBonus değerleri (316 satır) |
| `src/data/towers.ts:92-98` | D4: squirrel_sniper damage 48→40, critChance 0.30→0.25 |
| `src/i18n/locales.ts:160-179, 336-355` | K4: +19 anahtar (tr/en); `:53,211` sniper desc güncellendi |
| `src/main.ts:268-321` | K1+K4: try/catch + renderBootError + Yeniden Dene + yükleme metinleri i18n |
| `src/rendering/AssetLoader.ts:93-122` | K1: preload başarısızlığında preloadPromise sıfırlama (retry için) |
| `src/rendering/SceneManager.ts:1904-1930` | K2: ölen düşman klon materyalleri dispose (geometri paylaşımlı → dokunulmadı) |
| `src/services/SaveManager.ts:42-170` | K3: SAVE_VERSION=2, migrateSave, saveRecovered kurtarma |
| `src/ui/BattleView.ts:289,535,558,564,655,658,685` | K4: gömülü metinler → anahtar |
| `src/ui/MetaView.ts:287,428-437,557,568,585` | K4: gömülü metinler → anahtar |
| `tests/balance.test.ts` | YENİ: 12 kabul testi (D1, D2, D3, D4, D5, K3×4, K4×3) |
| `tmp/gen_balance.ts` | YENİ (geçici araç): dalga eğrisi üretici + doğrulayıcı; derlemeye dahil değil |

## Test Sabiti Güncellenenler

**Yok.** Mevcut 28 test hiçbir eski denge sabitine (dalga HP'si, sniper stat'ı, boss HP'si) bağımlı çıkmadı; tamamı değişikliklerden sonra aynen geçti. Yeni 12 test `tests/balance.test.ts` içinde; toplam **40 test, 0 fail**.
