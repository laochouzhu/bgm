/* 从打包器模板里抽出真实的压缩函数，配合成音频跑一遍 —— 测的是集成进去的那份代码本身 */
const fs = require('fs');
const vm = require('vm');

vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '..', 'third_party', 'lamejs', 'lame.min.js'), 'utf8'));

const tpl = fs.readFileSync(require('path').join(__dirname, '..', '.build', 'packer.tpl.html'), 'utf8');
function between(a, b) {
  const i = tpl.indexOf(a), j = tpl.indexOf(b, i);
  if (i < 0 || j < 0) { throw new Error('找不到标记: ' + a); }
  return tpl.slice(i, j);
}
// toI16 / yieldUI / decodeAudioFile / resampleAudio / encodeMp3 全在这一段里
const code = between('function toI16(f){', 'function setStat(');
console.log('抽取到 ' + code.length + ' 字符的压缩流水线代码');
vm.runInThisContext(code + '\nthis.__enc = encodeMp3; this.__i16 = toI16;');
const encodeMp3 = global.__enc;
const toI16 = global.__i16;

const fails = [];
function ok(c, label, extra) {
  console.log((c ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!c) { fails.push(label); }
}

const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const SRT = [44100, 48000, 32000, 0];
function parseMp3(buf) {
  let p = 0, frames = 0, dur = 0, brs = new Set(), srs = new Set(), bad = 0;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xFF || (buf[p + 1] & 0xE0) !== 0xE0) { bad++; p++; continue; }
    const ver = (buf[p + 1] >> 3) & 3, layer = (buf[p + 1] >> 1) & 3;
    const bi = (buf[p + 2] >> 4) & 15, si = (buf[p + 2] >> 2) & 3, pad = (buf[p + 2] >> 1) & 1;
    if (ver !== 3 || layer !== 1 || bi === 0 || bi === 15 || si === 3) { bad++; p++; continue; }
    const len = Math.floor(144 * BR[bi] * 1000 / SRT[si]) + pad;
    if (len < 4 || p + len > buf.length) { break; }
    frames++; brs.add(BR[bi]); srs.add(SRT[si]); dur += 1152 / SRT[si]; p += len;
  }
  return { frames, dur, brs: [...brs], srs: [...srs], bad, leftover: buf.length - p };
}

function fakeAudio(sec, sr, ch, freq) {
  const n = Math.round(sec * sr);
  const data = [];
  for (let c = 0; c < ch; c++) {
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) { f[i] = Math.sin(2 * Math.PI * (freq + c * 110) * i / sr) * 0.4; }
    data.push(f);
  }
  return { sampleRate: sr, duration: sec, numberOfChannels: ch, getChannelData: (c) => data[c] };
}

(async function () {
  console.log('=== toI16 转换 ===');
  const t = toI16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
  console.log('  ' + Array.from(t).join(', '));
  ok(t[0] === 0 && t[1] === 32767 && t[2] === -32768, '0/1/-1 映射正确');
  ok(t[3] === 32767 && t[4] === -32768, '超范围被夹住（不溢出）');

  console.log('=== encodeMp3：单声道 64kbps / 3 秒 ===');
  const a1 = fakeAudio(3, 44100, 1, 440);
  let prog = [];
  const b1 = await encodeMp3(a1, 1, 64, p => prog.push(p));
  const buf1 = Buffer.from(await b1.arrayBuffer());
  const p1 = parseMp3(buf1);
  console.log('  输出 ' + buf1.length + ' 字节，' + p1.frames + ' 帧，' + p1.dur.toFixed(3) + ' 秒，码率 ' + p1.brs.join(','));
  ok(p1.bad === 0, '无非法帧头', 'bad=' + p1.bad);
  ok(Math.abs(p1.dur - 3) < 0.1, '时长 ≈ 3 秒', p1.dur.toFixed(3));
  ok(p1.brs.length === 1 && p1.brs[0] === 64, '码率确实是 64kbps', p1.brs.join(','));
  ok(p1.leftover === 0, '无残余字节', '' + p1.leftover);
  ok(buf1.length > 20000 && buf1.length < 28000, '体积符合 64kbps/3秒（约 24KB）', buf1.length + ' 字节');
  ok(prog.length > 1 && prog[prog.length - 1] === 1, '进度回调被调用且收敛到 1', prog.length + ' 次');

  console.log('=== encodeMp3：立体声 128kbps / 2 秒 ===');
  const a2 = fakeAudio(2, 44100, 2, 300);
  const b2 = await encodeMp3(a2, 2, 128, null);
  const buf2 = Buffer.from(await b2.arrayBuffer());
  const p2 = parseMp3(buf2);
  console.log('  输出 ' + buf2.length + ' 字节，' + p2.frames + ' 帧，' + p2.dur.toFixed(3) + ' 秒，码率 ' + p2.brs.join(','));
  ok(p2.brs.length === 1 && p2.brs[0] === 128, '立体声 128kbps 生效', p2.brs.join(','));
  ok(Math.abs(p2.dur - 2) < 0.1, '时长 ≈ 2 秒', p2.dur.toFixed(3));
  const ratio = buf2.length / 2 / (buf1.length / 3);
  ok(ratio > 1.7 && ratio < 2.3, '128k 立体声 vs 64k 单声道的单位时长比 ≈ 2', ratio.toFixed(2));

  console.log('=== encodeMp3：48kHz（验证非 44100 采样率也能编）===');
  const a3 = fakeAudio(1, 48000, 1, 500);
  const b3 = await encodeMp3(a3, 1, 96, null);
  const buf3 = Buffer.from(await b3.arrayBuffer());
  const p3 = parseMp3(buf3);
  console.log('  输出 ' + buf3.length + ' 字节，采样率 ' + p3.srs.join(','));
  ok(p3.srs.length === 1 && p3.srs[0] === 48000, '48kHz 被正确写入帧头', p3.srs.join(','));
  ok(p3.bad === 0 && p3.leftover === 0, '48kHz 输出同样干净');

  console.log('');
  if (fails.length) { console.log('结果：' + fails.length + ' 项失败 -> ' + fails.join(' / ')); process.exit(1); }
  console.log('结果：全部通过（集成进打包器的压缩流水线真能编出合法 MP3）');
})();
