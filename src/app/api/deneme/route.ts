import { NextResponse } from "next/server";
import { gorselKaydet } from "@/lib/deneme/depo";
import type { AyiklananSoru, Bolum, SecilenSoru, Soru } from "@/lib/deneme/model";
import {
  DenemeHatasi,
  denemeDetay,
  denemeGuncelle,
  denemeOlustur,
  denemeYayinla,
  cevapAnahtariUygula,
  havuzOku,
  hazirDenemeYayinla,
  GORSEL_YOLU,
  onizlemeGetir,
  pdfEkle,
  pdfSoruEkle,
  smsYeniden,
  soruGuncelle,
  sonucListesi,
} from "@/lib/deneme/islem";

type Istek = {
  op?: string;
  ad?: string;
  sayfaSayisi?: number;
  pdfId?: string;
  metin?: string;
  id?: string;
  oturumId?: string;
  yanlisCezasi?: number;
  smsAlici?: "ogrenci" | "veli";
  bolumler?: Bolum[];
  pdfIdler?: string[];
  sorular?: { soru: AyiklananSoru; gorsel?: string | null; ortakGorsel?: string | null }[];
  patch?: Partial<Pick<Soru, "ders" | "metin" | "secenekler" | "dogru" | "gorsel" | "inceleme">> & {
    ad?: string;
    yanlisCezasi?: number;
    smsAlici?: "ogrenci" | "veli";
    bolumler?: Bolum[];
    sorular?: SecilenSoru[];
  };
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function yanitla(e: unknown) {
  if (e instanceof DenemeHatasi) {
    return NextResponse.json({ hata: e.message }, { status: e.durum });
  }
  console.error(e);
  return NextResponse.json({ hata: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const op = url.searchParams.get("op") || "havuz";
  try {
    if (op === "havuz") return NextResponse.json(await havuzOku());
    if (op === "deneme") return NextResponse.json(await denemeDetay(url.searchParams.get("id") || ""));
    if (op === "onizleme") return NextResponse.json(await onizlemeGetir(url.searchParams.get("id") || ""));
    if (op === "sonuclar") return NextResponse.json(await sonucListesi(url.searchParams.get("id") || ""));
    return NextResponse.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
  } catch (e) {
    return yanitla(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Istek;
    switch (body.op) {
      case "pdf":
        return NextResponse.json(
          await pdfEkle({ ad: body.ad || "", sayfaSayisi: body.sayfaSayisi || 1, sorular: body.sorular || [] })
        );
      case "pdf-ek":
        return NextResponse.json(await pdfSoruEkle(body.pdfId || "", body.sorular || []));
      case "soru":
        return NextResponse.json(await soruGuncelle(body.id || "", body.patch || {}));
      case "olustur":
        return NextResponse.json(
          await denemeOlustur({
            ad: body.ad || "",
            yanlisCezasi: body.yanlisCezasi,
            smsAlici: body.smsAlici,
            bolumler: body.bolumler || [],
            pdfIdler: body.pdfIdler || [],
          })
        );
      case "guncelle":
        return NextResponse.json(await denemeGuncelle(body.id || "", body.patch || {}));
      case "yayinla":
        return NextResponse.json(await denemeYayinla(body.id || ""));
      case "sms":
        return NextResponse.json(await smsYeniden(body.oturumId || ""));
      case "anahtar":
        return NextResponse.json(await cevapAnahtariUygula(body.pdfId || "", body.metin || ""));
      case "gorsel": {
        // Stüdyodan tek tek yüklenen soru görseli (JPEG data URL).
        const g = body as unknown as { veri?: string };
        const m = typeof g.veri === "string" ? g.veri.match(/^data:image\/jpeg;base64,(.+)$/) : null;
        if (!m) return NextResponse.json({ hata: "Görsel okunamadı." }, { status: 400 });
        const veri = Buffer.from(m[1], "base64");
        if (veri.length > 3_000_000) return NextResponse.json({ hata: "Görsel çok büyük." }, { status: 400 });
        const gid = crypto.randomUUID();
        await gorselKaydet(gid, veri);
        return NextResponse.json({ yol: `${GORSEL_YOLU}${gid}` });
      }
      case "hazir":
        return NextResponse.json(await hazirDenemeYayinla(body as never));
      default:
        return NextResponse.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
    }
  } catch (e) {
    return yanitla(e);
  }
}
