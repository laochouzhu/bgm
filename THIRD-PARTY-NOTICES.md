# 第三方组件与许可声明

本仓库**自身代码**采用 Boost Software License 1.0（见根目录 [`LICENSE`](LICENSE)）。
下面列出随仓库分发的第三方组件，**均为未修改的原始文件**。

---

## lamejs 1.2.1

| 项 | 值 |
| --- | --- |
| 组件 | lamejs —— Pure JavaScript MP3 Encoder |
| 版本 | 1.2.1 |
| 作者 | Alex Zhukov |
| 许可证 | **LGPL-3.0** |
| 上游仓库 | https://github.com/zhuker/lamejs |
| 上游许可说明 | [`third_party/lamejs/LICENSE`](third_party/lamejs/LICENSE) |
| 本仓库内文件 | [`third_party/lamejs/lame.min.js`](third_party/lamejs/lame.min.js)（156043 字节） |
| 原始文件 sha256 | `15D285E2587B3BDBFD18A68DE6CE07CC074F7480A82C3815DA2DC1C348EC6DF4` |
| 是否修改 | **否** —— 与上游发布文件逐字节一致 |

lamejs 是 libmp3lame（LAME，https://lame.sourceforge.net ）的 JavaScript 移植。

### 用在哪里

lamejs 的代码被**内嵌**进两个构建产物：

- `打包器.html` —— 歌曲库的「添加时自动压缩」
- `MP3压缩器.html` —— 独立压缩器

内嵌动作由构建脚本完成：`.build/build.py` 与 `.build/build_compressor.py` 读取
`third_party/lamejs/lame.min.js`，原样写入产物的 `<script>` 块。

### LGPL-3.0 合规做法

| 要求 | 本项目怎么做 |
| --- | --- |
| 保留原始库、可替换 | `third_party/lamejs/lame.min.js` 单独存放且未修改 |
| 允许替换库后重新链接 | 产物由脚本从该文件生成：用自己的 lamejs 覆盖它、重跑构建脚本，即可得到使用修改版库的产物，**无需改动其他任何代码** |
| 声明与出处 | 本文件 + `third_party/lamejs/LICENSE` + 两个产物 `<head>` 中的 `<meta name="third-party-notices">` |
| 修改必须回馈 | 内置 sha256 校验：文件一旦被改动，构建即报错并要求同步更新声明（`.build/build.py` 的 `LAME_SHA256`） |

**若你修改了 `third_party/lamejs/lame.min.js`**：LGPL-3.0 要求修改后的库仍以 LGPL-3.0 发布。
请更新本文件的 sha256、`third_party/lamejs/LICENSE`，以及两个构建脚本里的 `LAME_SHA256`，
并在产物中说明你的修改内容。

---

## 音频素材

本仓库**不包含**任何歌曲 / BGM 音频文件，也不包含内嵌了真实歌曲的成品
（见 `.gitignore`）。`试玩版.html` 的声音由浏览器现场合成，不需要任何音频文件。
打包器需要你自己提供 mp3。
