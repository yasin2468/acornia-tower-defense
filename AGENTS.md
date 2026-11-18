# Palamut Kalesi — ajan sözleşmesi (Carbon ↔ GLM-5.3)

Bu dosya iki modelin ortak kuralı: **Gemini 4 Carbon** (Antigravity, planlayıcı/doğrulayıcı)
ve **GLM-5.3** (yerel köprü `127.0.0.1:8788`, uygulayıcı). Antigravity `AGENTS.md`'yi otomatik
okur; GLM tarafında `opencode` aynı dosyayı bağlam olarak alır.

## Yığın
Vite 6 + TypeScript + Three.js 0.170. Giriş: `src/main.ts`. UI metinleri: `src/i18n`.

| Komut | Anlam |
|---|---|
| `npm run dev` | 5173'te oyun |
| `npm run build` | `tsc --noEmit` + vite build |
| `npm test` | `node --test tests/*.test.ts` |

## Değişmezler
1. **Yeni bağımlılık = önce sor.** three/vite/typescript dışındaki her paket onay ister.
2. `npm run build` ve `npm test` yeşil olmadan iş **bitmiş sayılmaz**.
3. Kullanıcıya görünen metin `src/i18n` üzerinden; dosyalara gömülü metin yazılmaz.
4. `public/` altındaki üretilmiş varlıklar (`scripts/*.py`, Blender çıktısı) elle düzenlenmez —
   kaynak script değiştirilip yeniden üretilir.
5. Silme/taşıma yok. Gerekiyorsa `TASKS.md`'ye öneri satırı açılır.

## İş bölümü (üreten ≠ doğrulayan)
- **Carbon**: plan, mimari karar, kod incelemesi, `TASKS.md` güncelleme, `git` kontrolü.
- **GLM-5.3**: kod yazma, test çalıştırma. Komut:
  `opencode run --model yerel-kopru/glm-5.3 "<görev>"`
- Carbon'un yazdığı kodu GLM doğrulamaz, GLM'in yazdığını Carbon doğrular.

## Git
Depo yoksa ilk iş `git init` + `.gitignore` (node_modules, dist, scripts/__pycache__, .next).
Çok modelli çalışmada geri dönüş şart.
