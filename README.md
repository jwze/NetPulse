# NetPulse · 网络脉搏

纯前端的网络测速与质量监测面板。打开即可测速，不需要注册、不需要后端，所有数据只留在你自己的浏览器里。

## 特性

- **多线程并发测速**：1–64 线程可调，实时吞吐曲线
- **三种运行模式**：单节点、节点组联测、多节点按流量轮换
- **自定义节点**：增删改查、分组管理、连通性检测、JSON 配置导入导出
- **流量与带宽上限**：达到上限自动停止，避免跑飞
- **定时任务**：按间隔循环，或仅指定时段运行
- **后台保活**：切到后台继续跑（移动端适配 iOS）
- **出口信息**：当前出口 IP、归属地与国内 / 海外延迟
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

## 关于「无后端」

- 没有账号体系、没有上报、没有排行榜，测速数据不离开浏览器。
- 出口 IP 与归属地走第三方公开接口（`ipwho.is`，失败时回退 `ipapi.co`），只发送一次普通请求；接口不可用时相关卡片显示为占位，不影响测速。
- 延迟探测使用公共 204 端点（华为 / Cloudflare）。
- 构建产物是纯静态文件，可直接丢到任意静态托管或本地打开。

## 免责声明

本项目仅用于合法的网络性能测试、带宽验证与稳定性检测。请勿用于刷量、恶意耗流、攻击或干扰第三方服务。使用者需自行承担因不当使用产生的一切后果。

## 许可

MIT。本项目在设计思路与部分实现上参考了同为 MIT 许可的开源测速面板，原始版权声明保留在 `LICENSE` 中。
