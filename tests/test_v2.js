/* v2 新逻辑测试：cloneHot 默认值派生 + 播放器每键独立直径（并兼容 v1 的单个数值） */
const fs = require('fs');
const vm = require('vm');

const fails = [];
function ok(c, label, extra) {
  console.log((c ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!c) { fails.push(label); }
}

/* ---------- A. 从打包器模板里抽出真实的 cloneHot ---------- */
const tpl = fs.readFileSync(require('path').join(__dirname, '..', '.build', 'packer.tpl.html'), 'utf8');
const a = tpl.indexOf('function cloneHot(h){');
const b = tpl.indexOf('var align =', a);
if (a < 0 || b < 0) { throw new Error('抽不到 cloneHot'); }
vm.runInThisContext(tpl.slice(a, b) + '\nthis.__cloneHot = cloneHot;');
const cloneHot = global.__cloneHot;

console.log('=== A. cloneHot：默认值派生与拷贝独立性 ===');
const src = { d: 13, x: [1, 2, 3, 4, 5, 6], y: [7, 8, 9, 10, 11, 12] };
const c1 = cloneHot(src);
ok(Array.isArray(c1.d) && c1.d.length === 6, 'v1 的单个数值 d=13 被展开成 6 个', JSON.stringify(c1.d));
ok(c1.d.every(v => v === 13), '展开后每个都是 13');
ok(c1.x.length === 6 && c1.x[5] === 6, 'x 被复制', JSON.stringify(c1.x));
c1.d[2] = 30; c1.x[0] = 99;
ok(src.d === 13, '改动副本不影响原始 d');
ok(src.x[0] === 1, '改动副本不影响原始 x');

const arr = { d: [9, 9, 11, 11, 13, 13], x: [0, 0, 0, 0, 0, 0], y: [0, 0, 0, 0, 0, 0] };
const c2 = cloneHot(arr);
ok(c2.d.length === 6 && c2.d[2] === 11, '已经是数组的 d 原样保留', JSON.stringify(c2.d));
c2.d[0] = 40;
ok(arr.d[0] === 9, '数组型 d 也是深拷贝');

/* ---------- B. 播放器：每键独立直径 + v1 兼容 ---------- */
function El(tag) {
  this.tagName = tag; this.children = []; this.className = ''; this.textContent = '';
  this._attrs = {}; this._handlers = {}; this.src = ''; this.disabled = false;
  this.style = { setProperty: (k, v) => { this._attrs['style:' + k] = String(v); }, width: '' };
}
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.setAttribute = function (k, v) { this._attrs[k] = String(v); };
El.prototype.getAttribute = function (k) { return (k in this._attrs) ? this._attrs[k] : null; };
El.prototype.removeAttribute = function (k) { delete this._attrs[k]; };
El.prototype.addEventListener = function (t, f) { (this._handlers[t] = this._handlers[t] || []).push(f); };
El.prototype.fire = function (t) { (this._handlers[t] || []).forEach(f => f({ preventDefault() {} })); };
Object.defineProperty(El.prototype, 'innerHTML', { get() { return ''; }, set(v) { this.children = []; } });

const PLAYER = fs.readFileSync(require('path').join(__dirname, '..', '.build', 'player.js'), 'utf8');

function runPlayer(hot) {
  const ids = {};
  ['pendant', 'pads', 'photo', 'err', 'errTxt', 'errClose', 'brand', 'brandIn', 'sub', 'tip', 'chips', 'now', 'nowTxt', 'skus']
    .forEach(id => { ids[id] = new El('div'); });
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
  global.Blob = class { constructor(p) { this.size = 1; } };
  global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  global.Audio = function () { return { addEventListener() {}, removeAttribute() {}, load() {}, pause() {}, play() { return Promise.resolve(); } }; };
  // 毛玻璃氛围底会用到的浏览器全局，桩需补齐
  global.Image = function () {
    const o = { onload: null, onerror: null, naturalWidth: 760, naturalHeight: 403, _src: '' };
    Object.defineProperty(o, 'src', { get() { return o._src; }, set(v) { o._src = v; if (o.onload) { o.onload(); } } });
    return o;
  };
  El.prototype.getContext = function () {
    return { drawImage() { }, getImageData() { return { data: [12, 34, 56, 255] }; } };
  };

  const sets = ['blue', 'pink'].map(k => ({
    key: k, name: k, theme: k, img: 'data:image/jpeg;base64,AAAA', ar: 1.85, hot: hot,
    slots: [{ label: 'a', s: 0 }, { label: 'b', s: 0 }, { label: 'c', s: 0 }, { label: 'd', s: 0 }, { label: 'e', s: 0 }, { label: 'f', s: 0 }]
  }));
  global.window.PENDANT_DATA = { mode: 'audio', bank: ['data:audio/mpeg;base64,QUFB'], sets: sets };
  vm.runInThisContext(PLAYER);
  return ids.pads.children;
}

console.log('=== B. 播放器：每键独立直径（v2）===');
const ds = [10, 12, 14, 16, 18, 20];
const pads1 = runPlayer({ d: ds, x: [10, 20, 30, 40, 50, 60], y: [15, 25, 35, 45, 55, 65] });
ok(pads1.length === 6, '生成了 6 个按键', '' + pads1.length);
const got1 = pads1.map(p => p._attrs['style:--d']);
console.log('    --d = ' + got1.join(', '));
ok(got1.join(',') === ds.map(v => v + '%').join(','), '六个键各自用了自己的直径', got1.join(','));
const gotX = pads1.map(p => p._attrs['style:--x']);
ok(gotX[5] === '60%' && gotX[0] === '10%', 'x 坐标逐个应用', gotX.join(','));

console.log('=== B2. 兼容 v1 的单个数值 ===');
const pads2 = runPlayer({ d: 13, x: [1, 2, 3, 4, 5, 6], y: [1, 2, 3, 4, 5, 6] });
const got2 = pads2.map(p => p._attrs['style:--d']);
console.log('    --d = ' + got2.join(', '));
ok(got2.every(v => v === '13%'), 'v1 老成品：单个 d 值对六个键都生效', got2.join(','));

console.log('=== B3. d 缺失时的兜底 ===');
const pads3 = runPlayer({ x: [1, 2, 3, 4, 5, 6], y: [1, 2, 3, 4, 5, 6] });
const got3 = pads3.map(p => p._attrs['style:--d']);
ok(got3.every(v => v === '13%'), '没有 d 时退回 13%', got3.join(','));

console.log('');
if (fails.length) { console.log('结果：' + fails.length + ' 项失败 -> ' + fails.join(' / ')); process.exit(1); }
console.log('结果：全部通过');
