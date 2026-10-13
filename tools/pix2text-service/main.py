# -*- coding: utf-8 -*-
"""
Pix2Text formül tanıma servisi.

Pix2Text bir Python kütüphanesi; tarayıcıda çalışamaz. Bu küçük servis
onu HTTP arkasına koyar, Test Maker de buradan çağırır.

Görüntü bu makinenin dışına ÇIKMAZ. İnternet yalnızca ilk çalıştırmada,
model dosyaları indirilirken gerekir.

Kurulum (bir kez):
    cd tools/pix2text-service
    python -m venv .venv
    .venv\\Scripts\\activate        (Windows)
    source .venv/bin/activate       (macOS / Linux)
    pip install -r requirements.txt

Çalıştırma:
    uvicorn main:app --host 127.0.0.1 --port 8777

İlk istek model indirdiği için yavaştır (birkaç dakika sürebilir).
Sonraki istekler CPU'da birkaç saniye, GPU varsa çok daha hızlıdır.
"""

from __future__ import annotations

import base64
import io
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SURUM = "1.0.0"

app = FastAPI(title="Pix2Text Formül Servisi", version=SURUM)

# Test Maker tarayıcıdan çağırıyor; servis yalnızca yerelde dinlediği için
# kaynak kısıtı yerine erişim kısıtı (127.0.0.1) güvenlik sınırıdır.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

_model = None


def model():
    """Model ağırdır; ilk istekte bir kez yüklenir."""
    global _model
    if _model is None:
        from pix2text import Pix2Text  # type: ignore

        # Yalnızca formül tanıma (MFR) kullanılıyor: metin OCR'ı tarayıcıda
        # Tesseract yapıyor, burada tekrarlamanın anlamı yok.
        _model = Pix2Text.from_config()
    return _model


class FormulIstek(BaseModel):
    image: str  # data URL veya çıplak base64


def _goruntuyu_coz(veri: str):
    from PIL import Image  # type: ignore

    s = (veri or "").strip()
    if not s:
        raise HTTPException(status_code=400, detail="Görsel boş")
    m = re.match(r"^data:[^;,]*;base64,(.*)$", s, re.S)
    ham = m.group(1) if m else s
    try:
        bayt = base64.b64decode(ham, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"base64 çözülemedi: {exc}") from exc
    try:
        return Image.open(io.BytesIO(bayt)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Görsel açılamadı: {exc}") from exc


def _latex_temizle(s: str) -> str:
    """Pix2Text bazen $...$ sarmalıyla döner; editör çıplak LaTeX bekliyor."""
    t = (s or "").strip()
    t = re.sub(r"^\$\$?(.*?)\$\$?$", r"\1", t, flags=re.S).strip()
    return t


@app.get("/saglik")
def saglik():
    """Test Maker açılışta bunu sorar; model yüklenmemişse de 200 döner."""
    return {"saglayici": "pix2text", "surum": SURUM, "modelYuklendi": _model is not None}


@app.post("/formul")
def formul(istek: FormulIstek):
    img = _goruntuyu_coz(istek.image)
    try:
        p2t = model()
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="pix2text kurulu değil. requirements.txt ile kurun.",
        ) from exc

    try:
        sonuc = p2t.recognize_formula(img)
    except AttributeError:
        # Sürüm farkı: bazı sürümlerde arayüz farklı adlandırılmış
        sonuc = p2t.recognize(img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Tanıma hatası: {exc}") from exc

    latex: Optional[str]
    guven = None
    if isinstance(sonuc, str):
        latex = sonuc
    elif isinstance(sonuc, dict):
        latex = sonuc.get("text") or sonuc.get("latex")
        guven = sonuc.get("score") or sonuc.get("confidence")
    else:
        latex = str(sonuc)

    latex = _latex_temizle(latex or "")
    if not latex:
        raise HTTPException(status_code=422, detail="Formül okunamadı")

    return {"latex": latex, "confidence": guven, "provider": "pix2text"}
