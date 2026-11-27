import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

process.env.ONLINE_YOL = mkdtempSync(join(tmpdir(), "online-"));
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

const o = await import("../online/islem.ts");
const png = "data:image/png;base64," + Buffer.from("png-baytlari").toString("base64");

test("öğretmenin yayınladığı test başka cihazdan açılır ve teslimler öğretmene görünür", async () => {
  await o.gorselYukle("ab12cd34", 0, png);
  await o.gorselYukle("ab12cd34", 1, png);
  await o.testYayinla({
    id: "ab12cd34",
    title: "Fizik 1",
    schoolName: "VIP",
    durationMinutes: 40,
    sorular: [
      { id: "q1", answerKey: "A" },
      { id: "q2", answerKey: "C" },
    ],
  });
  assert.equal(await o.testVarMi("ab12cd34"), true);

  const og = await o.ogrenciTesti("ab12cd34");
  assert.equal(og.sorular.length, 2);
  assert.equal(JSON.stringify(og).includes("answerKey"), false, "anahtar öğrenciye gitmez");
  const g = await o.soruGorseli("ab12cd34", 1);
  assert.equal(g?.tur, "image/png");
  assert.equal(Buffer.from(g!.veri).toString(), "png-baytlari");

  const s = await o.teslimEt({ id: "ab12cd34", studentName: "  Ali  Veli ", answers: { 0: "A", 1: "B", 5: "A" } });
  assert.deepEqual(s, { score: 1, total: 2 });
  const t = await o.teslimler("ab12cd34");
  assert.equal(t.length, 1);
  assert.equal(t[0].studentName, "Ali Veli");
  assert.deepEqual(t[0].answers, { 0: "A", 1: "B" });

  await o.testSil("ab12cd34");
  await assert.rejects(() => o.ogrenciTesti("ab12cd34"), /bulunamadı/);
});

test("olmayan test ve geçersiz kimlik", async () => {
  await assert.rejects(() => o.ogrenciTesti("yokyok12"), /bulunamadı/);
  await assert.rejects(() => o.ogrenciTesti("../x"), /Geçersiz/);
  await assert.rejects(() => o.teslimEt({ id: "yokyok12", studentName: "Ali" }), /bulunamadı/);
});
