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
| O1 | `NetworkTransportStub` → gerçek oda/soket katmanı (çok oyunculu) | onay bekliyor |
| O2 | `AdService`/`BillingService` Phase 1 simülasyon → AdMob/RevenueCat | onay bekliyor |
| O3 | 12 seviye üstü içerik / boss dengelemesi | onay bekliyor |

## Devir notu
GLM'e iş verirken satır numarasını yaz: `TASKS T2` + tek cümle hedef + kabul kriteri.
GLM bitince `TASKS.md`'de durumu `dogrulaniyor` yapar ve komut çıktısını yorum olarak ekler.
