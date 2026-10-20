import test from "node:test";
import assert from "node:assert/strict";
import { videoLinkiGecerli, videoQrDataUrl } from "../video-qr.ts";

test("yalnizca http ve https linki kabul edilir", () => {
  assert.equal(videoLinkiGecerli("https://video.ornek/cozum"), "https://video.ornek/cozum");
  assert.equal(videoLinkiGecerli("  http://ornek.test/a  "), "http://ornek.test/a");
  assert.equal(videoLinkiGecerli("javascript:alert(1)"), null);
  assert.equal(videoLinkiGecerli("not a url"), null);
  assert.equal(videoLinkiGecerli(""), null);
});

test("gecerli link karekod veri adresine donusur", async () => {
  const data = await videoQrDataUrl("https://video.ornek/cozum");
  assert.match(data, /^data:image\/png;base64,/);
});
