import { telefonE164 } from "./turkce.ts";

export type SmsIletim = { ok: boolean; hata: string | null; saglayici: string };

/**
 * Koçluk tarafında hazır bir SMS göndericisi yok; kurumsal mesajlar WhatsApp.
 * Twilio SMS numarası (TWILIO_SMS_FROM) tanımlıysa sonuç SMS'i oradan gider.
 * DENEME_SMS_KAYIT=1 yalnızca yerel doğrulama içindir, operatöre çıkmaz.
 */
export async function smsIlet(telefon: string, metin: string): Promise<SmsIletim> {
  const e164 = telefon.startsWith("+") && telefonE164(telefon) ? telefonE164(telefon) : telefonE164(telefon);
  if (!e164) return { ok: false, hata: "Telefon numarası geçersiz", saglayici: "yok" };
  if (process.env.DENEME_SMS_KAYIT === "1") {
    return { ok: true, hata: null, saglayici: "kayit" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  if (!sid || !token || !from) {
    return { ok: false, hata: "SMS göndericisi tanımlı değil", saglayici: "yok" };
  }
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: e164, Body: metin }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { ok: false, hata: "SMS gönderilemedi", saglayici: "twilio" };
    return { ok: true, hata: null, saglayici: "twilio" };
  } catch {
    return { ok: false, hata: "SMS servisi yanıt vermedi", saglayici: "twilio" };
  }
}
