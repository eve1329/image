import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/ming/project/image/output/playwright'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const A = {
  id: 'scheme-a',
  label: 'A',
  title: '深色工作台',
  subtitle: 'Infinite canvas / network-first',
  bg: '#05070d',
  bg2: '#090d16',
  bg3: '#0d1322',
  surface: 'rgba(12, 15, 22, 0.92)',
  surface2: 'rgba(18, 22, 31, 0.96)',
  surface3: 'rgba(255,255,255,0.06)',
  line: 'rgba(171, 202, 255, 0.10)',
  text: '#f4f7ff',
  muted: '#8d97ad',
  muted2: '#667188',
  accent: '#39d2ff',
  accent2: '#8a6cff',
  accent3: '#ff4fa1',
  chip: 'rgba(255,255,255,0.06)',
  chipBorder: 'rgba(255,255,255,0.10)',
  glow: 'rgba(57, 210, 255, 0.20)',
  canvasGlow: 'rgba(46, 128, 255, 0.22)',
}

const B = {
  id: 'scheme-b',
  label: 'B',
  title: '轻简视图',
  subtitle: 'Airier canvas / quieter hierarchy',
  bg: '#edf1f7',
  bg2: '#f5f7fb',
  bg3: '#ffffff',
  surface: 'rgba(255, 255, 255, 0.76)',
  surface2: 'rgba(255, 255, 255, 0.90)',
  surface3: 'rgba(15, 23, 42, 0.05)',
  line: 'rgba(15, 23, 42, 0.10)',
  text: '#101828',
  muted: '#5d6b82',
  muted2: '#7c8798',
  accent: '#2f7cff',
  accent2: '#6a79ff',
  accent3: '#0f9d8c',
  chip: 'rgba(15, 23, 42, 0.04)',
  chipBorder: 'rgba(15, 23, 42, 0.08)',
  glow: 'rgba(47, 124, 255, 0.14)',
  canvasGlow: 'rgba(47, 124, 255, 0.10)',
}

const OUTPUTS = [
  { title: '输出 01', ratio: '1:1', tone: 'blue' },
  { title: '输出 02', ratio: '4:5', tone: 'violet' },
  { title: '输出 03', ratio: '16:9', tone: 'pink' },
]

const A_CARDS = [
  {
    className: 'panel panel-rail',
    style: 'left: 72px; top: 150px; width: 350px; height: 615px;',
    title: '任务输入',
    eyebrow: 'PROMPT RAIL',
    body: '生成未来的赛博朋克画面，带人物、城市反光、稀疏霓虹，像一张被精密组织过的视觉网络。',
    meta: [
      ['来源', '参考图 + 文本'],
      ['风格', '深色高对比'],
      ['输出', '3 张'],
    ],
    footer: ['参考图 02', '约束强', '可追踪'],
  },
  {
    className: 'panel panel-core panel-selected',
    style: 'left: 505px; top: 140px; width: 575px; height: 350px;',
    title: '关系图谱',
    eyebrow: 'CANVAS CORE',
    body: '节点按层级展开，主任务、参考图、分支结果和细化输出通过连线形成稳定的阅读路径。',
    meta: [
      ['节点', '12'],
      ['连线', '18'],
      ['选中', '1'],
    ],
    footer: ['层级强', '连线密', '可拖拽'],
  },
  {
    className: 'panel panel-inspector',
    style: 'left: 1128px; top: 120px; width: 340px; height: 248px;',
    title: '输出详情',
    eyebrow: 'DETAIL INSPECTOR',
    body: '选中卡片拉高、放大、发光，作为视觉锚点，让用户一眼知道当前焦点。',
    meta: [
      ['状态', '完成'],
      ['时长', '01:16'],
    ],
    footer: ['强锚点', '浮层卡片'],
  },
  {
    className: 'panel panel-bottom',
    style: 'left: 865px; top: 502px; width: 480px; height: 220px;',
    title: '输出队列',
    eyebrow: 'OUTPUT QUEUE',
    body: '底部保持低饱和信息条，辅助查看批量输出但不抢占主视觉。',
    meta: [
      ['第 1 轮', '3 张'],
      ['筛选', '未应用'],
      ['复用', '可用'],
    ],
    footer: ['轻提示', '不打断', '可继续'],
  },
]

const B_CARDS = [
  {
    className: 'panel panel-rail',
    style: 'left: 82px; top: 160px; width: 330px; height: 565px;',
    title: '任务输入',
    eyebrow: 'INPUT',
    body: '同样的任务信息，用更轻的层级组织，突出阅读感而不是控制感。',
    meta: [
      ['来源', '参考图'],
      ['风格', '浅底克制'],
      ['输出', '3 张'],
    ],
    footer: ['更轻', '更留白', '更直观'],
  },
  {
    className: 'panel panel-core',
    style: 'left: 500px; top: 170px; width: 520px; height: 300px;',
    title: '任务视图',
    eyebrow: 'CANVAS',
    body: '把任务、素材和结果压缩成更简单的阅读结构，降低初次进入的压迫感。',
    meta: [
      ['节点', '7'],
      ['连线', '8'],
      ['选中', '1'],
    ],
    footer: ['简化', '低噪声', '清爽'],
  },
  {
    className: 'panel panel-inspector',
    style: 'left: 1058px; top: 170px; width: 390px; height: 300px;',
    title: '摘要信息',
    eyebrow: 'SUMMARY',
    body: '右侧卡片更像一个摘要面板，强调状态与结果，而不是控制细节。',
    meta: [
      ['状态', '完成'],
      ['时间', '01:16'],
      ['质量', '稳定'],
    ],
    footer: ['更直白', '更像文档', '更少装饰'],
  },
]

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function themeCss(theme, compare = false) {
  return `
    :root {
      --bg: ${theme.bg};
      --bg2: ${theme.bg2};
      --bg3: ${theme.bg3};
      --surface: ${theme.surface};
      --surface2: ${theme.surface2};
      --surface3: ${theme.surface3};
      --line: ${theme.line};
      --text: ${theme.text};
      --muted: ${theme.muted};
      --muted2: ${theme.muted2};
      --accent: ${theme.accent};
      --accent2: ${theme.accent2};
      --accent3: ${theme.accent3};
      --chip: ${theme.chip};
      --chip-border: ${theme.chipBorder};
      --glow: ${theme.glow};
      --canvas-glow: ${theme.canvasGlow};
      --scale: ${compare ? '0.64' : '1'};
    }
  `
}

function renderMeta(meta) {
  return meta
    .map(([key, value]) => `
      <div class="meta-box">
        <div class="meta-k">${escapeHtml(key)}</div>
        <div class="meta-v">${escapeHtml(value)}</div>
      </div>
    `)
    .join('')
}

function renderFooterChips(chips, accent = false) {
  return chips
    .map((chip, index) => `
      <span class="chip ${accent && index === 0 ? 'chip-strong' : ''}">${escapeHtml(chip)}</span>
    `)
    .join('')
}

function renderOutputs(theme, compact = false) {
  return OUTPUTS.map((output, index) => `
    <article class="output-card output-${output.tone}" style="animation-delay:${index * 0.08}s">
      <div class="output-index">${index + 1}</div>
      <div class="output-copy">
        <div class="output-title">${escapeHtml(output.title)}</div>
        <div class="output-ratio">${escapeHtml(output.ratio)}</div>
      </div>
      <div class="output-preview">
        <span class="output-dot"></span>
        <span class="output-line"></span>
      </div>
    </article>
  `).join('')
}

function renderLinks(theme, variant) {
  if (variant === 'a') {
    return `
      <svg class="links" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="linkGlowA" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <path d="M420 360 C560 300 628 286 742 282" />
        <path d="M762 302 C858 316 936 326 1102 260" />
        <path d="M848 478 C920 540 1002 548 1080 526" />
        <path d="M628 556 C700 640 804 662 882 638" />
        <path d="M450 238 C526 196 604 190 704 218" />
        <circle cx="420" cy="360" r="5" />
        <circle cx="742" cy="282" r="6" />
        <circle cx="1102" cy="260" r="5" />
        <circle cx="848" cy="478" r="5" />
        <circle cx="1080" cy="526" r="5" />
        <circle cx="628" cy="556" r="5" />
        <circle cx="882" cy="638" r="5" />
      </svg>
    `
  }

  return `
    <svg class="links links-light" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="linkGlowB" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path d="M410 366 C545 316 624 308 744 300" />
      <path d="M732 300 C836 300 940 302 1092 270" />
      <path d="M640 534 C730 600 814 600 902 580" />
      <path d="M520 246 C602 214 682 214 764 244" />
      <circle cx="410" cy="366" r="4" />
      <circle cx="744" cy="300" r="5" />
      <circle cx="1092" cy="270" r="4" />
      <circle cx="640" cy="534" r="4" />
      <circle cx="902" cy="580" r="4" />
    </svg>
  `
}

function renderCard(card, theme, variant) {
  const smallCard = card.className.includes('panel-bottom') || card.className.includes('panel-inspector')
  return `
    <section class="${card.className}" style="${card.style}">
      <div class="panel-head">
        <div>
          <div class="eyebrow">${escapeHtml(card.eyebrow)}</div>
          <h2>${escapeHtml(card.title)}</h2>
        </div>
        <div class="badge">${variant === 'a' ? '深色' : '轻简'}</div>
      </div>
      <p class="panel-body">${escapeHtml(card.body)}</p>
      <div class="meta-grid ${smallCard ? 'meta-grid-tight' : ''}">
        ${renderMeta(card.meta)}
      </div>
      <div class="chip-row ${smallCard ? 'chip-row-tight' : ''}">
        ${renderFooterChips(card.footer, card.className.includes('panel-selected'))}
      </div>
    </section>
  `
}

function renderNodes(variant) {
  if (variant === 'a') {
    return `
      <div class="node node-main">
        <div class="node-top">
          <span class="node-id">01</span>
          <span class="node-tag">主任务</span>
        </div>
        <div class="node-title">生成未来的赛博朋克画面</div>
        <div class="node-sub">人物 + 城市反光 + 霓虹</div>
      </div>
      <div class="node node-secondary">
        <div class="node-top">
          <span class="node-id">02</span>
          <span class="node-tag">参考图</span>
        </div>
        <div class="node-title">语义约束</div>
        <div class="node-sub">高层级、强对比、稀疏高亮</div>
      </div>
      <div class="node node-tertiary">
        <div class="node-top">
          <span class="node-id">03</span>
          <span class="node-tag">输出</span>
        </div>
        <div class="node-title">3 张候选</div>
        <div class="node-sub">保留多样性</div>
      </div>
      <div class="node node-pulse">
        <div class="node-top">
          <span class="node-id">04</span>
          <span class="node-tag">选中</span>
        </div>
        <div class="node-title">发光锚点</div>
        <div class="node-sub">当前焦点高亮</div>
      </div>
    `
  }

  return `
    <div class="node node-main node-light">
      <div class="node-top">
        <span class="node-id">01</span>
        <span class="node-tag">任务</span>
      </div>
      <div class="node-title">生成未来的赛博朋克画面</div>
      <div class="node-sub">更直白的阅读顺序</div>
    </div>
    <div class="node node-secondary node-light">
      <div class="node-top">
        <span class="node-id">02</span>
        <span class="node-tag">输入</span>
      </div>
      <div class="node-title">参考图</div>
      <div class="node-sub">必要信息保留</div>
    </div>
    <div class="node node-tertiary node-light">
      <div class="node-top">
        <span class="node-id">03</span>
        <span class="node-tag">结果</span>
      </div>
      <div class="node-title">3 张候选</div>
      <div class="node-sub">轻量摘要</div>
    </div>
  `
}

function renderScene(theme, variant) {
  const cards = variant === 'a' ? A_CARDS : B_CARDS
  return `
    <div class="frame">
      <div class="ambient ambient-1"></div>
      <div class="ambient ambient-2"></div>
      <div class="ambient ambient-3"></div>
      <div class="grid"></div>
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark"></div>
          <div>
            <div class="brand-title">Cherry AI</div>
            <div class="brand-sub">${escapeHtml(theme.subtitle)}</div>
          </div>
        </div>
        <div class="topbar-meta">
          <span class="top-chip">${escapeHtml(theme.label)} · ${escapeHtml(theme.title)}</span>
          <span class="top-chip">${variant === 'a' ? '关系网优先' : '阅读感优先'}</span>
        </div>
      </div>
      <div class="workspace">
        ${renderLinks(theme, variant)}
        <div class="canvas-title">
          <div class="canvas-eyebrow">INFINITE CANVAS</div>
          <div class="canvas-heading">${variant === 'a' ? '深色无限画布' : '轻简无限画布'}</div>
          <div class="canvas-copy">${variant === 'a'
            ? '更像一张夜色中的调度台：黑、密、亮点少，但每个节点都有明确归属。'
            : '更像一张被抬亮的工作画布：少一点压迫，多一点留白，信息可以更快扫读。'}</div>
        </div>
        <div class="node-cluster">
          ${renderNodes(variant)}
        </div>
        ${cards.map((card) => renderCard(card, theme, variant)).join('')}
        <div class="floating-pills ${variant === 'a' ? '' : 'floating-pills-light'}">
          <span class="float-pill">拖拽排布</span>
          <span class="float-pill">连接关系</span>
          <span class="float-pill">输出分组</span>
          <span class="float-pill">无限延展</span>
        </div>
        <div class="output-rail">
          ${renderOutputs(theme)}
        </div>
        <div class="edge-hint edge-left"></div>
        <div class="edge-hint edge-right"></div>
      </div>
    </div>
  `
}

function renderCompareScene(theme, variant, caption) {
  return `
    <section class="compare-panel compare-panel-${variant}">
      <div class="compare-caption">
        <div>
          <div class="compare-label">${caption}</div>
          <div class="compare-sub">${variant === 'a'
            ? '深色、浮层、连线更强'
            : '更轻、更简、更留白'}</div>
        </div>
        <div class="compare-mini">${variant === 'a' ? '推荐方向' : '对照方案'}</div>
      </div>
      <div class="compare-viewport">
        <img class="compare-image" src="./cherry-ai-scheme-${variant}.png" alt="${caption}" />
      </div>
      <div class="compare-footer">
        ${variant === 'a'
          ? '<span class="compare-chip compare-chip-strong">深色工作台</span><span class="compare-chip">关系连线</span><span class="compare-chip">高层级</span>'
          : '<span class="compare-chip compare-chip-soft">轻简视图</span><span class="compare-chip">低噪声</span><span class="compare-chip">更留白</span>'}
      </div>
    </section>
  `
}

function renderHtml(theme, variant, compare = false) {
  const scene = compare
    ? `
      <main class="compare-shell">
        <header class="compare-header">
          <div>
            <div class="compare-overline">A / B 比较</div>
            <h1 class="compare-title">选择最终视觉方向</h1>
          </div>
          <div class="compare-note">左侧更推荐，右侧作为简洁对照</div>
        </header>
        ${renderCompareScene(A, 'a', 'A / 深色工作台')}
        ${renderCompareScene(B, 'b', 'B / 轻简视图')}
      </main>
    `
    : renderScene(theme, variant)

  const pageClass = compare ? 'page page-compare' : `page page-${theme.id}`

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${compare ? 'cherry-ai compare' : `${theme.id} mockup`}</title>
  <style>
    ${themeCss(theme, compare)}
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at 22% 12%, var(--canvas-glow), transparent 28%),
        radial-gradient(circle at 78% 16%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 24%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg2) 55%, var(--bg) 100%);
    }
    body {
      font-family: Inter, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Segoe UI", sans-serif;
      color: var(--text);
    }
    .page {
      position: relative;
      width: 1600px;
      height: 1000px;
      overflow: hidden;
    }
    .page-compare {
      width: 2320px;
      height: 1320px;
      background:
        radial-gradient(circle at 50% 0%, rgba(47,124,255,0.10), transparent 24%),
        linear-gradient(180deg, #111723 0%, #151b28 100%);
    }
    .page-compare::before {
      content: "";
      position: absolute;
      inset: 18px;
      border-radius: 36px;
      border: 1px solid rgba(255,255,255,0.06);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
      pointer-events: none;
    }
    .frame {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .ambient {
      position: absolute;
      pointer-events: none;
      filter: blur(28px);
    }
    .ambient-1 {
      left: -120px;
      top: -60px;
      width: 420px;
      height: 260px;
      background: radial-gradient(circle, var(--glow) 0%, transparent 70%);
    }
    .ambient-2 {
      right: 70px;
      top: 48px;
      width: 460px;
      height: 320px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent2) 22%, transparent) 0%, transparent 72%);
      opacity: 0.85;
    }
    .ambient-3 {
      left: 52px;
      bottom: -90px;
      width: 560px;
      height: 220px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent3) 20%, transparent) 0%, transparent 72%);
      opacity: 0.35;
    }
    .grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(var(--line) 1px, transparent 1px),
        linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size: 54px 54px, 54px 54px;
      mask-image: radial-gradient(circle at 50% 48%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 46%, rgba(0,0,0,0.05) 100%);
      opacity: 0.75;
    }
    .topbar {
      position: absolute;
      left: 60px;
      right: 60px;
      top: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 4;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-mark {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--accent), var(--accent2));
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 16%, transparent), 0 0 24px var(--glow);
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .brand-sub {
      margin-top: 3px;
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .topbar-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .top-chip {
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
    }
    .workspace {
      position: absolute;
      inset: 110px 36px 36px 36px;
      border-radius: 34px;
      overflow: hidden;
      background:
        radial-gradient(circle at 44% 22%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 24%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg3) 14%, transparent) 0%, transparent 100%);
      border: 1px solid color-mix(in srgb, var(--line) 100%, transparent);
      box-shadow:
        0 20px 90px rgba(0,0,0,0.35),
        inset 0 1px 0 rgba(255,255,255,0.04);
      transform-origin: top left;
    }
    .page-compare .workspace {
      inset: 100px 26px 26px 26px;
    }
    .canvas-title {
      position: absolute;
      left: 58px;
      top: 48px;
      z-index: 3;
      max-width: 390px;
    }
    .canvas-eyebrow {
      font-size: 12px;
      letter-spacing: 0.28em;
      color: var(--muted2);
      text-transform: uppercase;
    }
    .canvas-heading {
      margin-top: 12px;
      font-size: 34px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .canvas-copy {
      margin-top: 14px;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
      max-width: 420px;
    }
    .links {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: visible;
      fill: none;
      stroke: color-mix(in srgb, var(--accent) 78%, transparent);
      stroke-width: 2.4;
      stroke-linecap: round;
      filter: drop-shadow(0 0 12px var(--glow));
      opacity: 0.84;
    }
    .links path {
      stroke-dasharray: 5 8;
      animation: dash 28s linear infinite;
    }
    .links circle {
      fill: var(--accent);
      opacity: 0.92;
    }
    .links-light {
      opacity: 0.62;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 34%, transparent));
    }
    @keyframes dash {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: -180; }
    }
    .node-cluster {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
    }
    .node {
      position: absolute;
      width: 220px;
      padding: 16px 16px 15px;
      border-radius: 26px;
      border: 1px solid var(--chip-border);
      background: var(--surface);
      box-shadow:
        0 20px 50px rgba(0,0,0,0.18),
        inset 0 1px 0 rgba(255,255,255,0.03);
      backdrop-filter: blur(18px);
    }
    .node-light {
      box-shadow:
        0 18px 50px rgba(15,23,42,0.08),
        inset 0 1px 0 rgba(255,255,255,0.85);
    }
    .node-top {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .node-id {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 11px;
      letter-spacing: 0.12em;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--text);
      border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
    }
    .node-tag {
      color: var(--muted2);
    }
    .node-title {
      margin-top: 14px;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.01em;
    }
    .node-sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .node-main {
      left: 562px;
      top: 210px;
      width: 260px;
      transform: rotate(-1.5deg);
      border-color: color-mix(in srgb, var(--accent) 18%, transparent);
    }
    .node-secondary {
      left: 112px;
      top: 214px;
      width: 220px;
    }
    .node-tertiary {
      left: 990px;
      top: 252px;
      width: 220px;
    }
    .node-pulse {
      left: 682px;
      top: 468px;
      width: 210px;
      border-color: color-mix(in srgb, var(--accent3) 28%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent3) 16%, transparent), 0 24px 60px rgba(0,0,0,0.30);
    }
    .node-main.node-light,
    .node-secondary.node-light,
    .node-tertiary.node-light {
      transform: none;
    }
    .panel {
      position: absolute;
      z-index: 3;
      border-radius: 30px;
      border: 1px solid var(--chip-border);
      background: var(--surface);
      box-shadow:
        0 24px 84px rgba(0,0,0,0.32),
        inset 0 1px 0 rgba(255,255,255,0.04);
      padding: 20px 20px 18px;
      backdrop-filter: blur(18px);
    }
    .panel-selected {
      border-color: color-mix(in srgb, var(--accent) 45%, transparent);
      box-shadow:
        0 28px 96px rgba(0,0,0,0.45),
        0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent),
        0 0 54px color-mix(in srgb, var(--accent) 10%, transparent);
      transform: translateY(-2px);
    }
    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .eyebrow {
      color: var(--muted2);
      font-size: 11px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
    }
    h2 {
      margin: 8px 0 0;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .badge {
      flex: none;
      padding: 9px 12px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      color: var(--text);
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .panel-body {
      margin: 16px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.8;
      max-width: 100%;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .meta-grid-tight {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .meta-box {
      border-radius: 18px;
      border: 1px solid var(--chip-border);
      background: color-mix(in srgb, var(--bg3) 16%, transparent);
      padding: 12px 13px 11px;
    }
    .meta-k {
      color: var(--muted2);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .meta-v {
      margin-top: 7px;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .chip-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .chip-row-tight {
      margin-top: 12px;
    }
    .chip {
      height: 34px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .chip-strong {
      color: var(--text);
      border-color: color-mix(in srgb, var(--accent) 26%, var(--chip-border));
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .panel-rail {
      padding-bottom: 20px;
    }
    .panel-core {
      border-color: color-mix(in srgb, var(--accent) 18%, transparent);
    }
    .panel-inspector {
      box-shadow:
        0 20px 64px rgba(0,0,0,0.24),
        inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .panel-bottom {
      border-color: color-mix(in srgb, var(--accent2) 18%, transparent);
    }
    .floating-pills {
      position: absolute;
      left: 72px;
      bottom: 170px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      z-index: 2;
    }
    .floating-pills-light {
      left: 58px;
      bottom: 156px;
    }
    .float-pill {
      padding: 9px 12px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .output-rail {
      position: absolute;
      left: 64px;
      right: 64px;
      bottom: 28px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      z-index: 3;
    }
    .output-card {
      position: relative;
      min-height: 96px;
      border-radius: 24px;
      border: 1px solid var(--chip-border);
      background: var(--surface);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 20px 44px rgba(0,0,0,0.18);
      animation: rise 1s ease both;
    }
    .output-blue {
      border-color: color-mix(in srgb, var(--accent) 18%, var(--chip-border));
    }
    .output-violet {
      border-color: color-mix(in srgb, var(--accent2) 18%, var(--chip-border));
    }
    .output-pink {
      border-color: color-mix(in srgb, var(--accent3) 20%, var(--chip-border));
    }
    .output-index {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      border: 1px solid var(--chip-border);
      color: var(--muted);
      font-size: 12px;
    }
    .output-copy {
      flex: 1;
      margin: 0 16px;
    }
    .output-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .output-ratio {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    .output-preview {
      position: relative;
      width: 72px;
      height: 58px;
      border-radius: 16px;
      border: 1px solid var(--chip-border);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent),
        color-mix(in srgb, var(--bg3) 12%, transparent);
      overflow: hidden;
    }
    .output-dot {
      position: absolute;
      left: 14px;
      top: 13px;
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--accent), var(--accent2));
      box-shadow: 0 0 20px var(--glow);
    }
    .output-line {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 14px;
      height: 3px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 42%, transparent);
    }
    .edge-hint {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 16px;
      z-index: 0;
      background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 30%, transparent), transparent);
      opacity: 0.42;
    }
    .edge-left {
      left: 0;
    }
    .edge-right {
      right: 0;
      transform: scaleX(-1);
    }
    .compare-shell {
      position: absolute;
      inset: 34px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto 1fr;
      gap: 18px 22px;
      z-index: 1;
    }
    .compare-header {
      grid-column: 1 / -1;
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      padding: 8px 8px 4px;
    }
    .compare-overline {
      color: var(--muted2);
      font-size: 12px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
    }
    .compare-title {
      margin: 10px 0 0;
      font-size: 42px;
      line-height: 1;
      letter-spacing: -0.03em;
    }
    .compare-note {
      color: var(--muted);
      font-size: 15px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .compare-panel {
      position: relative;
      border-radius: 30px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      background:
        radial-gradient(circle at 25% 18%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 24%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg3) 8%, transparent), rgba(255,255,255,0.02));
      box-shadow: 0 24px 90px rgba(0,0,0,0.26);
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: 22px;
    }
    .compare-panel-b {
      background:
        radial-gradient(circle at 82% 18%, rgba(47,124,255,0.16), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.92));
    }
    .compare-caption {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .compare-label {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .compare-sub {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .compare-panel-b .compare-sub,
    .compare-panel-b .compare-note {
      color: rgba(15, 23, 42, 0.54);
    }
    .compare-mini {
      padding: 9px 13px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .compare-viewport {
      position: relative;
      min-height: 0;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid var(--chip-border);
      background:
        radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .compare-panel-b .compare-viewport {
      background:
        radial-gradient(circle at 50% 40%, rgba(47,124,255,0.10), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.95));
    }
    .compare-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 18px;
      box-shadow: 0 14px 42px rgba(0,0,0,0.22);
    }
    .compare-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .compare-chip {
      padding: 9px 12px;
      border-radius: 999px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .compare-chip-strong {
      color: var(--text);
      border-color: color-mix(in srgb, var(--accent) 24%, var(--chip-border));
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .compare-chip-soft {
      color: rgba(15, 23, 42, 0.88);
      border-color: rgba(15, 23, 42, 0.10);
      background: rgba(15, 23, 42, 0.04);
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body class="${pageClass}">
  ${scene}
</body>
</html>`
}

async function writePage(name, html) {
  const htmlPath = path.join(ROOT, `${name}.html`)
  await fs.writeFile(htmlPath, html, 'utf8')
  return htmlPath
}

function capture(htmlPath, pngPath, width, height) {
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    '--virtual-time-budget=1200',
    `--window-size=${width},${height}`,
    `--screenshot=${pngPath}`,
    `file://${htmlPath}`,
  ], { stdio: 'pipe' })
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true })

  const pages = [
    { name: 'cherry-ai-scheme-a', html: renderHtml(A, 'a', false), width: 1600, height: 1000 },
    { name: 'cherry-ai-scheme-b', html: renderHtml(B, 'b', false), width: 1600, height: 1000 },
    { name: 'cherry-ai-compare', html: renderHtml(A, 'a', true), width: 2320, height: 1320 },
  ]

  for (const page of pages) {
    const htmlPath = await writePage(page.name, page.html)
    const pngPath = path.join(ROOT, `${page.name}.png`)
    capture(htmlPath, pngPath, page.width, page.height)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
