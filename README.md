# Dershanem Online VIP Test Maker

Tarayıcıda çalışan gelişmiş test hazırlama uygulaması: soru kırpma, PDF sınav kağıdı oluşturma ve online sınav yayınlama.

## Özellikler

- **Kırpma aracı** — PDF veya görselden soru kesme, otomatik numaralandırma
- **Soru bankası** — IndexedDB ile kalıcı soru deposu
- **Kağıt hazırlama** — Yazılı / yaprak / deneme modları, 1–2 sütun, kenar boşlukları, filigran, optik form
- **PDF indirme** — Tek tıkla `Kağıdı Hazırla`
- **Online sınav** — Paylaşılabilir `/exam/[id]` linki (aynı tarayıcıda veri saklanır)

## Kurulum

```bash
cd online-vip-test-maker
npm install
npm run dev
```

Tarayıcıda: [http://localhost:3000](http://localhost:3000)

## GitHub + Vercel

1. GitHub’da yeni repo oluşturun (`online-vip-test-maker`).
2. Projeyi push edin:

```bash
git init
git add .
git commit -m "Dershanem VIP Test Maker ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/online-vip-test-maker.git
git push -u origin main
```

3. [vercel.com](https://vercel.com) → **Add New Project** → GitHub reposunu seçin.
4. Framework: **Next.js** (otomatik algılanır), **Deploy**.

Canlı URL örneği: `https://online-vip-test-maker.vercel.app`

## Sonraki adımlar (öneri)

- Supabase / Vercel Blob ile çok cihazlı online sınav
- PDF sayfa render (pdf.js) kırpma aracında
- Optik form okuyucu (kamera + OMR)
- Kurum yönetimi ve öğretmen hesapları

## Teknoloji

Next.js 15 · React 19 · TypeScript · Tailwind · Zustand · jsPDF · react-easy-crop · idb-keyval
