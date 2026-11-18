# PALAMUT KALESİ — Sayısal + Grafiksel Denetim (2026-11-18)

Yöntem: `docs/skiller/tower-defense.md` sayısal kriterleri (HP üssü 1.12–1.18, dalga-1 baskısı 0.5–0.7, satış iadesi %50–80, hedefleme "first") uygulanmıştır. Kullanıcı ölçümleri aynen alınmış, kod verisi `src/data/*.ts` + `src/core/SimulationEngine.ts` + `src/rendering/*.ts` + `src/styles.css`'ten türetilmiştir. Tüm hesaplar `tmp/analiz.ts` script'iyle yapılmıştır (yeniden üretilebilir). Varsayımlar "varsayım" olarak etiketlenmiştir.

---

## 1. KULE MATEMATİĞİ

### 1.1 DPS tanımları (kaynak: src/data/towers.ts)

- Ham DPS = `damage × fireRate` (birim: hasar/sn)
- Efektif DPS (krit) = `damage × (1 − critChance + critChance × critMultiplier) × fireRate`
- **Sniper efektif DPS gösterimi** (towers.ts:92-97: damage 48, fireRate 1.8, critChance 0.3, critMultiplier 2.5):
  `48 × (1 − 0.3 + 0.3 × 2.5) × 1.8 = 48 × 1.45 × 1.8 = 125.3 hasar/sn`
  (Kullanıcı ölçümü: ham 86.4 → efektif 125.3, aynen teyit.)
- Kullanıcı ölçümlü DPS'ler (aynen): squirrel T1 24.0 / T2 43.7 / sniper 86.4 (ef. 125.3) / gatling 67.2; beaver 16.9 / 31.5 / 49.3 (reçine) / 57.6 (sersemletme); owl 9.6 / 19.6 / 39.0 (zincir) / 35.2 (buzul); hedgehog 22.0 / 42.9 / 74.1 (delme) / 96.0 (parçalama).

### 1.2 Altın başına DPS ve yükseltme geri dönüşü

Geri dönüş modeli (varsayım): `süre = maliyet / (ΔDPS × 0.1007)` — 0.1007 altın/HP, L1 toplam geliri/toplam HP'den (879/8725, levels.ts:87-144 + SimulationEngine.ts:448, 1031-1032). Kule %100 atış halinde varsayımıyla **üst sınır verimidir**; gerçek %50–70 aktif süreyle 1.4–2 kat uzun sürer.

| Kule | Kademe | Maliyet (altın) | Toplam yatırım | Ham DPS | Ef. DPS | DPS/altın (toplam) | ΔDPS (marjinal) | Geri dönüş (sn, varsayım) | Kaynak |
|---|---|---|---|---|---|---|---|---|---|
| squirrel | T1 | 50 | 50 | 24.0 | 24.0 | **0.480** (en iyi satın alma) | — | 21 | towers.ts:83 |
| squirrel | T2 | 75 | 125 | 43.7 | 43.7 | 0.350 | +19.7 | 38 | towers.ts:84 |
| squirrel | sniper evrimi | 120 | 245 | 86.4 | 125.3 | 0.353 ham / **0.511 ef.** | +81.6 ef. | **15** (en hızlı) | towers.ts:91-98 |
| squirrel | gatling evrimi | 120 | 245 | 67.2 | 67.2 | 0.274 | +23.5 | 51 | towers.ts:100-110 |
| beaver | T1 | 70 | 70 | 16.9 | 16.9 | 0.241 | — | 41 | towers.ts:123 |
| beaver | T2 | 105 | 175 | 31.5 | 31.5 | 0.180 | +14.6 | 71 | towers.ts:124 |
| beaver | reçine evrimi | 165 | 340 | 49.3 | 49.3 | 0.145 | +17.8 | 92 | towers.ts:130-140 |
| beaver | sersemletme evrimi | 165 | 340 | 57.6 | 57.6 | 0.169 | +26.1 | 63 | towers.ts:142-156 |
| owl | T1 | 65 | 65 | 9.6 | 9.6 | 0.148 | — | 67 | towers.ts:168-175 |
| owl | T2 | 95 | 160 | 19.6 | 19.6 | 0.122 | +10.0 | 94 | towers.ts:176-183 |
| owl | zincir evrimi | 150 | 310 | 39.0 | 39.0 | 0.126 | +19.4 | 77 | towers.ts:186-198 |
| owl | buzul evrimi | 150 | 310 | 35.2 | 35.2 | **0.114** (en verimsiz) | +15.6 | 95 | towers.ts:200-215 |
| hedgehog | T1 | 85 | 85 | 22.0 | 22.0 | 0.259 | — | 38 | towers.ts:228 |
| hedgehog | T2 | 125 | 210 | 42.9 | 42.9 | 0.204 | +20.9 | 59 | towers.ts:229 |
| hedgehog | delme evrimi | 195 | 405 | 74.1 | 74.1 | 0.183 | +31.2 | 62 | towers.ts:232-243 |
| hedgehog | parçalama evrimi | 195 | 405 | 96.0 | 96.0 | 0.237 | +53.1 | 36 | towers.ts:245-258 |

Bulgular:

- **T2 marjinal verimi düşer** (squirrel T1 0.48 → T2 marjinal 19.7/75 = 0.26 DPS/altın), sniper evrimi marjinali 0.68 DPS/altın ile tepe — "tall" (sniper) ve "wide" (T1 spam) stratejileri canlı (skill kriteri: ikisi de geçerli olmalı, docs/skiller/tower-defense.md:62).
- Kullanıcı ölçümü "evrim sonrası en verimli sniper 0.353 / en verimsiz owl 0.114" ham DPS/toplam yatırım tanımıyla aynen teyit edildi (86.4/245 = 0.353; 35.2/310 = 0.114).
- Zırh delme (armorPiercePct) bu tabloya dahil değil; zırhlı düşmanda hedgehog T1 (pierce 0.6) efektif 18.0 DPS (22 × 0.82, zırh 0.45'e karşı) — squirrel T1'in 13.2 DPS'ine (24 × 0.55) karşı (formül: Bölüm 7.1).

### 1.3 Kart, satış ve kahraman çarpanları

| Öğe | Değer | Birim | Kaynak |
|---|---|---|---|
| Kart çarpanı lvl1→15 | 1.00 → 2.12 (+%8/seviye) | × | towers.ts:65-71 |
| Sniper lvl15 efektif DPS | 125.3 × 2.12 = 265.6 | hasar/sn | hesap (towers.ts:92-97 + 66-71) |
| Satış iadesi | `floor(toplamHarcama × 0.60)`; sniper yolu 245 altın → 147 altın | altın | towers.ts:64, SimulationEngine.ts:343-351 |
| Satış oranı skill aralığında | 0.60 ∈ [0.50, 0.80] | orAN | docs/skiller/tower-defense.md:60 |
| Kahraman ham DPS | 20 / 0.85 sn = 23.5 tek hedef + 35/8 sn = 4.4 AoE (pençe şoku) | hasar/sn | enemies.ts:292-305, SimulationEngine.ts:560-580 |
| Kahraman blok | 3 yerli düşmanı tamamen durdurur (engagedByHero: hareket atlanır) | düşman | SimulationEngine.ts:543-553, 648-651 |
| Kahraman blok dayanımı | 280 HP − 3×7 DPS + 14 HP/sn rejen → ~40 sn 3 normal düşman tutar | sn | SimulationEngine.ts:584-595 |

---

## 2. DÜŞMAN MATEMATİĞİ

Kaynak: src/data/enemies.ts:38-205 (her düşmanın satır aralığı tabloda). Kill-zone süresi = **gerçek yol uzunluğu / hız**; yol uzunlukları levels.ts path noktalarından hesap: L1 33.3 m (levels.ts:59-70), L12 34.0 m (levels.ts:827-838). Not: `killZoneMeters` alanı (14.0–18.5 m, levels.ts:58…826) motor tarafından **hiç kullanılmıyor** — ölü veri (tek eşleşme: tanım levels.ts:41).

| Düşman | HP | Hız (m/sn) | Zırh | Ödül (altın) | Ödül/HP | Kill-zone L1 (sn) | Kill-zone L12 (sn) | TTK squirrel T1 (sn) | TTK hedgehog_shred (sn) | Kaynak |
|---|---|---|---|---|---|---|---|---|---|---|
| scout_bot | 42 | 2.3 | 0.00 | 5 | 0.119 | 14.5 | 14.8 | 1.8 | 0.4 | enemies.ts:38-53 |
| swarm_saw | 24 | 3.1 | 0.00 | 3 | 0.125 | 10.7 | 11.0 | 1.0 | 0.3 | enemies.ts:54-69 |
| shield_loader | 135 | 1.35 | 0.45 | 11 | 0.081 | 24.7 | 25.2 | 10.2 | 1.6 | enemies.ts:70-85 |
| hover_drone (uçan) | 65 | 2.3 | 0.10 | 6 | 0.092 | 14.5 | 14.8 | 3.0 | 0.7 | enemies.ts:86-101 |
| mega_harvester (boss) | 1320 | 0.95 | 0.35 | 60 | 0.045 | 35.0 | 35.8 | **84.6** | 11.2 | enemies.ts:102-117 |
| turbo_hopper | 58 | 3.75 | 0.00 | 6 | 0.103 | **8.9** | 9.1 | 2.4 | 0.6 | enemies.ts:118-136 |
| chomp_brute | 185 | 1.72 | 0.22 | 13 | 0.070 | 19.4 | 19.8 | 9.9 | 2.0 | enemies.ts:137-153 |
| repair_drone (uçan) | 92 | 2.05 | 0.15 | 9 | 0.098 | 16.2 | 16.6 | 4.5 | 1.0 | enemies.ts:154-170 |
| crystal_golem | 320 | 1.05 | 0.58 | 18 | 0.056 | 31.7 | 32.4 | **31.7** | 3.9 | enemies.ts:171-187 |
| cryo_colossus (boss) | 2450 | 0.88 | 0.45 | 95 | 0.039 | 37.8 | 38.6 | **185.6** | 21.3 | enemies.ts:188-205 |

TTK formülü: `HP / (DPS × (1 − zırh × (1 − pierce)))` (SimulationEngine.ts:970-971). hedgehog_shred pierce 0.75 + boss +%35 (towers.ts:255-257).

### 2.1 Boss matematiği

| İfade | Hesap | Sonuç | Kaynak |
|---|---|---|---|
| L1 mega_harvester vs tek squirrel T1 | 1320 / (24 × 0.65) | 84.6 sn > 35.0 sn geçiş → **tek T1 kule boss'u yolda öldüremez** | enemies.ts:108-110, hesap |
| L12 cryo_colossus (3400 HP override, levels.ts:868) vs hedgehog_shred | brüt 96 × 0.8875 × 1.35 = 115.0 DPS − rejen 8 → 107.0 net | **31.8 sn** (geçiş 38.6 sn — 1 kule yeter, 2 kule güvenli) | hesap |
| L12 cryo_colossus vs sniper | 125.3 × 0.55 = 68.9 − 8 = 60.9 net | **55.8 sn** > 38.6 sn geçiş → tek sniper yetmez | hesap |
| Boss 2. faz (%50 HP) | 2× crystal_golem (220 HP, hız 1.15) çağırır + **en yakın kuleyi 4.0 sn dumana sokar** (smokedTimer) | SimulationEngine.ts:988-1016; cryo çağrısı enemies.ts:204 | |
| mega_harvester 2. faz | tanımsız → varsayılan 4× swarm_saw (26 HP, hız 3.2) | SimulationEngine.ts:991-996 | |

### 2.2 Destek mekaniği denklemi

- repair_drone aura: 15 HP/sn, yarıçap 2.8 m (enemies.ts:169, SimulationEngine.ts:626-634) → squirrel T1'in zırhlı hedefteki 21.6 efektif DPS'ının %69'unu tek düşmanda iptal eder (15/21.6).
- chomp_brute ölüm bölünmesi: 2× swarm_saw 28 HP (enemies.ts:152, SimulationEngine.ts:1034-1044) → efektif HP 185 + 56 = 241.
- crystal_golem rejen 10 HP/sn (enemies.ts:186) → squirrel T1 net DPS 10.1 − 10 = **0.1 → pratikte öldüremez** (31.7 sn tablosu rejen hariçtir).
- turbo_hopper dash: her 3.2 sn'de 0.65 sn ×1.45 hız (enemies.ts:133-135) → ort etkin hız 3.75 × (1 + 0.65×0.45/3.2) ≈ 4.09 m/sn; kill-zone 8.9 → ~8.2 sn (SimulationEngine.ts:654-657).

### 2.3 Sızma toleransı (base HP 150, levels.ts:57)

Kaçak hasarı = düşmanın `baseDamage` değeri (SimulationEngine.ts:690-692): scout 10, swarm 5, shield 20, drone 12, mega 50, hopper 12, brute 18, repair 12, golem 26, cryo 60.

| Düşman | Tolerans (150/damage) | Anlamı |
|---|---|---|
| swarm_saw | 30.0 kaçak | tam bir dalga sızmazsa bile ölüm yok |
| scout_bot / hopper / repair / drone | 15 / 12.5 / 12.5 / 12.5 | |
| chomp_brute | 8.3 | |
| shield_loader | 7.5 | |
| crystal_golem | 5.8 | |
| mega_harvester | **3.0** | boss kaçarsa kalan HP'nin 1/3'ü gider |
| cryo_colossus | **2.5** | 3. kaçış = yenilgi |
| Demir modu | 150/1 = **1 HP** | tek kaçak = yenilgi (SimulationEngine.ts:198) |

---

## 3. DALGA MATEMATİĞİ

Kaynak: levels.ts dalga blokları (L1: 87-144, L2: 183-246, L3: 288-359, L4: 399-456, L5: 496-506, L6: 547-557, L7: 598-608, L8: 648-659, L9: 700-711, L10: 752-763, L11: 803-815, L12: 856-869). HP = Σ count × hpOverride. Geometrik kat = dalga-içi ardışık HP oranlarının geometrik ortalaması. İlk-30 sn yükü: spawn çizelgesi (spacing × (count−1) + grup arası 0.7 sn, SimulationEngine.ts:471) üzerinden dalga 1'in 30 sn içinde doğan HP toplamı.

| Seviye | Dalga sayısı | Toplam HP | Geometrik kat (dalga/dalga) | İlk 30 sn HP yükü | Toplam gelir (altın) | Gelir/HP | Toplam HP ÷ base HP |
|---|---|---|---|---|---|---|---|
| L1 | 7 | 8.725 | **1.429** | 378 (9 düşman) | 879 | 0.101 | 58× |
| L2 | 8 | 12.789 | 1.372 | 440 (10) | 1.221 | 0.095 | 85× |
| L3 | 9 | 18.723 | 1.341 | 495 (11) | 1.630 | 0.087 | 125× |
| L4 | 8 | 13.242 | 1.239 | 576 (12) | 1.237 | 0.093 | 88× |
| L5 | 9 | 17.489 | 1.264 | 540 (10) | 1.579 | 0.090 | 117× |
| L6 | 9 | 24.778 | 1.273 | 848 (16) | 2.028 | 0.082 | 165× |
| L7 | 9 | 21.458 | 1.200 | 768 (12) | 1.755 | 0.082 | 143× |
| L8 | 10 | 29.679 | 1.157 | 1.332 (29) | 2.386 | 0.080 | 198× |
| L9 | 10 | 38.905 | 1.143 | 1.656 (26) | 3.048 | 0.078 | 259× |
| L10 | 10 | 42.744 | 1.145 | **2.088** (20) | 3.215 | 0.075 | 285× |
| L11 | 11 | 58.434 | 1.109 | **2.712** (30) | 4.089 | 0.070 | 390× |
| L12 | 12 | 74.987 | 1.146 | 2.100 (28) | 5.135 | 0.068 | **500×** |

### 3.1 Skill kriteri karşılaştırması (docs/skiller/tower-defense.md:34: "geometric HP growth 1.12-1.18x per wave")

- L1-L3 ortalamaları **1.34-1.43 → öneri bandının belirgin üstünde**; telafi eden faktör: her seviye sıfır ekonomiyle başlar (startGold 150-520, levels.ts:56…824) ve gelir/HP 0.10 → 0.07 eriyerek kule etkisini dengeler (gelir de dalga bazında büyür).
- L8-L12 (1.11-1.16) bandın içine/dibine oturur — uzun seviyelerde yayvanlaşma var, final boss dalgası tepe yapar.
- Örnek dalga dizileri: L1 HP: 378, 640, 675, 962, 1265, 1580, 3225 (katlar 1.69, 1.05, 1.43, 1.31, 1.25, **2.04 final spike**). L12 HP: 2100 … 10438, 7465, 9382 (katlar … 1.27, **0.72 nefes**, 1.26) — **spike → breather → spike** örüntüsü skill gotcha #8'e (docs/skiller/tower-defense.md:97) uygundur: L12 dalga 11 (mega_harvester mini-boss) final cryo öncesi tasarlanmış nefestir.

### 3.2 Dalga-1 baskısı (skill kriteri 0.5-0.7, docs/skiller/tower-defense.md:57) — L1 worked example (varsayımlı)

- Dalga 7 (final) yükü: 7×165 + 10×75 + 1320 = 3.225 HP; zırh-düzeltmeli etkin HP (pierce'siz): 1155/0.55 + 750/0.9 + 1320/0.65 = **4.964 eHP**.
- Zaman penceresi: spawn ≈ 13 sn + boss geçişi 35 sn ≈ **47 sn** → gereken ham DPS ≈ 106.
- Kümülatif altın dalga 7 öncesi: 150 başlangıç + dalga 1-6 geliri 632 = 782 altın (bounty + clearBonus, levels.ts:87-143).
- Satın alınabilir DPS (7 slot: 6× squirrel T1 + 1× hedgehog T1 = 385 altın → 166 DPS; kalan 397 → 2× squirrel T2 +75×2 → +39.4; toplam ≈ 206 DPS + kahraman 23.5 ≈ **230 DPS**).
- **Baskı ≈ 106/206 = 0.51** (kuleler %100 aktif varsayımı — üst sınır verimlilik; gerçek aktif ~%60-70 ile 0.73-0.85). Skill bandı 0.5-0.7 (dalga 1) / 0.6-0.95 (orta) ile uyumlu. Varsayım: kütük slotu (40 altın, levels.ts:78) açılmış, kart seviyeleri 1.

---

## 4. EKONOMİ

| Kaldıraç | Değer | Birim | Kaynak |
|---|---|---|---|
| Seviye başlangıç altını | 150 → 520 (L1→L12; ort +%22.6/seviye) | altın | levels.ts:56, 152, 255, 368, 464, 515, 566, 616, 668, 720, 771, 824 |
| Remote başlangıç ayarı | startGoldDelta = 0 (hazır, kapalı) | altın | CommercialServices.ts:17, 100-106 |
| Dalga temizleme bonusu | 15 (L1 dalga 1) → 200 (L12 dalga 12) | altın | levels.ts:90, 868 |
| Dalga arası bekleme | 8.0 sn (ilk dalga 3.5 sn) | sn | SimulationEngine.ts:157, 452 |
| Öldürme ödülü (bounty) | 3-140 altın/düşman (override dahil) | altın | enemies.ts:47…197, levels.ts override'lar |
| Mıknatıs çarpanı | ×1.5, 8 sn etkin, 30 sn bekleme | ×/sn | SimulationEngine.ts:396-400, 1030-1031 |
| Erken çağrı bonusu | `min(20, floor(countdown × 2))` → efektif maks **16** (countdown maks 8.0) | altın | SimulationEngine.ts:402-408, 452 |
| Satış iadesi | floor(harcama × 0.60) | altın | towers.ts:64; SimulationEngine.ts:347 |

### 4.1 Sandık getirisi (EV = deterministik, rastgelelik yok)

Seçim formülü: `UNIT_IDS[(abs(seed) + i×3) % 5]` — tohuma bağlı ama dağılım sabit (ProgressionService.ts:93-96). "Beklenen değer" sabit getiriye eşittir:

| Sandık | Palamut (oak) | Zümrüt | Kart | Maliyet | Kaynak |
|---|---|---|---|---|---|
| Orman (reklam, 2×/gün) | 90 | 6 | 3 | 1 reklam | ProgressionService.ts:81-96; MetaView.ts:549-557 |
| Efsanevi | 320 | 25 | 10 | **120 zümrüt** | ProgressionService.ts:87-92; MetaView.ts:433-437 |
| Dolaylı kur | 120 zümrüt → 320 palamut = **2.67 palamut/zümrüt** (elmas→altın tek dönüşüm yolu) | | | | hesap |

### 4.2 Reklam + pasif gelir (VIP'siz, günlük)

| Kanal | Günlük | Birim | Kaynak |
|---|---|---|---|
| Ücretsiz sandık 2× | 180 palamut + 12 zümrüt + 6 kart | /gün | MetaView.ts:551-557 |
| Hızlı devriye takviyesi 2× | 280 palamut (+2 kart) | /gün | ProgressionService.ts:53-64; MetaView.ts:514 |
| AFK devriye | 35 palamut/saat, tavan 8 sn (VIP 16 sn) = 280 + 0.5 kart/saat | /gün | ProgressionService.ts:26-38 |
| Zafer 2× reklamı | +120 palamut + 15 zümrüt / zafer | /zafer | BattleView.ts:739-748 |
| Base canlandırma reklamı | base HP → min(max, 50) + tüm düşmanlara 3 sn sersemletme | /yenilgi | SimulationEngine.ts:410-418; BattleView.ts:731-737 |
| Hız 2× | reklamla maç boyu ×2 (VIP ×3) | /maç | BattleView.ts:228-238 |
| **Toplam pasif+reklam** | **≈ 740 palamut + 12 zümrüt + 6 kart/gün** (zafer reklamları hariç) | /gün | hesap |

Not: reklam ağları henüz **stub** — `showRewarded` her zaman `{rewarded: true}` döner (CommercialServices.ts:35-51); gerçek reklam geliri Phase 4'te bağlanacak.

### 4.3 Enflasyon / azalan getiri

- Faiz mekanizması **yok** (skill: "optional, capped", docs/skiller/tower-defense.md:61 — uygulanmamış).
- Kart yükseltme maliyeti lineer büyür: shard 2+2×L, palamut 60+45×L (ProgressionService.ts:19-24); DPS kazancı +%8 sabit (towers.ts:66-71) → lvl 14→15 atlama maliyeti 30 shard + 690 palamut = en pahalı %8. **Azalan marjinal getiri mevcut** (skill "diminishing tiers" kriteri, docs/skiller/tower-defense.md:62 — kule kademeleri için de 1.2'de gösterildi).
- IAP: VIP aylık 4.99 USD / ömür 17.99 USD (CommercialServices.ts:104-105); ömür +200, aylık +50 zümrüt tek seferlik (CommercialServices.ts:74-82). Locale metnindeki "+50 Günlük Zümrüt" (locales.ts:297) için **kod karşılığı bulunamadı** (bkz. Bölüm 8). İlk yenilgi paketi: 300 zümrüt + 10 kirpi kartı + 5 bilet, indirim %80 (CommercialServices.ts:62-72, 103).
- Kayıt başlangıcı: 240 palamut + 80 zümrüt + 1 bilet (SaveManager.ts:56-61).

---

## 5. GRAFİK MATEMATİĞİ

Ölçümlü girdiler (kullanıcı, aynen): 42 GLB, 331.339 üçgen, 27 MB, ort. 7.889 üçgen/model; 674 çizim çağrısı (primitives); en ağır env_castle.glb 25.968 üçgen / 23 materyal; world-map-bg.png 768×1376 (1.531 KB); palamut_palette.png 1024×1024; dist 36 MB, ana JS 795.76 kB (gzip 209 kB), CSS 24 kB.

### 5.1 Üçgen ve çağrı bütçesi (iOS A-serisi karşılaştırma)

| Büyüklük | Değer | Birim | Karşılaştırma (varsayım: endüstriyel kural değerleri) |
|---|---|---|---|
| Kare başına üçgen | 331.339 | üçgen/kare | A15 pratik ~0.6-1 G üçgen/sn → 331k×60 = 19.9 M/sn = **%2-3 doluluk**; A12'de de rahat |
| Kare başına çizim çağrısı | 674 | çağrı/kare | iOS WebGL'de çağrı başına ~5-10 μs CPU (varsayım) → 3.4-6.7 ms/kare → tek çekirdekte 60 fps **sinirda**; InstancedMesh (SceneManager.ts:296-297) runtime çağrıyı primitives'in altına indirir — 674 primitives ≠ 674 çağrı |
| Tek model payı | env_castle 25.968 = üçgen bütçesinin %7.8 + **23 materyal = tek başına 23 çağrı** | üçgen/çağrı | Materyal atlası ile −22 çağrı potansiyeli |
| Tepe pixel oranı | min(devicePixelRatio, 2) (SceneManager.ts:563) + 4× MSAA (SceneManager.ts:606) | × | 440×920 px kabukta 2× DPR + 4× MSAA → ~6.5 M fragment/kare teorik tavan (varsayım; gerçek doluluk ölçülemedi, bkz. Bölüm 8) |

### 5.2 Doku VRAM (RGBA 4 byte/px + %33 mipmap varsayımı)

| Doku | Çözünürlük | VRAM | Kaynak |
|---|---|---|---|
| world-map-bg.png | 768×1376 | 5.38 MB | kullanıcı ölçümü; public/ (tek dosya) |
| palamut_palette.png | 1024×1024 | 5.33 MB | kullanıcı ölçümü; public/models/ (tek PNG, 42 GLB yanında) |
| Çayır CanvasTexture (aktif biyom) | 1024×1024 | 5.33 MB | ProceduralTextures.ts:79-122 (çalışma anı üretimi, önbellek SceneManager.ts:551) |
| Aralık yolu CanvasTexture | 1024×1024 | 5.33 MB | ProceduralTextures.ts:128-169 |
| UI ikonları ~14 adet | 160×160 | 0.13 MB ×14 = 1.82 MB | public/ui/ |
| Gölge haritası | 2048×2048 depth (32-bit varsayım) | 16.8 MB | SceneManager.ts:595 |
| **Toplam (statik)** | | **≈ 40 MB** + GLB içine gömülü dokular (27 MB paket; çözülmüş boyut ölçülemedi, Bölüm 8) | hesap |

### 5.3 Gölge haritası texel yoğunluğu

- Gölge kamerası alanı: x ±12 m, z ±14 m → **24×28 = 672 m²** dünya alanı (SceneManager.ts:598-601); çözünürlük 2048×2048 (SceneManager.ts:595).
- Texel yoğunluğu: 2048/24 = **85.3 texel/m** (x), 2048/28 = **73.1 texel/m** (z) ≈ 0.85 texel/cm.
- Örnek: scout_bot yarıçap 0.44 m (enemies.ts:49) → gölge genişliği ~75 texel — mobil kalite için yeterli; bias −0.0004, normalBias 0.025 (SceneManager.ts:602-603). PCFSoft + ACES ton eşleme (SceneManager.ts:564-567).

### 5.4 Kamera frustum kapsaması (CameraController.ts:19-21, 34)

- FOV **39° dikey**, near 0.5 m, far 80 m, aspect alt sınır 0.4; pozisyon (0, 17.8, 13.6), lookAt (0, 0, −0.5) → kamera mesafesi **22.71 m**, aşağı eğim **51.6°**.
- Zemin kapsama bandı (aspect 0.462 — iPhone 390×844 css px varsayımı): z **+7.5 … −14.8** = 22.3 m derinlik; harita (z −9.0…+9.8 = 19.6 m, levels.ts:59-70) tam sığar.
- **Spawn noktası (z=+9.8) alt kenarın ~2.3 m dışında** → düşmanlar ekran dışından doğar; scout (2.3 m/sn) ~1.0 sn'de görünür alana girer (tasarım tercihi olarak yorumlanabilir).
- Yatay kapsam (frustum köşe ışınlarının y=0 kesişimi): yakın kenar (z=+7.5) ±2.9 m, uzak kenar (z=−14.8) ±5.2 m (aspect 0.462) / ±2.5…±4.5 (aspect 0.4 en kötü).
- **Bulgu:** z=−0.6 derinliğinde yarı genişlik 3.74 m iken L1 slot_7 kütüğü (x=−4.4, z=−0.6, levels.ts:78) **ekran dışı ~0.66 m** → dar dikey ekranlarda kenar kütük slotları (±4.4-4.6, levels.ts:78-79, 174, 278-279, …) dokunulamaz olabilir. Yolun en dış noktası (−3.4, 2.6) 3.41 m yarı genişlikte 0.01 m payla içeride — **yol ancak sığıyor**.
- Sarsıntı: `trauma² × strength`, sönüm 1.45/sn, roll maks 0.03 rad, zoom-punch maks 3.5° (CameraController.ts:11-15, 89-92, 139-148); Azaltılmış Hareket modunda trauma ölçeği 0.35, tavan 0.4 (CameraController.ts:4-5).

---

## 6. UI MATEMATİĞİ

Dönüşüm varsayımı: iOS WebView/Capacitor'da 1 CSS px ≈ 1 dp (pt); kabuk genişliği 440 px (styles.css:42-50) → değerler dp cinsinden okunur. Apple HIG minimum dokunma hedefi 44 pt.

### 6.1 Buton boyutları (px → dp)

| Bileşen | Boyut (px = dp) | HIG 44 dp'ye göre | Kaynak (styles.css) |
|---|---|---|---|
| .radial-sq-btn (kare kontrol) | 46×46 | ✓ geçer | 1044-1046 |
| .radial-btn (kule seçim madalyonu) | 64×64 | ✓ geniş | 1229-1233 |
| .skill-medallion-btn (yetenek) | 54×54 | ✓ | 1066-1069 |
| .tower-round-action (yükselt/sat) | 58×58 | ✓ | 1330-1336 |
| .icon-btn (meta ikon buton) | 36×36 | ✗ hedefin %82'si | 317-319 |
| .stage-crest (harita pini) | 32×34 / boss 36×38 | ✗ hedefin %73-86'sı | 555-558, 592-596 |
| .game-switch (anahtar) | 46×26 | genişlik ✓, yükseklik dar | 214-217 |
| .btn (metin butonu) | dolgu 9/14 px + 13 px yazı ≈ 35-40 dp yükseklik | ~sinırda | 149-166 |

### 6.2 Yazı ölçeği

- Aralık: **9 px … 24 px** (0.41×). Temel oyun içi metin 11-13 px (styles.css:154, 980, 1053).
- En küçükler: .stage-pin-stars **9 px** (styles.css:661), .threat-boss-tag 9 px (styles.css:765-767), .biome-tag 9.5 px (styles.css:678) — HIG'in küçük metin için önerdiği 11 pt tabanının **altında** (okunabilirlik riski, %18 küçük).
- Krit ve altın yüzen hasar ayrımı: 13 → 18 px (krit, styles.css:1192-1195), 14 px (altın, 1198-1201) — boyut + renkle çift kodlama ✓.

### 6.3 Kontrast oranları (WCAG 2.2: (L1+0.05)/(L2+0.05); AA eşiği 4.5:1 normal, 3:1 büyük/bileşen)

| Çift | Oran | AA (4.5:1) | Kaynak |
|---|---|---|---|
| #ffffff / #101926 (metin/koyu zemin) | **17.66:1** | ✓ | styles.css:6, 2 |
| #bdd0e6 / #101926 (soluk metin) | 11.21:1 | ✓ | styles.css:7, 2 |
| #ffca45 / #101926 (altın vurgu) | 11.59:1 | ✓ | styles.css:8, 2 |
| #3a2103 / #f3c93f (altın buton metni/orta ton) | 9.46:1 | ✓ | styles.css:187, hesap (gradyan ortalaması varsayım) |
| #ffdf75 / #131e2c (radial maliyet) | 12.85:1 | ✓ | styles.css:1270-1271 |
| #362003 / #ffca45 (evrim maliyet hapı) | 10.10:1 | ✓ | styles.css:1440-1441 |
| #ffffff / #3b5e46 (yüzen hasar/zemin tonu varsayımı) | 7.30:1 | ✓ (varsayım: orta yeşil zemin) | styles.css:1183-1186 |
| #bdd0e6 / #1b2a3c (nav sekme) | 9.24:1 | ✓ | styles.css:7, 875 |
| #7d90a6 / #22303a (devre dışı buton) | **4.13:1** | bileşen eşiği 3:1 üstü ✓, metin için altında (devre dışı → toleranslı) | styles.css:206, 205 |
| #ffffff / #53b763 (HP yazısı/dolgu) | **2.52:1** | ✗ (12 px küçük metin için 4.5 gerek; 1.5 px text-shadow telafi eder ama ölçülemez) | styles.css:962-968, 952-960 |

- Güvenli alan: `env(safe-area-inset-*)` kullanılıyor (styles.css:254-255, 904, 1031) ✓.

---

## 7. EKSİK DENKLEMLER (kodda olmayan / olan formüller)

| Formül | Var mı | Denklem + yer |
|---|---|---|
| Zırh azaltma | **EVET** | Çarpımsal: `finalDamage = max(1, rawDamage × (1 − armor × (1 − armorPiercePct)))` — taban 1 hasar garantili. SimulationEngine.ts:970-971. Zırh kırma (owl_glacier 0.3/her vuruşta **bileşik**: armor × 0.7ⁿ) SimulationEngine.ts:941-943; kalıcı yarma (hedgehog_shred, tek seferlik ×0.5) SimulationEngine.ts:936-939 |
| Alan hasarı düşüşü (AoE falloff) | **HAYIR** | Yarıçap içinde **tam hasar**, mesafeye bağlı azalma yok: SimulationEngine.ts:879-883 (`hypot ≤ aoeRadius` → aynı `damage`). Zincir menzili sabit 3.6 m (SimulationEngine.ts:787). Eksik: `dmg × (1 − dist/radius)` tipi fonksiyon |
| Kritik dağılımı | **EVET** (basit) | Bernoulli: `rng.next() < critChance → dmg × critMultiplier`; yalnız sniper'da (0.3 × 2.5). SimulationEngine.ts:767-772, towers.ts:96-97. RNG deterministik tohum (SimulationEngine.ts:184, SeededRNG). Eksik: pity/sıcak-soğuk zarf, çoklu kulede krit korelasyonu yok (bağımsız) |
| Hedefleme maliyeti | **KISMEN** | Her atışta tüm düşman listesi taranır: `enemies.filter(range)` O(n) — SimulationEngine.ts:712-717; güçlü hedef `hp×(1+armor)` karşılaştırması SimulationEngine.ts:729. Uzamsal indeks (grid/quadtree) **HAYIR**; maliyet denklemi (kule × düşman/atış) belgelenmemiş. 8 kule × 30 düşman = 240 mesafe hesabı/tur — mevcut ölçekte sorun değil |
| Zorluk ölçekleme | **KISMEN** | Demir modu: baseHp = 1 (SimulationEngine.ts:198; 3 yıldız garantisi SimulationEngine.ts:1071-1072). Remote startGoldDelta hazır ama 0 (CommercialServices.ts:17, 102). HP/hız çarpanı tipi genel zorluk eğrisi **HAYIR** (seviyeler elle yazılmış veri) |
| Adaptif zorluk | **HAYIR** | Oyuncu performansına (sızma, yeniden deneme sayısı, kart seviyesi) bağlı dinamik HP/hız/gelir ayarı kodun hiçbir yerinde yok; en yakın kanca: `RemoteConfigService` (CommercialServices.ts:100-111) ama statik |
| Faiz / enflasyon | **HAYIR** | Faiz yok (skill "optional" — docs/skiller/tower-defense.md:61); kayıt birikimi yalnız palamut/zümrüt biriktirir, seviye içi altın sıfırlanır (SimulationEngine.ts:197) |
| Kaçak cezası | **DOLAYLI** | Kaçan düşmanın bounty'si kaybedilir (yalnız öldürmede ödenir, SimulationEngine.ts:1027-1032) + baseDamage (SimulationEngine.ts:691). Açık "kaçak başına altın cezası" formülü yok — skill'in "leaks cost lives and the bounty" kuralı (docs/skiller/tower-defense.md:59) yaşam+ödül üzerinden dolayılamasıyla karşılanır |
| Kahraman seviye eğrisi | **EVET** | XP eşiği `level × 75`, seviye başına +%15 max HP, +%12 hasar (`1 + (L−1) × 0.12`), maks L5. SimulationEngine.ts:557, 600-613 |
| Hedefleme öncelikleri | **EVET** | first (yol ilerlemesi; owl'da "yavaşlatılmamış önce" akıllı mod), strongest (`hp×(1+armor)`), weakest (hp), closest (mesafe). SimulationEngine.ts:720-738; varsayılanlar towers.ts:80, 120, 165, 225 — skill kriteri "first varsayılan" ✓ (docs/skiller/tower-defense.md:64, 91-92) |

---

## 8. ÖLÇÜLEMEYENLER (bu denetimde hesaplanamayanlar)

1. **GLB içine gömülü dokuların çözülmüş VRAM'i** — 42 GLB'nin doku blokları ayrıştırılmadı; KTX2/Basis sıkıştırma var mı bilinmiyor (27 MB paket boyutu biliniyor, GPU'daki karşılığı değil).
2. **Gerçek runtime çizim çağrısı sayısı ve kırılımı** — 674 primitives ölçülmüş; InstancedMesh birleştirmesi sonrası gerçek WebGL çağrısı tarayıcı profilcisi olmadan doğrulanamaz (hangi sahnenin kaç çağrı tükettiği dahil).
3. **GPU doluluk (fill rate) ve kare süresi dağılımı** — 4× MSAA + pixelRatio 2 teorik fragment tavanı hesaplandı (~6.5 M/kare, varsayım) ama gerçek sahne doluluğu/overdraw ölçülemedi; 30 fps pil tasarrufu modu (SaveManager.ts:93) etkisi ölçülemedi.
4. **Ses motoru bellek/DSP maliyeti** — SoundEngine.ts throttle kurgusu biliniyor ama ses kanalı sayısı/belleği ölçülemedi.
5. **Gerçek reklam geliri/saat** — reklam ağları stub (CommercialServices.ts:39-51 her zaman `rewarded: true`); eCPM bağlanmadan ölçülemez.
6. **VIP "+50 günlük zümrüt" vaadinin kod karşılığı** — yalnız locale metni (locales.ts:297); günlük iade kodu bulunamadı → verilip verilmediği sınanamaz.
7. **iOS css px ↔ dp eşlemesinin cihaz bazlı doğruluğu** — 1:1 varsayımı yalnız WebView testiyle doğrulanabilir (Bölüm 6 varsayımı).
8. **SeededRNG krit dağılımının istatistiksel kalitesi** — deterministik tohum (SimulationEngine.ts:184) biliniyor; periyot/permütasyon kalitesi test edilmedi (yeterli örneklem çekilmedi).
9. **Level oynanış süresi (ETA)** — dalga matematiği pencere hesapları çıkarıldı (ör. L1 final ≈ 47 sn) ama tüm seviyelerin top-toplam süresi simülasyon koşmadan hesaplanmadı.
10. **LocalStorage kayıt boyutu ve kontrol toplamı çakışma olasılığı** — FNV-1a tabanlı checksum (SaveManager.ts:46-54) biliniyor; kayıt boyutu oyuncuya göre değişir.
11. **`killZoneMeters` alanının tasarım amacı** — motor kullanmıyor (Bölüm 2); UI'da gösterilip gösterilmediği metin aramasıyla kapatılamadı (hiçbir tüketici bulunamadı).

---

*Rapor sonu. Hesap script'i: `tmp/analiz.ts` (node --experimental-strip-types ile yeniden üretilebilir). Kaynak ölçümler: kullanıcı (2026-11-18).*








