# AGENTS.md — 重生短剧按键挂件

生成"重生短剧按键挂件"单文件 HTML 挂件（离线、`file://` 直开、安卓+PC 通用）。

## 目录约定

| 路径 | 作用 |
| --- | --- |
| `打包器.html` / `试玩版.html` / `MP3压缩器.html` | **产物，不要手改**，重建会覆盖 |
| `.build/player.css` `player.body.html` `player.js` | 播放器（成品长相）的**唯一真源**，被打包器和试玩版共用 |
| `.build/packer.tpl.html` | 打包器模板，含 `{{CSS_JS}} {{BODY_JS}} {{JS_JS}} {{IMG_BLUE}} {{IMG_PINK}} {{HOT_JS}} {{AR_JS}} {{BUILD_INFO}} {{LAME_JS}} {{VER_JS}} {{VER}}` 占位符 |
| `.build/compressor.tpl.html` | 独立压缩器模板，含 `{{LAME_JS}}` |
| `.build/build.py` | 打包器 + 试玩版的构建入口；`VER` 版本号也在这里（改一处，四个落点同步） |
| `.build/build_compressor.py` | `MP3压缩器.html` 的构建入口 |
| `assets/` | 默认挂件图（`img_blue.jpg` / `img_pink.jpg`）与 README 截图。**构建依赖它**，进版本库 |
| `third_party/lamejs/` | 内嵌的 MP3 编码器，上游原始文件**未修改**，LGPL-3.0。构建校验 sha256，改动会报错 |
| `tests/` | 构建后的验证脚本（进版本库） |
| `.work/` | 草稿、截图、诊断副本、构建自检输出。**不进版本库**，构建会自动创建 |

构建脚本里的路径全部由脚本自身位置推导，**没有任何绝对路径**。挂件图读 `assets/`；
若只有旧布局（图在 `.work/`），`build.py` 会自动回退到那里。

## 改完必须跑

```powershell
python .build\build.py                 # 重建打包器 + 试玩版，自带结构自检
python .build\build_compressor.py      # 重建独立压缩器
node --check .work\check_packer.js     # 构建会把脚本块抽出来供语法检查
node tests\test_player.js              # 播放器功能 28 项
node tests\test_v2.js                  # 对位/每键直径 13 项
node tests\test_packer_compress.js     # 压缩流水线 14 项
python tests\verify_final.py           # 端到端：从产物解图/热区，与打包器常量比对（需 Pillow）
```

## 坑（都是踩过的）

1. **别用 `rfind('<script>')` 抽脚本块**：打包器源码里 `buildHtml` 含字面字符串 `'<script>'`，会命中它。用正则按顺序取。
2. **JS 里绝不能出现字面 `</script>` 或 `<!--`**：会截断脚本 / 触发 script-data-escaped 状态。构建自检把 `<!--` 计数必须为 0 当作硬条件，所以**产物里不要加 HTML 注释**——需要写声明信息请用 `<meta>`（LGPL 声明就是这么加的）。
3. **flex item 里的图片会顶开容器**：`.stage` 必须 `min-width:0`，否则 `<img>` 的固有宽度（760px）让整个 stage 比视口还宽、被裁掉。
4. **`tests/` 里的测试桩可能缺浏览器全局**：播放器用到 `Image`/canvas 时，桩要补 `global.Image` 和 `El.prototype.getContext`，否则报 `Image is not defined`。补桩 ≠ 改断言。
5. **构建写不进旧 HTML**：若目标 HTML 属于别的账户/沙箱身份（例如上个会话的 AppContainer SID），脚本删得掉但写不了。用 write 工具重建该文件（会继承当前 ACL），或先手动清空再跑。
6. **第三方编码器不许手改**：`third_party/lamejs/lame.min.js` 是与上游逐字节一致的 LGPL-3.0 文件，两个构建脚本都会校验 sha256。真要改，必须同步更新 `LAME_SHA256`、`third_party/lamejs/LICENSE` 与 `THIRD-PARTY-NOTICES.md`。

## 在浏览器里看效果（无头 Chrome 截图）

沙箱**两种受限模式都禁止命名管道**，而 Chrome 的多进程 IPC（mojo）必须用命名管道：
受限模式下 `FATAL: mojo platform_channel Check failed: 拒绝访问 (0x5)`，**加任何参数都起不来**。
只能提权（`danger-full-access`）跑，所以**一次命令把要截的图全渲完**。

```powershell
$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
taskkill /F /IM chrome.exe 2>$null   # 残留进程会占住 profile 锁，导致后续静默失败
& $chrome --headless=new --no-sandbox --disable-gpu --disable-crash-reporter --disable-breakpad `
  --no-first-run --no-default-browser-check --disable-extensions --hide-scrollbars `
  --force-device-scale-factor=2 --window-size=480,900 --virtual-time-budget=9000 `
  --user-data-dir="$PWD\.work\r1" `
  --screenshot="$PWD\.work\shot.png" "file:///$($PWD.Path.Replace('\','/'))/.work/shot_demo.html"
```

- 用**纯 ASCII 文件名**的副本渲染，避免中文路径 URL 编码问题。
- 每次换一个 `--user-data-dir`，否则窗口状态会互相影响。
- **`--dump-dom` 返回空**（新版 Chrome 不支持），别指望它取布局数字。
- **截图 PNG 的宽度 ≠ CSS 视口宽度**（`--force-device-scale-factor` 未必生效，系统缩放会介入）。
  要量图必须先拿到真实视口：往页面里注入一个 `position:fixed` 的 `<pre>` 把
  `innerWidth / dpr / getBoundingClientRect()` 印出来，再截图用眼睛读。**否则像素换算全错**
  ——这个坑让我误判过两次（把"截图被裁"当成"布局跑偏"）。
- 想比较多个 CSS 参数又不想反复提权：**用 Python 把 CSS 数学复刻出来**（GaussianBlur 对应 `blur()`、
  ImageEnhance 对应 `saturate()/brightness()`、alpha 合成对应渐变遮罩），拼成对比图先选好再改代码。

## 版本、许可与隐私

- 版本号 `VER` 只在 `.build/build.py`。成品里会写进 `<meta name="generator">` 和数据的 `ver`，所以任何成品都能查出是哪个版本生成的。
- 仓库自身代码采用 **Boost Software License 1.0**（见根目录 `LICENSE`）；第三方组件（lamejs）的 LGPL-3.0 合规要求见 `THIRD-PARTY-NOTICES.md`。
- **绝不把音频素材提交进仓库**：`.gitignore` 已挡住 `*.mp3`、`bgm.zip`、两个歌曲目录，以及 16MB 的内嵌歌曲成品。这个仓库是公开的。
- 文档里不要写死绝对路径、用户名、机器名、屏幕分辨率等本机信息。
