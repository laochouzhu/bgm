import base64
import hashlib
import json
import os
import re

# 路径全部由本文件位置推导，换目录 / 换机器都能直接构建（不再写死绝对路径）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, '.build')
W = os.path.join(ROOT, '.work')          # 中间产物与自检输出，不进版本库
ASSETS = os.path.join(ROOT, 'assets')    # 默认挂件图，进版本库
LAME_PATH = os.path.join(ROOT, 'third_party', 'lamejs', 'lame.min.js')
VER = 'v2'
# 上游 lamejs 1.2.1 原始文件的 sha256：构建时校验，确保内嵌的是未修改的第三方库
LAME_SHA256 = '15D285E2587B3BDBFD18A68DE6CE07CC074F7480A82C3815DA2DC1C348EC6DF4'
os.makedirs(W, exist_ok=True)

with open(os.path.join(B, 'player.css'), encoding='utf-8') as f:
    CSS = f.read().rstrip('\n')
with open(os.path.join(B, 'player.body.html'), encoding='utf-8') as f:
    BODY = f.read().rstrip('\n')
with open(os.path.join(B, 'player.js'), encoding='utf-8') as f:
    JS = f.read().rstrip('\n')
with open(os.path.join(B, 'packer.tpl.html'), encoding='utf-8') as f:
    TPL = f.read()
with open(LAME_PATH, encoding='utf-8') as f:
    LAME = f.read()

HOT = {
    'blue': {'d': 13, 'x': [45.39, 61.58, 75.26, 46.32, 61.18, 75.66],
             'y': [26.05, 21.84, 24.81, 71.22, 74.44, 71.46]},
    'pink': {'d': 13, 'x': [25.61, 41.06, 56.67, 24.85, 38.79, 54.70],
             'y': [26.59, 23.82, 27.98, 74.79, 78.95, 75.07]},
}
AR = {'blue': 1.8859, 'pink': 1.8283}


IMG_MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.webp': 'image/webp', '.gif': 'image/gif'}


def data_url(path):
    with open(path, 'rb') as f:
        raw = f.read()
    mime = IMG_MIME.get(os.path.splitext(path)[1].lower(), 'application/octet-stream')
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii'), len(raw)


IMG = {}
IMG_BYTES = {}
# 默认挂件图：从水彩原图裁切（**保留水彩背景**，不做抠图），黑底上就是一张完整的水彩图
IMG_FILES = {'blue': 'img_blue.jpg', 'pink': 'img_pink.jpg'}


def asset_path(name):
    """默认图放 assets/；兼容旧布局（图在 .work/）时自动回退。"""
    p = os.path.join(ASSETS, name)
    return p if os.path.exists(p) else os.path.join(W, name)


for k in ('blue', 'pink'):
    IMG[k], IMG_BYTES[k] = data_url(asset_path(IMG_FILES[k]))

BUILD_INFO = ('默认挂件图：蓝 %d KB、粉 %d KB（从原图裁出，6 个按键位置是实测对齐的）。'
              '不换图就完全沿用这个默认，成品和之前一模一样；要换就到下面第 2 节，换完自己拖动六个圈对位。'
              % (IMG_BYTES['blue'] / 1024, IMG_BYTES['pink'] / 1024))


def js_str(s):
    t = json.dumps(s, ensure_ascii=False)
    t = t.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    return t.replace('<', '\\u003c')


def safe_json(obj):
    t = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    t = t.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    return t.replace('<', '\\u003c')


def html_escape(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def product(data):
    head = ('<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
            '<meta name="theme-color" content="#000000">\n'
            '<meta name="generator" content="重生短剧按键挂件打包器 ' + VER + '">\n'
            '<title>' + html_escape(data['title']) + '</title>\n'
            '<style>\n' + CSS + '\n</style>\n</head>\n<body class="">\n')
    tail = ('\n<script>window.PENDANT_DATA=' + safe_json(data) + ';</script>\n'
            '<script>\n' + JS + '\n</script>\n</body>\n</html>\n')
    return head + BODY + tail


def hot6(h):
    """v2：每个键可以有自己的直径。老格式是单个数值，这里统一展开成 6 个。"""
    d = h['d']
    da = list(d) if isinstance(d, list) else [d] * 6
    return {'d': da, 'x': list(h['x']), 'y': list(h['y'])}


DEMO_SLOTS = {
    'blue': ['心跳', '鼓点', '仙气', '悬疑', '唢呐', '叮咚'],
    'pink': ['甜妹', '跺脚', '委屈', '撒糖', '闪回', '暴击'],
}
demo = {
    'ver': VER,
    'title': '重生短剧按键挂件 试玩版',
    'brand': '重生短剧按键挂件',
    'sub': 'AI短句BGM 一按就有梗',
    'chips': ['按键发声', '热门短句', '随身挂饰'],
    'tip': '点一下开始循环 · 再点一下停止',
    'mode': 'synth',
    'bank': [],
    'sets': [
        {'key': k, 'name': '男主款' if k == 'blue' else '女主款',
         'theme': k, 'img': IMG[k], 'ar': AR[k], 'hot': hot6(HOT[k]),
         'slots': [{'label': l, 's': -1} for l in DEMO_SLOTS[k]]}
        for k in ('blue', 'pink')
    ],
}

demo_html = product(demo)

packer = TPL
for token, val in [
    ('{{CSS_JS}}', js_str(CSS)),
    ('{{BODY_JS}}', js_str(BODY)),
    ('{{JS_JS}}', js_str(JS)),
    ('{{IMG_BLUE}}', js_str(IMG['blue'])),
    ('{{IMG_PINK}}', js_str(IMG['pink'])),
    ('{{HOT_JS}}', json.dumps(HOT, ensure_ascii=False)),
    ('{{AR_JS}}', json.dumps(AR)),
    ('{{BUILD_INFO}}', js_str(BUILD_INFO)),
    ('{{LAME_JS}}', LAME),
    ('{{VER_JS}}', js_str(VER)),
    ('{{VER}}', VER),
]:
    assert token in packer, 'missing token ' + token
    packer = packer.replace(token, val)
assert '{{' not in packer, 'leftover placeholder: ' + str(re.findall(r'\{\{\w+\}\}', packer))

def write_out(path, text):
    """先删后建：旧会话创建的文件只授权给旧的沙箱标识，本次会话写不了，但可以删。"""
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception as e:
            print('WARN: 无法删除 %s -> %s' % (os.path.basename(path), e))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


write_out(os.path.join(ROOT, '试玩版.html'), demo_html)
write_out(os.path.join(ROOT, '打包器.html'), packer)

# ---- 自检 ----
problems = []


def count(h, sub):
    return h.count(sub)


if count(demo_html, '</script>') != 2:
    problems.append('试玩版 </script> 数量 = %d（应为 2）' % count(demo_html, '</script>'))
if count(packer, '</script>') != 2:
    problems.append('打包器 </script> 数量 = %d（应为 2：编码器 + 自身脚本）' % count(packer, '</script>'))
_lame_bytes = LAME.encode('utf-8')
if len(_lame_bytes) != 156043:
    problems.append('lame.min.js 字节数 = %d（应 156043）' % len(_lame_bytes))
_lame_sha = hashlib.sha256(_lame_bytes).hexdigest().upper()
if _lame_sha != LAME_SHA256:
    problems.append('lame.min.js 与上游 lamejs 1.2.1 不一致（sha256=%s）；若确实修改过，必须同步更新 '
                    'third_party/lamejs/ 的 LICENSE 与 THIRD-PARTY-NOTICES.md' % _lame_sha)
if '</script' in LAME.lower():
    problems.append('lame.min.js 里含结束标签，会掐断打包器页面')
if count(packer, '<!--') or count(demo_html, '<!--'):
    problems.append('出现 HTML 注释起始符')
for nm, src in (('css', CSS), ('body', BODY), ('js', JS)):
    if '`' in src:
        problems.append('player.%s 含反引号' % nm)
    if '${' in src:
        problems.append('player.%s 含 ${ 插值' % nm)
    if '</script' in src:
        problems.append('player.%s 含真实结束标签' % nm)

# 提取打包器的两个脚本块（编码器 + 自身）供 node --check 校验。
# 注意：不能用 rfind('<script>')——打包器源码里 buildHtml 含有字面字符串 '<script>'，
# 会命中它而不是真正的开标签。用正则按出现顺序取。
_pk = re.findall(r'<script>(.*?)</script>', packer, re.S)
if len(_pk) != 2:
    problems.append('打包器脚本块 = %d（应为 2）' % len(_pk))
else:
    with open(os.path.join(W, 'check_packer_lame.js'), 'w', encoding='utf-8') as f:
        f.write(_pk[0])
    with open(os.path.join(W, 'check_packer.js'), 'w', encoding='utf-8') as f:
        f.write(_pk[1])

parts = re.findall(r'<script>(.*?)</script>', demo_html, re.S)
with open(os.path.join(W, 'check_demo_data.js'), 'w', encoding='utf-8') as f:
    f.write(parts[0])
with open(os.path.join(W, 'check_demo_player.js'), 'w', encoding='utf-8') as f:
    f.write(parts[1])
if len(parts) != 2:
    problems.append('试玩版脚本块 = %d（应为 2）' % len(parts))

print('试玩版.html   %8d bytes  (%.0f KB)' % (os.path.getsize(os.path.join(ROOT, '试玩版.html')),
                                              os.path.getsize(os.path.join(ROOT, '试玩版.html')) / 1024))
print('打包器.html   %8d bytes  (%.0f KB)' % (os.path.getsize(os.path.join(ROOT, '打包器.html')),
                                              os.path.getsize(os.path.join(ROOT, '打包器.html')) / 1024))
print('图片内嵌      blue %d KB  pink %d KB' % (IMG_BYTES['blue'] / 1024, IMG_BYTES['pink'] / 1024))
print('自检问题:', problems if problems else '无')
