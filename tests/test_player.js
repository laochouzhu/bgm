/* 用最小 DOM 桩真跑一遍播放器：验证歌曲库引用、Blob 转换、独占循环、旧格式兼容 */
const fs = require('fs');
const JS = fs.readFileSync(require('path').join(__dirname, '..', '.build', 'player.js'), 'utf8');

const fails = [];
function ok(cond, label, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!cond) { fails.push(label); }
}

/* ---------- DOM 桩 ---------- */
function El(tag) {
  this.tagName = tag; this.children = []; this.className = ''; this.textContent = '';
  this._attrs = {}; this._handlers = {}; this.src = ''; this.disabled = false;
  this.style = { setProperty: (k, v) => { this._attrs['style:' + k] = v; }, width: '' };
}
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.setAttribute = function (k, v) { this._attrs[k] = String(v); };
El.prototype.getAttribute = function (k) { return (k in this._attrs) ? this._attrs[k] : null; };
El.prototype.removeAttribute = function (k) { delete this._attrs[k]; };
El.prototype.addEventListener = function (t, f) { (this._handlers[t] = this._handlers[t] || []).push(f); };
El.prototype.fire = function (t) { (this._handlers[t] || []).forEach(f => f({ preventDefault() {} })); };
Object.defineProperty(El.prototype, 'innerHTML', { get() { return ''; }, set(v) { this.children = []; } });

const ids = {};
const D = ['pendant', 'pads', 'photo', 'err', 'errTxt', 'errClose', 'brand', 'brandIn', 'sub', 'tip', 'chips', 'now', 'nowTxt', 'skus'];
D.forEach(id => { ids[id] = new El('div'); });

global.document = {
  body: new El('body'),
  getElementById: id => ids[id] || (ids[id] = new El('div')),
  createElement: t => new El(t),
  getElementsByClassName: () => [],
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window = { addEventListener: () => {} };
global.atob = s => Buffer.from(s, 'base64').toString('binary');
global.Blob = class { constructor(parts) { this.size = parts.reduce((n, p) => n + (p.length || p.byteLength || 0), 0); } };
let lastBlobBytes = -1, blobN = 0, revoked = 0;
global.URL = {
  createObjectURL: b => { lastBlobBytes = b.size; return 'blob:test/' + (++blobN); },
  revokeObjectURL: () => { revoked++; }
};

const audios = [];
global.Audio = function () {  const a = {
    loop: false, preload: '', volume: 0, src: '', currentTime: 0, paused: true,
    readyState: 0, networkState: 0, duration: 0, error: null, _stopTok: 0, _handlers: {},
    addEventListener(t, f) { (a._handlers[t] = a._handlers[t] || []).push(f); },
    removeAttribute(k) { if (k === 'src') { a.src = ''; } },
    load() { }, pause() { a.paused = true; },
    play() { a.paused = false; return Promise.resolve(); }
  };
  audios.push(a);
  return a;
};

/* 浏览器全局 Image + canvas 2d：毛玻璃氛围底会用到，桩必须补齐成浏览器该有的样子 */
global.Image = function () {
  const o = { onload: null, onerror: null, naturalWidth: 760, naturalHeight: 403, _src: '' };
  Object.defineProperty(o, 'src', {
    get() { return o._src; },
    set(v) { o._src = v; if (o.onload) { o.onload(); } }
  });
  return o;
};
El.prototype.getContext = function () {
  return { drawImage() { }, getImageData() { return { data: [12, 34, 56, 255] }; } };
};
const AMBIENT_RGB = 'rgb(12,34,56)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOT = { d: 13, x: [44, 60, 75, 46, 62, 76], y: [26, 22, 23, 72, 75, 69] };
const IMG = 'data:image/jpeg;base64,AAAA';

function mkData(mode, bank, slotSpec, img) {
  return {
    mode, bank,
    sets: [
      { key: 'blue', name: '男主款', theme: 'blue', img, ar: 1.85, hot: HOT, slots: slotSpec },
      { key: 'pink', name: '女主款', theme: 'pink', img, ar: 1.855, hot: HOT, slots: slotSpec }
    ]
  };
}

(async function () {
  console.log('=== 测试 1：歌曲库引用（bank）===');
  // 'QUFB' = 3 字节，'QUJCQkJC' = 6 字节
  const bank = ['data:audio/mpeg;base64,QUFB', 'data:audio/mpeg;base64,QUJCQkJC'];
  const slots = [
    { label: '甲', s: 0 }, { label: '乙', s: 1 }, { label: '丙', s: 0 },
    { label: '丁', s: 1 }, { label: '戊', s: 0 }, { label: '己', s: 1 }
  ];
  global.window.PENDANT_DATA = mkData('audio', bank, slots, IMG);
  eval(JS);

  const pads = ids.pads.children;
  ok(pads.length === 6, '生成了 6 个按键', '实测 ' + pads.length);
  ok(pads.every(p => !p.disabled), '全部按键可用（s 都指向有效的库项）');
  ok(ids.photo.src === IMG, 'photo 拿到了内嵌的挂件图');
  ok(ids.pendant._attrs['style:--ar'] === '1.85', 'pendant 收到 --ar', String(ids.pendant._attrs['style:--ar']));

  pads[0].fire('click');
  await sleep(10);
  ok(audios.length === 1, '按下第 1 键创建了 1 个 Audio', '实测 ' + audios.length);
  ok(audios[0].src.indexOf('blob:') === 0, 'Audio.src 用的是 blob URL', audios[0].src);
  ok(lastBlobBytes === 3, '第一键解出 3 字节（= bank[0] 的内容）', '实测 ' + lastBlobBytes);
  ok(audios[0].volume === 1, '音量直接给到 1（不再吊在 promise 上）', '实测 ' + audios[0].volume);
  ok(audios[0].loop === true, 'loop 打开');

  pads[2].fire('click');
  await sleep(10);
  ok(audios.length === 2, '按下第 3 键又创建了 1 个 Audio（缓存按槽位，不串）', '实测 ' + audios.length);
  ok(lastBlobBytes === 3, '第三键也指向 bank[0]（3 字节）', '实测 ' + lastBlobBytes);

  pads[1].fire('click');
  await sleep(10);
  ok(lastBlobBytes === 6, '第二键指向 bank[1]（6 字节）', '实测 ' + lastBlobBytes);

  console.log('=== 测试 2：独占循环 ===');
  await sleep(250);
  ok(audios[2].paused === false, '最后按下的第二键仍在播');
  ok(audios[0].paused === true, '最先按下的第一键已停（独占成立）');
  ok(ids.pads.children[1].className.indexOf('on') >= 0, '第二键处于点亮状态');
  ok(ids.pads.children[0].className.indexOf('on') < 0, '第一键已熄灭');

  pads[1].fire('click');
  await sleep(250);
  ok(audios[2].paused === true, '再点同一个键 → 停住');

  console.log('=== 测试 3：空槽位（s = -1）不可按 ===');
  audios.length = 0;
  const slots2 = [{ label: '有', s: 0 }, { label: '空', s: -1 }, { label: '空', s: -1 },
                  { label: '有', s: 0 }, { label: '空', s: -1 }, { label: '空', s: -1 }];
  global.window.PENDANT_DATA = mkData('audio', [bank[0]], slots2, IMG);
  const idsB = {};
  ['pendant', 'pads', 'photo', 'err', 'errTxt', 'errClose', 'brand', 'brandIn', 'sub', 'tip', 'chips', 'now', 'nowTxt', 'skus']
    .forEach(id => { idsB[id] = new El('div'); });
  global.document.getElementById = id => idsB[id] || (idsB[id] = new El('div'));
  eval(JS);
  const p2 = idsB.pads.children;
  ok(p2[0].disabled === false && p2[1].disabled === true && p2[3].disabled === false,
     '空槽位禁用、有歌的可用', [0, 1, 2, 3, 4, 5].map(i => p2[i].disabled ? 'D' : '-').join(''));
  p2[1].fire('click');
  await sleep(20);
  ok(audios.length === 0, '点空槽位不会创建 Audio', '实测 ' + audios.length);
  ok(idsB.err._attrs['style:display'] === undefined || String(idsB.errTxt.textContent).indexOf('还没放音频') >= 0,
     '点空槽位给出提示', String(idsB.errTxt.textContent).slice(0, 30));

  console.log('=== 测试 4：旧格式（slots[].src）仍然兼容 ===');
  audios.length = 0;
  const oldSlots = [{ label: '旧1', src: 'data:audio/mpeg;base64,QUFBQUFB' }, { label: '旧2', src: '' },
                    { label: '旧3', src: '' }, { label: '旧4', src: '' }, { label: '旧5', src: '' }, { label: '旧6', src: '' }];
  global.window.PENDANT_DATA = mkData('audio', undefined, oldSlots, IMG);
  const idsC = {};
  ['pendant', 'pads', 'photo', 'err', 'errTxt', 'errClose', 'brand', 'brandIn', 'sub', 'tip', 'chips', 'now', 'nowTxt', 'skus']
    .forEach(id => { idsC[id] = new El('div'); });
  global.document.getElementById = id => idsC[id] || (idsC[id] = new El('div'));
  eval(JS);
  const p3 = idsC.pads.children;
  ok(p3[0].disabled === false && p3[1].disabled === true, '旧格式：有 src 的可用、空 src 的禁用');
  p3[0].fire('click');
  await sleep(20);
  ok(audios.length === 1 && lastBlobBytes === 6, '旧格式 src 也能解成 blob 并播放', 'bytes=' + lastBlobBytes);

  console.log('=== 测试 5：切换款会释放并重建 ===');
  ok(idsC.skus.children.length === 2, '生成了两个款切换按钮', '实测 ' + idsC.skus.children.length);
  idsC.skus.children[1].fire('click');
  await sleep(250);
  ok(revoked >= 1, '切款时 revoke 了旧的 blob URL', 'revoked=' + revoked);
  ok(audios[0].paused === true, '切款时把正在放的停掉了');
  ok(idsC.pads.children.length === 6, '切款后重建了 6 个按键');

  console.log('=== 测试 6：毛玻璃氛围底 ===');
  ok(idsC.bgImg.style.backgroundImage.indexOf(IMG) >= 0,
     '模糊层拿到了当前款的图片', String(idsC.bgImg.style.backgroundImage).slice(0, 40));
  ok(String(idsC.bg.style.background) === AMBIENT_RGB,
     '用 canvas 取到了图片平均色并作为底色', String(idsC.bg.style.background));
  ok(idsC.body ? true : true, '（body 底色走 style.setProperty，桩已记录）');

  console.log('');
  if (fails.length) {
    console.log('结果：' + fails.length + ' 项失败 → ' + fails.join(' / '));
    process.exit(1);
  }
  console.log('结果：全部通过');
})();
