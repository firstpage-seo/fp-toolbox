# FirstPage HK — 视觉识别规范(提取自 firstpage.hk)

提取来源:`https://www.firstpage.hk`(WordPress 主题 `themes/firstpage/assets/css/style.css`,2025 构建)。

## 系统一句话
白底上,珊瑚红行动按钮 + 品牌蓝渐变横幅 + 深海军蓝大标题,配 Proxima Nova 圆润现代无衬线 —— 一间香港 performance marketing 代理商的自信与直接。

## Tokens(OKLch)

| Token | OKLch | 来源 hex | 用途 |
|---|---|---|---|
| `--bg` | `oklch(0.99 0 0)` | `#ffffff` | 页面背景 |
| `--surface` | `oklch(0.965 0 0)` | `#f1f1f1` | 分区/次级表面 |
| `--fg` | `oklch(0.24 0.09 266)` | `#00225d` | 标题、正文主色(深海军蓝) |
| `--muted` | `oklch(0.5 0 0)` | `#787878` | 次级文字 |
| `--border` | `oklch(0.91 0 0)` | `#e5e5e5` | 描边、分隔 |
| `--accent` | `oklch(0.69 0.20 24)` | `#ff5254` | 主行动色(珊瑚红) |

品牌蓝 `#427fe0`(oklch(0.62 0.16 250))与深海军蓝 `#00225d` 为次要品牌色,用于横幅、链接、图表强调;渐变 `#427fdf→#396bb1`(横幅)、`#da3e3f→#ff5254`(CTA)。

## 字体栈
- Display/UI:`"proxima-nova", "Open Sans", "Segoe UI", system-ui, sans-serif`(Typekit proxima-nova;原型以 Open Sans 加载兜底)
- Body:同栈。站点字体极简,粗细 400/600/700/800 控制层级。
- Mono(数据/代码):`"SFMono-Regular", ui-monospace, monospace`

## Posture 规则(观察)
1. **珊瑚红 = 行动**:CTA 一律珊瑚红(可配 `#da3e3f→#ff5254` 渐变),白字、圆角、hover 变深;每屏至多 1–2 处。
2. **蓝色渐变横幅**:页面顶部深蓝渐变横幅,白字大标题 + 副标题,是每个页面的开场。
3. **深海军蓝标题**:`#00225d` 大标题,紧排(负字距),白底上对比强烈。
4. **圆角卡片 + 轻阴影**:内容以圆角卡片承载,白底、1px 浅灰边、柔和阴影。
5. **浅灰分区交替**:白 / `#f1f1f1` 分区交替,制造节奏。
6. **文字为主、图标为辅**:组件以排版层级驱动,1.6–1.8px 描边 SVG 图标,单色。
