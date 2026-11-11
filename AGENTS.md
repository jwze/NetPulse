# AGENTS.md

给在本仓库工作的 AI 代理看的作业手册。这里只写**必须遵守的东西**与**踩过的坑**，项目功能介绍看 `README.md`。

---

## 1. 这个项目是什么

net-pulse（网脉）是一个**纯前端**的网络测速与质量诊断面板。打开即测，没有账号、没有后端、没有统计上报，结果只留在访问者自己的浏览器里。

**产品性格**：精确、克制、有读数感。使用者的画像是「会用的折腾党」——懂 NAT、懂 Bufferbloat、会看 ASN，不需要被教导。

**四条不可协商的边界**（任何需求都不能突破，包括「临时加一个」）：

1. **零自有后端**。不写服务端、不接数据库、不加任何自有 API。所有数据来自浏览器直连的公开接口。
2. **不做多语言**。界面只有简体中文。上游仓库的 i18n 一律不搬。
3. **不做推广**。没有落地页、没有 OG 图、没有营销文案、没有「关于」页。
4. **不上传任何结果**。分享走 URL hash，只放结论不放 IP。

接口不可用时就如实显示「无响应」——这本身就是诊断结论，不要用假数据兜底。

---

## 2. 来源与沿革（决定了什么东西不能搬进来）

| 来源 | 提供了什么 |
| --- | --- |
| `arsnyeon/FlowLoss_SpeedTestPanel` | 骨架：测速台、节点管理、设置面板 |
| `ljxi/NetworkPanel`（main / old） | 参考：测速内核与节点数据结构 |
| `yt1988/1ms.dog` | 功能：Bufferbloat、成绩卡、WebRTC 拓扑、多节点同测 |
| `yt1988/ipv6-test` | 功能：IPv6 双栈检测与评分 |
| `yt1988/egresslens` | 功能：多出口对照 |
| `yt1988/ip-quality-test` | 功能：IP 质量评分 |
| `yt1988/unlock-check` | 功能：解锁检测 |
| `yt1988/who-are-you` | 功能：隐私画像 |

**只搬功能，不搬代码与外观**。明确不要：多语言、落地页、原作者 UI 与品牌、OG 图、需要自建服务器的能力（跳转计数 `/_ms/me`、多端口探测、MSS/JA4/HTTP2 指纹）、需要密钥的情报源（IPQS / AbuseIPDB / Scamalytics / ipdata / proxycheck / IP2Location）。

---

## 3. 技术栈与命令

Vue 3.5 · TypeScript · Vite 8 · Pinia · Vue Router · Naive UI · Tailwind CSS 4 · ECharts 6。需要 **Node 22+**（构建脚本用 TS 剥离与 ESM）。

```bash
npm run dev      # http://localhost:3000（只监听 [::1]，必须用 localhost 访问）
npm run build    # vue-tsc -b && vite build → dist/
npm test         # node:test 单测
npm run icons    # 由 scripts/gen-icons.mjs 重新生成全部图标
npm run preview
```

`@` 别名指向 `src`（见 `vite.config.ts`）。

---

## 4. 分层规则

```
src/
├── views/        页面入口，只做编排
├── components/   表现层，按功能分组（panel / check / diagnostics / latency / ipv6 / egress / ipquality / unlock / privacy / layout / ui）
├── composables/  页面级流程：状态机、生命周期、启停、分享码
├── config/       brand.ts（品牌）与 check.ts（检测中心目录）
├── data/         探测清单与服务定义，纯数据、无副作用
├── router/       路由与标题
├── stores/       Pinia：panel / nodes / network / history / settings / app
└── utils/        全部网络能力：探测、解析、评分、分享图、导出
```

三条硬规则：

- **网络能力一律放 `utils/`**。组件不直接 `fetch` 探测请求，只管渲染。
- **业务判定放 `utils/` 的纯函数**，能被单测覆盖；`composables/` 只负责把它们串起来。
- **CSS 类前缀统一 `np-`**，全局样式与设计令牌集中在 `src/style.css`。

---

## 5. 新增一个检测项的 SOP

检测中心的导航、路由、标题全部由 `src/config/check.ts` 推导，**不要手改路由表**。

1. 在 `CHECK_CATEGORIES` 里登记 `{ id, label, auto }`。
   - `auto: true` → 进入页面立即检测。
   - `auto: false` → 只在**占带宽**时才手动（目前只有上传带宽、多节点测速）。判断标准：会不会持续拉满上行/下行。
2. 写 `src/components/check/panes/XxxPane.vue`，用 `DiagCard` 作卡壳。
3. 需要新探测 → `src/data/` 加清单、`src/utils/xxx.ts` 加纯逻辑、`src/utils/xxxProbe.ts` 加请求、`src/composables/useXxx.ts` 加流程。四层各司其职，不要糊成一个文件。
4. 路由 `/check/:cat?/:tab?` 自动承接，无需注册。
5. 旧的独立路由如需保留，在 `src/router/index.ts` 加 redirect，并用 `to.query` / `to.hash` 原样透传分享码。

---

## 6. 视觉规范：机房记录仪 / 描迹纸

方向定义在 `src/style.css` 顶部注释里，读一遍再动手。核心是：**壳保持安静，颜色只出现在数据里**。

- **不写 hex**。所有颜色、圆角、阴影、动效用令牌：`--bg-*`、`--text-primary/secondary/muted`、`--border(-subtle/-strong)`、`--tone-good/warn/bad(-bg)`、`--trace`、`--r-xs…xl`、`--shadow-*`、`--dur(-fast)`。
- **主操作是墨水**（`--accent-primary` 近黑）。**笔迹橙 `--trace` 只给「活的数据」**：曲线、运行态、当前值。不要用它做按钮或装饰。
- **主题靠 `.dark` 类切换变量**，不要在组件里写暗色分支。
- 字号只用 10–28 的档位；字重只用 **400 / 500**。
- 图标统一走 `src/components/ui/Icon.vue` + `icon-paths.ts`（16px、stroke 1.5），不要再塞零散 inline SVG。
- 大读数的等宽字体用 **400 字重**（本机 Consolas/DejaVu 的 0 带斜杠，500 以上会发粗）。
- `PulseLine.vue` 是签名细节，只在真正运行时动。

---

## 7. 文案准则（最容易踩的一条）

准则一句话：**面向会用的用户，界面不解释、不指导，只呈现读数与结论。**

**要删的**：

- 页面副标题、分类说明、tab 悬浮解释
- 卡片里的引导语（「开始后会先确认出口线路…」「点击开始探测」）
- 方法论教学块（「怎么判定」「怎么读这些结果」）
- 设置项下面的解释性小字
- placeholder 里的解释（写 `公网 IP`，不要写「留空则查本机」）
- 建议句式：「试试」「重启路由器」「找运营商」「建议 10 以内」

**必须保留的**：

- 结果与评判：「链路质量 华为云 204」「探测目标 华为云」「本地与海外都可用」「分流建议」「IPv6 比 IPv4 快 12.9 ms」
- 状态词：待命 / 测速中 / 待测 / 已停止 / 正在探测 / 暂无记录
- `手动` 标签（是状态，不是提示）

**唯一例外**：息屏遮罩的「点击任意处唤醒」。那是退出方式，删了像卡死。

另外，页面上**不要再写一遍导航已有的标题**。`.np-page-title` 与 `.np-page-sub` 已删除，不要复活。

---

## 8. 布局准则

- **检测过程中界面不得抖动**。结果出现时不能把下面的区块顶下去：栏宽、卡高、网格列数都要预留。历史问题就出在「有些东西会随检测变大」。
- 手动触发的单卡页面用 `.pane-narrow`（760px）收窄，避免摊满整屏。
- 移动端断点以 640 / 960 为主，卡片单列时保持同一套间距。
- 内容宽度 `--np-page-width: 1320px`，页面内边距 `--np-page-padding`。

---

## 9. 已知坑（踩过，别再踩）

| 坑 | 处理 |
| --- | --- |
| CORS 决定功能边界 | 新接口先实测放行再写功能，不要凭文档假设 |
| `public/sw.js` | **原生 JS，禁止 TS 语法**，写错会静默注册失败 |
| Service Worker 缓存匹配 | 必须 `ignoreVary: true`，否则 `Vary: Origin` 导致永远不命中 |
| `canvas measureText` | 必须在**改字体之前**测量，否则文字重叠 |
| 多节点 `reader.read()` | 到期必须用内部 controller 强制 abort，否则永不 resolve |
| IPv6 出口判双层 NAT | 必须另取 IPv4 出口比对，直接比对会误判 |
| 全局 reset | `* { margin:0; padding:0 }` 必须放在 `@layer base`，否则压掉 Tailwind 间距 |
| dev server 地址 | 只监听 `[::1]:3000`，用 `localhost`，用 `127.0.0.1` 会被拒 |
| DoH 请求 | 需带 `accept: application/dns-json` |
| NBC / DAZN | 必须 POST，GET 返回 404 |
| ECharts 6 | `grid.containLabel` 警告用 `LegacyGridContainLabel` |
| 大读数 | 等宽 400 字重，勿用 500+ |
| 子路径部署 | Pages 项目站点是 `/net-pulse/`，写死 `/xxx` 一定 404：HTML 用 `%BASE_URL%`，TS 用 `import.meta.env.BASE_URL`，`sw.js` 用 `registration.scope`，`public/manifest.webmanifest` 用相对路径 |

---

## 10. 提交与版本

- **每完成一项任务就提交一次**，不要攒着。这是从第一天定到现在的约定。
- 用 Conventional Commits + 中文描述，scope 用模块名：
  `style(panel): 测速台改为描迹纸记录仪`、`fix(privacy): 分享链接按链接里的结论重新评分`
- 版本号**两处同步**：`package.json` 与 `src/config/brand.ts`。改完打 tag（`v1.5.0`）。
- 仓库暂无 remote，不要自作主张推送；GitHub Pages 由 `main` 推送自动发布。

**提交前必须全绿**：

```bash
npx vue-tsc --noEmit     # 类型
npm test                 # 单测
npm run build            # 构建
```

涉及界面就截图核对（浅色 / 深色 / 移动端），不要凭想象交付。临时脚本放 `.tmp/`，收尾删掉。

---

## 11. 部署

**主站**：腾讯云轻量应用服务器，nginx 静态托管，HTTP 直出（不启用 HTTPS）。

- 站点根目录 `/var/www/net-pulse`，属主 `www-data`
- 配置 `/etc/nginx/sites-available/net-pulse.conf`，SPA 回退 `try_files $uri $uri/ /index.html`
- `/assets/` 30 天 immutable，`sw.js` 不缓存
- 发布方式：本地 `npm run build` → 打包 → 上传解包到临时目录 → **`mv` 目录轮转切换** → `nginx -t && nginx -s reload`
- 回滚 = 把 `net-pulse.prev` 换回来，不改配置
- 走 TAT 远程执行时有内容黑名单（`rm -rf`、`cat`、触碰站点目录的复合命令会 `AccessDeny`），改句式即可，不要硬绕
- 具体实例 ID 与公网 IP 属于运维信息，**不进仓库**

**GitHub Pages**：`main` 每次推送触发 `.github/workflows/deploy.yml`，类型检查 → 单测 → 构建 → 发布，任一环节失败即不发布。

- 站点根由工作流算出：项目站点 `/net-pulse/`，`<owner>.github.io` 为 `/`，通过 `VITE_BASE` 注入
- 构建后补 `404.html`（history 路由兜底）与 `.nojekyll`
- 因此**新增静态引用必须用 `import.meta.env.BASE_URL` 或相对路径**，不要写死 `/xxx`；`index.html` 用 `%BASE_URL%`

---

## 12. 当前状态与开放方向

版本 **v1.5.0**。功能已收敛：测速台 1 个页面 + 检测中心 4 分类 12 个检测项。

可以动但没动的：

- 换掉 ECharts，手写 canvas 曲线（可省约 65KB gzip）
- `sw.js` 的 `VERSION` 是静态字符串，跨构建不变；要强制刷新离线缓存得手动改
- 测试覆盖率偏低，只有 ipv6 / latency / privacy / panel / webNodeHeaders 五处

---

## 13. 交付前的自查清单

- [ ] 还是纯前端吗？有没有偷偷引入后端或自建 API？
- [ ] 新 UI 用的是令牌还是 hex？
- [ ] 界面有没有多出解释性文案？
- [ ] 检测出结果时布局会跳吗？
- [ ] 占带宽的检测是不是默认手动了？
- [ ] 分享链接 / 成绩卡里有没有混进 IP？
- [ ] 新增的静态引用是 `BASE_URL` 还是写死的 `/`？（后者在 Pages 子路径下必坏）
- [ ] 有没有把运维信息（服务器 IP、实例 ID、密钥）带进仓库？
- [ ] 类型检查、单测、构建是不是都过了？
- [ ] 改版本号了吗（两处）？提交了吗？
