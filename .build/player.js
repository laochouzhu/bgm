(function(){
var D = window.PENDANT_DATA || {};
var SETS = (D.sets && D.sets.length) ? D.sets : [{ key: 'blue', name: '男主款', theme: 'blue', ar: 1.85, hot: {}, slots: D.slots || [] }];
var cur = 0;
var S = [];

var pend = document.getElementById('pendant');
var padsBox = document.getElementById('pads');
var photo = document.getElementById('photo');
var errBox = document.getElementById('err');
var errTxt = document.getElementById('errTxt');

function showErr(msg){
  try { errTxt.textContent = String(msg); errBox.style.display = 'block'; } catch(e){}
}
window.onerror = function(m, src, line){
  showErr('脚本错误：' + m + '（第' + line + '行）');
  return false;
};
window.addEventListener('unhandledrejection', function(ev){
  var r = ev.reason;
  showErr('运行错误：' + ((r && r.message) ? r.message : r));
});
try { document.getElementById('errClose').onclick = function(){ errBox.style.display = 'none'; }; } catch(e){}

document.getElementById('brandIn').textContent = D.brand || '';
document.getElementById('brand').setAttribute('data-t', D.brand || '');
document.getElementById('sub').textContent = D.sub || '';
document.getElementById('tip').textContent = D.tip || '';
(function(){
  var host = document.getElementById('chips');
  var arr = D.chips || [];
  for (var i = 0; i < arr.length; i++) {
    var sp = document.createElement('span');
    sp.className = 'chip';
    sp.textContent = arr[i];
    host.appendChild(sp);
  }
})();

var padEls = [], baseCls = [], audios = [], synths = [], current = -1, ctx = null, playSeq = 0;
var nowTimer = null;

function slotSrc(sl){
  /* 新格式：slots[i].s 是在 D.bank 里的下标，同一首歌只内嵌一次。
     旧格式：slots[i].src 直接放 data URL。两种都支持。 */
  if (!sl) { return ''; }
  if (typeof sl.s === 'number' && sl.s >= 0) { return (D.bank && D.bank[sl.s]) || ''; }
  return sl.src || '';
}
function activeSlots(){
  var s = SETS[cur] || {};
  if (!s.slots || !s.slots.length) { s = SETS[0] || {}; }
  return s.slots || [];
}
function isPlayable(i){
  if (D.mode === 'synth') { return true; }
  return !!slotSrc(S[i]);
}
function setOn(i, on){ if (padEls[i]) { padEls[i].className = baseCls[i] + (on ? ' on' : ''); } }
function setNow(txt, playing){
  var box = document.getElementById('now');
  var t = document.getElementById('nowTxt');
  if (nowTimer) { clearTimeout(nowTimer); nowTimer = null; }
  if (txt) { t.textContent = '当前音效：' + txt; }
  if (playing) { box.className = 'now on live'; return; }
  if (!t.textContent) { box.className = 'now'; return; }
  box.className = 'now on';
  nowTimer = setTimeout(function(){ t.textContent = ''; box.className = 'now'; }, 1500);
}
function setAmbient(src){
  var layer = document.getElementById('bgImg');
  if (layer) { layer.style.backgroundImage = src ? ('url("' + src + '")') : 'none'; }
  if (!src) { return; }
  /* 再用 canvas 取一次平均色当兜底底色（图片加载失败 / 模糊层被禁用时也有对的颜色） */
  var probe = new Image();
  probe.onload = function(){
    try {
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      var g = c.getContext('2d');
      g.drawImage(probe, 0, 0, 1, 1);
      var d = g.getImageData(0, 0, 1, 1).data;
      var col = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
      document.body.style.setProperty('--page', col);
      var b = document.getElementById('bg');
      if (b) { b.style.background = col; }
    } catch (e) {}
  };
  probe.src = src;
}
function applySet(){
  var s = SETS[cur] || {};
  document.body.className = (s.theme === 'pink') ? 'pink' : '';
  pend.style.setProperty('--ar', String(s.ar || 1.85));
  photo.src = s.img || '';
  setAmbient(s.img || '');
  var bs = document.getElementsByClassName('sku');
  for (var i = 0; i < bs.length; i++) {
    bs[i].className = (bs[i].getAttribute('data-k') === String(cur)) ? 'sku on' : 'sku';
  }
}
function buildSkus(){
  var host = document.getElementById('skus');
  for (var i = 0; i < SETS.length; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sku';
    b.setAttribute('data-k', String(i));
    b.textContent = SETS[i].name || ('款' + (i + 1));
    (function(el, idx){ el.addEventListener('click', function(){ switchSet(idx); }, false); })(b, i);
    host.appendChild(b);
  }
}
function disposeAudio(){
  for (var i = 0; i < audios.length; i++) {
    var a = audios[i];
    if (!a) { continue; }
    try { a.pause(); } catch(e){}
    try { a.removeAttribute('src'); a.load(); } catch(e){}
    try { if (a._blob) { URL.revokeObjectURL(a._blob); a._blob = null; } } catch(e){}
  }
  audios = [];
}
function switchSet(k){
  if (k === cur) { return; }
  stopCurrent();
  disposeAudio();
  cur = k;
  S = activeSlots();
  applySet();
  buildPads();
  setNow(null, false);
}
function buildPads(){
  padsBox.innerHTML = '';
  padEls = [];
  baseCls = [];
  var s = SETS[cur] || {};
  var hot = s.hot || {};
  var hx = hot.x || [44.6, 59.8, 75.3, 46.6, 61.9, 76.0];
  var hy = hot.y || [26.5, 22.5, 23.6, 72.1, 75.7, 69.7];
  var hd = hot.d || 13;
  var hdArr = (hd && hd.length) ? hd : null;
  for (var i = 0; i < 6; i++) {
    var dv = hdArr ? (hdArr[i] || hdArr[0] || 13) : hd;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pad';
    b.setAttribute('data-i', String(i));
    b.style.setProperty('--x', hx[i] + '%');
    b.style.setProperty('--y', hy[i] + '%');
    b.style.setProperty('--d', dv + '%');
    var ic = document.createElement('i');
    b.appendChild(ic);
    if (!isPlayable(i)) { b.className = 'pad empty'; b.disabled = true; }
    padsBox.appendChild(b);
    padEls.push(b);
    baseCls.push(isPlayable(i) ? 'pad' : 'pad empty');
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    (function(el, idx){
      el.addEventListener('click', function(){ toggle(idx); }, false);
    })(b, i);
  }
}

function getCtx(){
  if (ctx) { return ctx; }
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { return null; }
  ctx = new AC();
  return ctx;
}

function srcToUrl(raw){
  /* 关键：Chrome 的 data: URL 有 2MB 长度上限，超出的会被网络层拒绝，音频拿不到数据。
     所以运行时把 base64 解成 Blob URL（blob: 没有长度上限）。 */
  if (!raw) { return ''; }
  if (raw.indexOf('data:') !== 0) { return raw; }
  var i = raw.indexOf(',');
  if (i < 0) { return raw; }
  var head = raw.slice(0, i);
  var semi = head.indexOf(';');
  var mime = head.slice(5, semi > 0 ? semi : head.length) || 'audio/mpeg';
  var b64 = raw.slice(i + 1);
  try {
    var bin = atob(b64);
    var n = bin.length;
    var u8 = new Uint8Array(n);
    for (var k = 0; k < n; k++) { u8[k] = bin.charCodeAt(k); }
    return URL.createObjectURL(new Blob([u8], { type: mime }));
  } catch (e) {
    return raw;
  }
}
function ensureAudio(i){
  if (audios[i]) { return audios[i]; }
  var s = S[i];
  var raw = slotSrc(s);
  if (!raw) { return null; }
  var a = new Audio();
  a.loop = true;
  a.preload = 'auto';
  a.volume = 0;
  a.src = srcToUrl(raw);
  if (a.src.indexOf('blob:') === 0) { a._blob = a.src; }
  a._stopTok = 0;
  a.addEventListener('error', function(){
    var e = a.error;
    showErr('第 ' + (i + 1) + ' 个键的音频加载失败'
      + (e ? ('（错误码 code ' + e.code + '）') : '')
      + '。多半是这个文件太大、手机解不开。');
  });
  audios[i] = a;
  return a;
}
function fade(a, to, ms, done){
  if (a._ft) { clearInterval(a._ft); a._ft = null; }
  var from = a.volume;
  if (typeof from !== 'number' || isNaN(from)) { from = 0; }
  var steps = Math.max(1, Math.round(ms / 30)), n = 0;
  a._ft = setInterval(function(){
    n++;
    var v = from + (to - from) * (n / steps);
    if (v < 0) { v = 0; }
    if (v > 1) { v = 1; }
    try { a.volume = v; } catch(e){}
    if (n >= steps) {
      clearInterval(a._ft);
      a._ft = null;
      if (done) { done(); }
    }
  }, 30);
}
function startAudio(i){
  var a = ensureAudio(i);
  if (!a) { showErr('第 ' + (i + 1) + ' 个按键还没有音频'); return; }
  var my = ++playSeq;
  a._stopTok = 0;
  try { a.currentTime = 0; } catch(e){}
  /* 不再把淡入吊在 play() 的 promise 上。
     手机上大文件解析慢时 promise 可能长时间不兑现，音量若一直停在 0，
     就会表现成"灯亮着、其实在放、但没声"，而且因为没 reject 连错误条都不弹。 */
  try { a.volume = 1; } catch(e){}
  var p = a.play();
  if (p && typeof p.then === 'function') {
    p.catch(function(err){
      if (my !== playSeq) { return; }
      setOn(i, false);
      if (current === i) { current = -1; }
      setNow(null, false);
      showErr('播放失败：' + ((err && err.name) ? err.name + ' — ' : '') + ((err && err.message) ? err.message : err));
    });
  }
  /* 自诊断：1.5 秒后如果还没真正出声，就把元素状态摊开显示，方便远程定位。 */
  setTimeout(function(){
    if (my !== playSeq || current !== i) { return; }
    if (a.paused || a.currentTime < 0.05) {
      showErr('按下去了但没出声。诊断：readyState=' + a.readyState
        + ' networkState=' + a.networkState
        + ' paused=' + a.paused
        + ' currentTime=' + a.currentTime.toFixed(2)
        + ' duration=' + (isFinite(a.duration) ? a.duration.toFixed(1) : String(a.duration))
        + ' volume=' + a.volume
        + ' error=' + (a.error ? a.error.code : 'none')
        + ' src=' + (a.src.indexOf('blob:') === 0 ? 'blob' : (a.src.indexOf('data:') === 0 ? 'data' : 'other')));
    }
  }, 1500);
}
function stopAudio(i){
  var a = audios[i];
  if (!a) { return; }
  var my = ++playSeq;
  a._stopTok = my;
  fade(a, 0, 120, function(){
    if (a._stopTok !== my) { return; }
    try { a.pause(); } catch(e){}
    try { a.currentTime = 0; } catch(e){}
  });
}

var SYN_MS = [700, 250, 170, 800, 200, 1000];
function makeSynth(i){
  var c = getCtx();
  if (!c) { return null; }
  if (c.state === 'suspended' && c.resume) { c.resume(); }
  var master = c.createGain();
  master.gain.value = 0.0001;
  master.connect(c.destination);
  var t0 = c.currentTime;
  try {
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(0.9, t0 + 0.15);
  } catch(e){ master.gain.value = 0.9; }
  var nodes = [], timer = null, step = 0, stopped = false;

  function beep(freq, dur, type, vol, when){
    var t = when || c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    try {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } catch(e){ g.gain.value = vol * 0.6; }
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
    nodes.push(o);
    if (nodes.length > 90) { nodes.splice(0, 45); }
  }
  function noise(dur, vol){
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var k = 0; k < len; k++) { d[k] = (Math.random() * 2 - 1) * (1 - k / len); }
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.start();
    nodes.push(src);
  }
  function drone(){
    var o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter();
    o1.type = 'sawtooth';
    o1.frequency.value = 78;
    o2.type = 'sawtooth';
    o2.frequency.value = 78.7;
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(master);
    o1.start();
    o2.start();
    nodes.push(o1);
    nodes.push(o2);
  }
  function tick(){
    var t = c.currentTime + 0.03;
    if (i === 0) {
      if (step % 2 === 0) { beep(58, 0.18, 'sine', 0.95, t); beep(48, 0.16, 'sine', 0.7, t + 0.2); }
    } else if (i === 1) {
      noise(0.09, 0.45);
      beep(72, 0.13, 'sine', 0.9, t);
      if (step % 2 === 1) { noise(0.03, 0.2); }
    } else if (i === 2) {
      var arp = [523, 659, 784, 988, 1175, 988, 784, 659];
      beep(arp[step % 8], 0.2, 'triangle', 0.28, t);
    } else if (i === 3) {
      if (step === 0) { drone(); }
    } else if (i === 4) {
      var mel = [392, 523, 659, 880, 659, 523, 392, 330];
      beep(mel[step % 8], 0.14, 'square', 0.13, t);
    } else {
      var bl = [1046, 1318];
      beep(bl[step % 2], 0.9, 'sine', 0.22, t);
    }
    step++;
  }
  tick();
  timer = setInterval(tick, SYN_MS[i]);
  return {
    stop: function(){
      if (stopped) { return; }
      stopped = true;
      if (timer) { clearInterval(timer); timer = null; }
      var t = c.currentTime;
      try {
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.18);
      } catch(e){}
      setTimeout(function(){
        for (var k = 0; k < nodes.length; k++) { try { nodes[k].stop(); } catch(e){} }
        try { master.disconnect(); } catch(e){}
      }, 280);
    }
  };
}

function stopCurrent(){
  if (current < 0) { return; }
  var i = current;
  current = -1;
  if (D.mode === 'synth') {
    if (synths[i]) { synths[i].stop(); synths[i] = null; }
  } else {
    stopAudio(i);
  }
  setOn(i, false);
  setNow(null, false);
}
function toggle(i){
  if (!isPlayable(i)) { showErr('这个位置还没放音频'); return; }
  if (current === i) { stopCurrent(); return; }
  stopCurrent();
  current = i;
  setOn(i, true);
  setNow((S[i] && S[i].label) || ('键' + (i + 1)), true);
  if (D.mode === 'synth') {
    var s = makeSynth(i);
    if (s) {
      synths[i] = s;
    } else {
      showErr('这个浏览器不支持 Web Audio，试玩音放不出来。换成真实音频文件就能响。');
      setOn(i, false);
      current = -1;
      setNow(null, false);
    }
  } else {
    startAudio(i);
  }
}

buildSkus();
S = activeSlots();
applySet();
buildPads();
})();
