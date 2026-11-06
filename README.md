# NetPulse · 网脉

纯前端的网络测速与质量诊断面板。打开就能测，没有账号、没有后端、没有上报，所有结果只留在你自己的浏览器里。

- 测速：多线程并发、实时曲线、满载延迟评级、成绩卡
- 诊断：出口 IP、双栈、DNS、链路质量、上行带宽、NAT 拓扑
- 专项：全球延迟、IPv6、多出口对照、IP 质量、解锁检测、隐私画像

## 页面一览

除测速台外，其余检测都收在「检测中心」：一级按用途分类，二级是具体检测项。打开即自动检测，只有占带宽的项目需要手动开始。

| 路由 | 页面 | 在做什么 |
| --- | --- | --- |
| `/` | 测速台 | 1–64 线程并发下载，实时吞吐曲线与 Bufferbloat 评级 |
| `/check` | 概览 · 总览 | 出口 IPv4 / IPv6 地址并列展示、ASN 与机房标记、本机环境、历史记录 |
| `/check/network/egress` | 网络 · 出口对照 | 53 个探测器同时问「我是谁」，按 ASN 还原真实出口与分流规则 |
| `/check/network/latency` | 网络 · 全球延迟 | 40 个海外服务逐一测 HTTPS 往返，识别边缘节点与出口，给出可用度判定 |
| `/check/network/ipv6` | 网络 · IPv6 双栈 | 六项检测打到 10 分制，识别 AAAA 过滤、PMTU 黑洞、NAT64 与隧道地址 |
| `/check/network/multinode` | 网络 · 多节点测速 | 多节点并发拉流比较线路差距（手动） |
| `/check/quality/quality` | 质量 · 链路质量 | 20 次探测的延迟、抖动与丢包 |
| `/check/quality/upload` | 质量 · 上传带宽 | 上行吞吐实测（手动） |
| `/check/quality/ip-quality` | 质量 · IP 质量 | 11 个来源交叉验证，8 个邮件黑名单，100 分制评级 |
| `/check/quality/dns` | 质量 · DNS 解析 | 国内外 DoH 解析结果对比 |
| `/check/privacy/unlock` | 隐私 · 解锁检测 | 148 个服务逐个看「它以为你在哪」，四类成绩单与分流建议 |
| `/check/privacy/portrait` | 隐私 · 隐私画像 | 87 项嗅探 + 11 项伪装检测，A+ ~ F 环境评分 |
| `/check/privacy/webrtc` | 隐私 · 网络拓扑 | NAT 类型、STUN 映射与内网地址泄露 |
| `/:pathMatch` | 404 | 兜底页 |

旧的 `/diagnostics`、`/latency`、`/ipv6`、`/egress`、`/ip-quality`、`/unlock`、`/privacy` 会跳转到对应的新地址，分享链接里的 `#hash` 与 `?query` 原样保留。

## 测速台

- **并发下载**：1–64 线程可调，按完成量 / 耗时估算带宽，实时吞吐曲线
- **满载延迟（Bufferbloat）**：无负载先取基线，压满带宽后每 500ms 探测一次，按排队延迟增量分档
- **运行模式**：单节点、节点组联测、多节点按流量轮换
- **自定义节点**：增删改查、分组、连通性检测、JSON 导入导出，存 `localStorage` 可迁移
- **限额与定时**：流量 / 带宽上限自动停止；按间隔循环或仅在指定时段运行
- **后台保活**：切到后台继续跑，移动端带静音音频保活（iOS 适配）
- **成绩卡**：canvas 本地绘制 1200×630 分享图，可下载或复制到剪贴板，不含 IP
- **历史记录**：最近 50 条存本机，可导出 CSV / JSON
- **界面**：息屏模式（大字号时钟 + 实时速率）、日间 / 夜间 / 跟随系统三档主题

## 快速开始

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 产物输出到 dist/
npm run preview
npm test         # node:test 单元测试
npm run icons    # 重新生成 PNG 图标
```

需要 Node 22+（构建脚本使用 TS 剥离与 ESM）。

## 技术栈

Vue 3 · TypeScript · Vite 8 · Pinia · Vue Router · Naive UI · Tailwind CSS 4 · ECharts 6

## 目录结构

```
src/
├── components/   表现层，按功能分组（panel / diagnostics / latency / ipv6 / check ...）
├── composables/  页面级流程编排，组件只负责渲染
├── config/       品牌文案与检测中心目录（check.ts），加检测项先改这里
├── data/         探测清单与服务定义，纯数据
├── router/       路由表与标题
├── stores/       Pinia：panel / nodes / network / history / settings / app
├── utils/        网络能力：探测、评分、分享图、导出、剪贴板
└── views/        页面入口
public/           图标、manifest、sw.js、nodes.json
scripts/          gen-icons.mjs，图标唯一来源
.github/          workflows/deploy.yml，GitHub Pages 自动发布
```

约定：网络能力一律放 `utils/`，组件不直接发探测请求；CSS 类前缀 `np-`。

## 测速节点

内置节点在 `public/nodes.json`，改完刷新页面生效。

| 字段 | 说明 |
| --- | --- |
| `link` | 测速资源地址 |
| `status` | 是否启用 |
| `webVisible` | 是否在网页端展示 |
| `method` | `GET` / `POST` / `HEAD` |
| `httpProtocol` | 通常保持 `AUTO` |
| `testMode` | 网页端主要使用 `DOWNLOAD` |

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

## 数据来源

全部是浏览器直连的公开接口，不经任何自有服务器。接口不可用时页面如实显示「无响应」，这本身也是诊断结论。

| 能力 | 主要端点 |
| --- | --- |
| 出口 IP 与归属 | `ipwho.is` → 回退 `ipapi.co` |
| 双栈探测 | `v4.ident.me` / `v6.ident.me` |
| DoH 对比 | `dns.alidns.com`、Cloudflare、Google |
| 链路质量 | 华为 / Cloudflare 204 端点 |
| 上行带宽 | `speed.cloudflare.com/__up` |
| NAT 拓扑 | 小米 / 腾讯 / 哔哩哔哩 STUN |
| 全球延迟 | 各服务自己的边缘节点静态文件 |
| 解锁检测 | 各服务公开接口，读不到时用连通性推测并标注 |

国内网络下 Cloudflare、Google 的 DoH 可能被拦截，属预期行为。

## 隐私

- 无账号、无统计、无排行榜，测速与诊断结果不上传
- 分享链接（`#lat=` / `#v6=` / `#eg=` / `#iq=` / `#un=` / `#pv=`）只含结论与耗时，不含 IP
- 分享图在本地 canvas 绘制，不含 IP 与身份信息
- 浏览器本地存储键：`np:history`、`np:lastResult`、节点与设置
- 隐私画像页支持一键隐藏地址、DNS、坐标与 WebRTC 地址，方便截图

## Bufferbloat 阈值

| 增量 | 评级 | 含义 |
| --- | --- | --- |
| ≤ 5ms | A+ | 几乎无感 |
| 5–30ms | A | 轻微 |
| 30–60ms | B | 可感知 |
| 60–200ms | C | 明显卡顿 |
| 200–400ms | D | 严重 |
| > 400ms | F | 基本不可用 |

阈值表在 `src/utils/bufferbloat.ts` 的 `BLOAT_THRESHOLDS`，改分档只改这张表。评级随下载结果一起写入历史与 CSV。

## 离线与安装

构建时 `vite.config.ts` 的 `precacheManifest()` 插件输出 `dist/precache.json`，`public/sw.js` 在安装阶段按清单预热，首次访问后断网也能打开。

- 导航请求 network-first，断网回落缓存的 `index.html`
- 静态资源 cache-first，只缓存同源请求
- 缓存匹配统一 `ignoreVary`，兼容返回 `Vary: Origin` 的静态服务器
- Service Worker 只在生产构建注册，不干扰开发热更新

地址栏出现安装图标即可装成桌面应用；iOS 用 Safari 分享 → 添加到主屏幕。

## 部署

产物是纯静态文件，`dist/` 丢到任意静态托管即可。站点根路径由 `VITE_BASE` 控制，默认 `/`。

**GitHub Pages**：`.github/workflows/deploy.yml` 在 `main` 分支每次推送时类型检查 → 单测 → 构建 → 发布，失败则不发布。

1. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**
2. 推送到 `main`，工作流自动算出站点根：项目站点 `/NetPulse/`，用户站点 `<owner>.github.io` 为 `/`
3. 构建时补 `404.html`（history 路由兜底）与 `.nojekyll`

子路径部署下 `manifest.webmanifest`、`sw.js`、`nodes.json` 全部按相对路径或 `import.meta.env.BASE_URL` 解析，无需改代码。

**自建服务器**（nginx）：站点根目录放 `dist/` 内容，SPA 回退 `try_files $uri $uri/ /index.html`，`/assets/` 长缓存且 immutable，`sw.js` 与 `index.html` 不缓存。

## 图标

`public/favicon.svg` 与四张 PNG（PWA 192 / 512、maskable 512、iOS 180）由同一份图形生成，改图后执行 `npm run icons`：

- 图形与配色定义在 `scripts/gen-icons.mjs` 顶部常量
- maskable 版为满幅背景，主体收在 80% 安全区，避免 Android 桌面裁切
- iOS 版不带圆角与透明，交给系统切角

## 说明

- WebRTC 拓扑依赖 STUN 绑定请求，不建立数据通道、不传输内容；Chrome 会把内网地址混淆成 `.local`，此时显示「已被浏览器隐藏」
- 路径 MTU 与 Happy Eyeballs 的实际等待时间浏览器看不到，纯前端版本不做
- 构建产物是纯静态文件，可直接丢到任意静态托管

## 许可证

[GPL-3.0](LICENSE)。可自由使用、修改、分发，衍生作品需同样以 GPL-3.0 开源并保留版权声明。

## 免责声明

本项目仅用于合法的网络性能测试、带宽验证与稳定性检测。请勿用于刷量、恶意耗流、攻击或干扰第三方服务。使用者需自行承担因不当使用产生的一切后果。
