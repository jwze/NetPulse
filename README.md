# NetPulse · 网络脉搏

纯前端的网络测速与质量监测面板。打开即可测速，不需要注册、不需要后端，所有数据只留在你自己的浏览器里。

## 特性

- **多线程并发测速**：1–64 线程可调，实时吞吐曲线
- **满载延迟评级（Bufferbloat）**：测速时并行探测，按增量分 A+ ~ F，衡量视频会议与游戏体验
- **成绩卡**：canvas 本地绘制分享图，导出 PNG 或复制到剪贴板，不含 IP
- **三种运行模式**：单节点、节点组联测、多节点按流量轮换
- **自定义节点**：增删改查、分组管理、连通性检测、JSON 配置导入导出
- **流量与带宽上限**：达到上限自动停止，避免跑飞
- **定时任务**：按间隔循环，或仅指定时段运行
- **后台保活**：切到后台继续跑（移动端适配 iOS）
- **出口信息**：当前出口 IP、归属地与国内 / 海外延迟
- **网络诊断**：ASN / 机房标记、IPv4-IPv6 双栈探测、DoH 多解析器对比、链路质量（延迟 / 抖动 / 丢包）、上行带宽测试
- **网络拓扑**：WebRTC + STUN 探测内网地址、NAT 类型与双层 NAT
- **多节点对比**：并发打 2–3 个节点，比较线路差距
- **历史与导出**：测速结果存本机，最多 50 条，可导出 CSV / JSON
- **可离线**：Service Worker 预热全部构建产物，断网也能打开，可安装到桌面
- **息屏模式**：大字号时钟 + 实时速率
- 日间 / 夜间 / 跟随系统三档主题

## 技术栈

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Naive UI · Tailwind CSS 4 · ECharts

## 开发

```bash
npm install
npm run dev      # http://127.0.0.1:3000
npm run build    # 产物输出到 dist/
npm run preview
npm test         # node:test 单元测试
npm run icons    # 重新生成 PNG 图标
```

## 图标

`public/favicon.svg` 与四张 PNG（PWA 192 / 512、maskable 512、iOS 180）由同一份图形生成，改图后执行 `npm run icons` 即可同步：

- 图形与配色定义在 `scripts/gen-icons.mjs` 顶部常量，`buildSvg()` 负责按尺寸缩放
- maskable 版本为满幅背景，主体收在 80% 安全区内，避免被 Android 桌面裁切
- iOS 版本不带圆角与透明，交给系统自行切角

## 测速节点

内置节点来自 `public/nodes.json`，字段说明：

| 字段 | 说明 |
| --- | --- |
| `link` | 测速资源地址 |
| `status` | 是否启用 |
| `webVisible` | 是否在网页端展示 |
| `method` | `GET` / `POST` / `HEAD` |
| `httpProtocol` | 通常保持 `AUTO` |
| `testMode` | 目前网页端主要使用 `DOWNLOAD` |

```json
{
  "list": {
    "全球[Global]": {
      "Cloudflare": {
        "link": "https://speed.cloudflare.com/__down?bytes=99614720",
        "status": true,
        "webVisible": true,
        "method": "GET",
        "httpProtocol": "AUTO",
        "testMode": "DOWNLOAD"
      }
    }
  }
}
```

修改后刷新页面生效。也可以在界面里的「自定义节点」中临时添加，节点会存进 `localStorage`，并支持导出为 JSON 迁移。

## 网络诊断

`/diagnostics` 页把浏览器能拿到的网络信息都摊开，全部走公开接口或本地 API：

| 卡片 | 数据来源 | 说明 |
| --- | --- | --- |
| 出口地址 | `ipwho.is` → 回退 `ipapi.co` | IP 版本、归属、ASN、时区、机房 / 代理 / VPN 标记 |
| 双栈探测 | `v4.ident.me` / `v6.ident.me` | 只监听对应协议栈，成功即代表该栈可用 |
| 本机环境 | Performance API、UA-CH、`navigator.connection` | 当前页面 HTTP 协议版本、网络类型、硬件信息，完全不出网 |
| DNS 解析对比 | `dns.alidns.com`、Cloudflare DoH、Google DoH | 同一域名的解析结果横向对比，差异可能来自 CDN 调度或 DNS 污染 |
| 链路质量 | 华为 / Cloudflare 204 端点 | 20 次小请求测延迟，据此算抖动与丢包 |
| 上传测速 | `speed.cloudflare.com/__up` | 4 路并发上传数据块，按完成量 / 耗时估算上行带宽 |
| 网络拓扑 | 小米 / 腾讯 / 哔哩哔哩 STUN | 解析 ICE 候选得出内网地址、NAT 类型与双层 NAT |
| 多节点对比 | 内置或自定义测速节点 | 并发拉流 8 秒，比较各路抢到的带宽 |

国内网络环境下 Cloudflare、Google 的 DoH 可能被拦截，界面会如实显示「无响应或被拦截」——这本身也是诊断结论。

## Bufferbloat 评级

测速不是只看峰值。路由器缓冲区排满时，延迟会被排队顶起来，视频会议卡顿、游戏跳 ping 大多来自这里。

实现上分两步：点开始后先在**无负载**状态打 4 次小请求取中位数作为基线（第一发是冷启动，丢掉了），然后在下载压满带宽的同时每 500ms 探测一次，取满载中位数。两者相减就是「多出来的排队延迟」。

| 增量 | 评级 | 含义 |
| --- | --- | --- |
| ≤ 5ms | A+ | 几乎无感 |
| 5–30ms | A | 轻微 |
| 30–60ms | B | 可感知 |
| 60–200ms | C | 明显卡顿 |
| 200–400ms | D | 严重 |
| > 400ms | F | 基本不可用 |

阈值与 Waveform 一致。评级会随下载结果一起写进历史记录与 CSV。

## 成绩卡

主页「成绩卡」按钮把最近一次测速画成 1200×630 的分享图（2x 输出），支持下载 PNG 与复制到剪贴板。

- 全部在 canvas 本地绘制，不含 IP、不含任何身份信息
- 最近一次结果存在 `localStorage`，刷新页面后仍可导出

## 离线与安装

构建时 `vite.config.ts` 里的 `precacheManifest()` 插件会输出 `dist/precache.json`，列出全部 js/css 产物；`public/sw.js` 在安装阶段按清单预热，因此**首次访问后断网也能打开**（含 `/diagnostics`）。

- 导航请求走 network-first，断网回落到缓存的 `index.html`
- 静态资源 cache-first，只缓存同源请求，第三方接口一律不碰
- 静态服务器普遍返回 `Vary: Origin`，缓存匹配统一用 `ignoreVary`
- Service Worker 只在生产构建注册，开发时不会干扰热更新

浏览器地址栏出现「安装」图标即可装成桌面应用；iOS 用 Safari 分享 → 添加到主屏幕（图标为 `apple-touch-icon.png`）。

## 关于「无后端」

- 没有账号体系、没有上报、没有排行榜，测速数据不离开浏览器。
- 出口 IP 与归属地走第三方公开接口（`ipwho.is`，失败时回退 `ipapi.co`），只发送一次普通请求；接口不可用时相关卡片显示为占位，不影响测速。
- 延迟探测使用公共 204 端点（华为 / Cloudflare）。
- 网络拓扑会向小米 / 腾讯 / 哔哩哔哩的 STUN 服务器发绑定请求以获取 NAT 映射，不建立数据通道、不传输内容；Chrome 会把内网地址混淆成 `.local`，此时卡片显示「已被浏览器隐藏」。
- 构建产物是纯静态文件，可直接丢到任意静态托管或本地打开。

## 免责声明

本项目仅用于合法的网络性能测试、带宽验证与稳定性检测。请勿用于刷量、恶意耗流、攻击或干扰第三方服务。使用者需自行承担因不当使用产生的一切后果。

## 许可

MIT。本项目在设计思路与部分实现上参考了同为 MIT 许可的开源测速面板，原始版权声明保留在 `LICENSE` 中。
