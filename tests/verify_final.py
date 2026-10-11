import base64
import io
import json
import os
import re
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.work')
os.makedirs(W, exist_ok=True)

demo = open(os.path.join(ROOT, '试玩版.html'), encoding='utf-8').read()
pack = open(os.path.join(ROOT, '打包器.html'), encoding='utf-8').read()

m = re.search(r'window\.PENDANT_DATA=(.*?);</script>', demo, re.S)
assert m, 'demo 数据脚本没找到'
data = json.loads(m.group(1))
print('=== 试玩版内嵌数据（v2）===')
print('title=%s  mode=%s  ver=%s  brand=%s' % (data['title'], data['mode'], data.get('ver'), data['brand']))
print('chips=%s   bank=%d 首' % (data['chips'], len(data.get('bank') or [])))
print()

fails = []


def ok(c, label, extra=''):
    print(('  PASS  ' if c else '  FAIL  ') + label + (('   ' + extra) if extra else ''))
    if not c:
        fails.append(label)


for s in data['sets']:
    raw = base64.b64decode(s['img'].split(',', 1)[1])
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    w, h = im.size
    print('%-5s %-4s theme=%-5s img=%dx%d bytes=%d 声明比例=%.4f 实际=%.4f'
          % (s['key'], s['name'], s['theme'], w, h, len(raw), s['ar'], w / h))
    print('      hot.d = %s' % json.dumps(s['hot']['d']))
    print('      hot.x = %s' % json.dumps(s['hot']['x']))
    print('      hot.y = %s' % json.dumps(s['hot']['y']))
    ok(abs(s['ar'] - w / h) < 0.01, s['key'] + '：声明比例与实际一致', '%.4f vs %.4f' % (s['ar'], w / h))
    ok(isinstance(s['hot']['d'], list) and len(s['hot']['d']) == 6, s['key'] + '：d 是 6 个元素的数组')
    ok(len(s['hot']['x']) == 6 and len(s['hot']['y']) == 6, s['key'] + '：x/y 各 6 个')
    ok(all(0 < v < 100 for v in s['hot']['x']) and all(0 < v < 100 for v in s['hot']['y']),
       s['key'] + '：坐标都在 0-100% 内')
    dd = s['hot']['d'][0] / 100.0 * w
    gap = abs(s['hot']['x'][1] - s['hot']['x'][0]) / 100.0 * w - dd
    print('      热区直径 %.0fpx  相邻水平间隔 %.0fpx' % (dd, gap))
    ok(gap > 0, s['key'] + '：相邻热区不重叠', '间隔 %.0fpx' % gap)

    di = im.copy()
    dr = ImageDraw.Draw(di, 'RGBA')
    for i in range(6):
        cx = s['hot']['x'][i] / 100.0 * w
        cy = s['hot']['y'][i] / 100.0 * h
        r = (s['hot']['d'][i] / 100.0 * w) / 2
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 0, 0, 255), width=3)
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 0, 0, 55))
        dr.line([cx - 10, cy, cx + 10, cy], fill=(255, 255, 0, 255), width=3)
        dr.line([cx, cy - 10, cx, cy + 10], fill=(255, 255, 0, 255), width=3)
    di.save(W + r'\built_' + s['key'] + '.png')

print()
print('=== 打包器常量与试玩版数据是否一致 ===')
pIMG = re.search(r'var IMG = \{ blue: (".*?"), pink: (".*?") \};', pack, re.S)
pHOT = re.search(r'var HOT = (\{.*?\});', pack, re.S)
pAR = re.search(r'var AR = (\{.*?\});', pack, re.S)
img_p = {'blue': json.loads(pIMG.group(1)), 'pink': json.loads(pIMG.group(2))}
hot_p = json.loads(pHOT.group(1))
ar_p = json.loads(pAR.group(1))
for s in data['sets']:
    k = s['key']
    d0 = hot_p[k]['d']
    dlist = d0 if isinstance(d0, list) else [d0] * 6
    ok(img_p[k] == s['img'], k + '：图片字节完全一致')
    ok(hot_p[k]['x'] == s['hot']['x'] and hot_p[k]['y'] == s['hot']['y'], k + '：x/y 一致')
    ok(dlist == s['hot']['d'], k + '：d 展开后一致')
    ok(abs(ar_p[k] - s['ar']) < 1e-6, k + '：比例一致')

print()
print('=== 不变量 ===')
ok(demo.count('</script>') == 2, '试玩版 </script> = 2', str(demo.count('</script>')))
ok(pack.count('</script>') == 2, '打包器 </script> = 2', str(pack.count('</script>')))
ok(len(re.findall(r'\{\{\w+\}\}', pack)) == 0, '打包器无残留占位符')
ok('<!--' not in demo and '<!--' not in pack, '没有 HTML 注释起始符')

print()
print('结果：' + ('全部通过' if not fails else ('%d 项失败 -> %s' % (len(fails), ' / '.join(fails)))))
