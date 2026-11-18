# TASKS — Carbon ↔ GLM-5.3 kuyruğu

Kural: **Carbon satır açar**, **GLM uygular**, **Carbon doğrular**. Aynı satırı iki taraf
aynı anda değiştirmez. Durumlar: `planlandi` → `devam` → `dogrulaniyor` → `dogrulandi`.

## Aktif

| # | İş | Sorumlu | Durum | Doğrulama |
|---|---|---|---|---|
| T1 | `git init` + `.gitignore` + ilk commit | Carbon | dogrulandi | `git log --oneline` → d8c3be1 |
| T2 | Mevcut oyunun baseline'ını doğrula (`npm test`, `tsc --noEmit`) | GLM-5.3 | dogrulandi | 28 pass / 0 fail, tsc OK, build ✓ |

## Kuyruk (Carbon doldurur)

| # | İş | Not |
|---|---|---|
| D1 | Dalga HP eğrisini 1.12–1.18 banda normalize et, L4 regresyonunu kapat | GLM-5.3 |
| D2 | Altın/HP erozyonu: L12'de oran ≥ 0.014 | GLM-5.3 |
| D3 | Sniper evrimi marjinal verimi ≤ 0.5 DPS/altın | GLM-5.3 |
| D4 | Boss TTK dengesi (tek T1 kule öldüremesin, 3 kule öldürebilsin) | GLM-5.3 |
| K1 | `boot()` hata yakalama + düşürücü yükleme mesajı | GLM-5.3 |
| K2 | Ölen düşman materyal/geometri dispose | GLM-5.3 |
| K3 | SaveManager sürüm migration + sessiz sıfırlama kaldır | GLM-5.3 |
| K4 | 20+ gömülü TR metni i18n anahtarına taşı (parite korunur) | GLM-5.3 |
| G1 | 674 çizim çağrısı: LOD/birleştirme (ayrı iş, varlık hattı) | bekliyor |
| O1 | Çok oyunculu gerçek soket katmanı | bekliyor |

## Devir notu
GLM'e iş verirken satır numarasını yaz: `TASKS T2` + tek cümle hedef + kabul kriteri.
GLM bitince `TASKS.md`'de durumu `dogrulaniyor` yapar ve komut çıktısını yorum olarak ekler.
