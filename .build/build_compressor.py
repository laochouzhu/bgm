import os
import re
import hashlib

# 路径由本文件位置推导，换目录 / 换机器都能直接构建
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, '.build')
LAME = os.path.join(ROOT, 'third_party', 'lamejs', 'lame.min.js')
OUT = os.path.join(ROOT, 'MP3压缩器.html')
# 上游 lamejs 1.2.1 原始文件的 sha256（未修改的第三方库）
LAME_SHA256 = '15D285E2587B3BDBFD18A68DE6CE07CC074F7480A82C3815DA2DC1C348EC6DF4'

with open(B + r'\compressor.tpl.html', encoding='utf-8') as f:
    tpl = f.read()
with open(LAME, encoding='utf-8') as f:
    lame = f.read()

raw = open(LAME, 'rb').read()
_sha = hashlib.sha256(raw).hexdigest().upper()
print('lame.min.js  %d 字节  sha256=%s' % (len(raw), _sha))
assert len(raw) == 156043, '编码器字节数不对: %d' % len(raw)
assert _sha == LAME_SHA256, '编码器与上游 lamejs 1.2.1 不一致（sha256=%s）' % _sha
assert '</script' not in lame.lower(), '编码器里含结束标签，会掐断页面'
assert '{{LAME_JS}}' in tpl

html = tpl.replace('{{LAME_JS}}', lame)
assert '{{' not in html, '残留占位符: ' + str(re.findall(r'\{\{\w+\}\}', html))

# 先删后建：旧会话创建的文件本次会话写不了，但可以删
if os.path.exists(OUT):
    try:
        os.remove(OUT)
    except Exception as e:
        print('WARN 无法删除旧文件:', e)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

size = os.path.getsize(OUT)
print('MP3压缩器.html  %d 字节 (%.0f KB)' % (size, size / 1024))

problems = []
if html.count('</script>') != 2:
    problems.append('</script> 数量=%d（应 2）' % html.count('</script>'))
if '<!--' in html:
    problems.append('含 HTML 注释起始符')
if 'lamejs.Mp3Encoder' not in html:
    problems.append('缺 Mp3Encoder')
if 'decodeAudioData' not in html:
    problems.append('缺解码调用')
if 'OfflineAudioContext' not in html:
    problems.append('缺重采样调用')
print('自检:', problems if problems else '通过')
