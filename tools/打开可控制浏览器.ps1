# 让 agent 接管一个 Chrome(可被 CDP 控制)
#
# 为什么需要它:DSH 沙箱会回收进程树,而 Chrome 的 crashpad 崩溃处理器被沙箱拒绝后会自杀。
# 所以"带调试端口的 Chrome"必须由人工在沙箱外启动,启动后本 agent 就能持续控制它。
#
# 用法:右键本文件 → 使用 PowerShell 运行;或在终端执行
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\tools\打开可控制浏览器.ps1"
#
# 之后 agent 通过 http://127.0.0.1:9222 控制它(导航、点击、输入、读 DOM、截图)。

param(
    [string]$Port = '9222',
    [string]$Url  = 'https://www.bilibili.com',
    [string]$ProfileDir = (Join-Path (Split-Path -Parent $PSScriptRoot) '.work\chrome-agent')
)

$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) {
    $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
}
if (-not (Test-Path $chrome)) { Write-Error "找不到 chrome.exe"; exit 1 }

Write-Host "启动 Chrome(调试端口 $Port)..."
Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfileDir",
    '--restore-last-session',
    '--no-first-run',
    '--no-default-browser-check',
    $Url
) | Out-Null

# 等端口就绪,让调用方知道可以接管了
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $v = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
        Write-Host "就绪:$($v.Browser)(协议 $($v.'Protocol-Version'))"
        Write-Host "现在可以对 agent 说:控制浏览器做 XXX"
        exit 0
    } catch { }
}
Write-Warning "端口 $Port 未就绪,浏览器可能没能启动"
exit 1
