import { readFile, writeFile } from 'node:fs/promises'
import { marked } from 'marked'

const sourcePath = new URL('../docs/manual/infinite-canvas-guide.md', import.meta.url)
const outputPath = new URL('../public/manual/index.html', import.meta.url)

const source = (await readFile(sourcePath, 'utf8'))
  .replaceAll('../../public/manual/images/', './images/')

marked.setOptions({
  gfm: true,
  breaks: false,
})

const article = await marked.parse(source)
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="无限画布的模型配置、画布使用与 API 接口说明。">
  <title>无限画布使用教程</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f5;
      --panel: rgba(255, 255, 255, .92);
      --text: #242424;
      --muted: #6b6b68;
      --line: #e3e3df;
      --accent: #2563eb;
      --code-bg: #171717;
      --code-text: #f5f5f5;
      --shadow: 0 18px 50px rgba(31, 35, 48, .08);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: radial-gradient(circle at 15% 0, #eef4ff 0, transparent 28rem), var(--bg);
      color: var(--text);
      font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    a { color: var(--accent); text-underline-offset: 3px; }
    .shell { width: min(1380px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 72px; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
      color: var(--muted);
      font-size: 14px;
    }
    .brand { color: var(--text); font-weight: 700; letter-spacing: .02em; }
    .layout { display: grid; grid-template-columns: 250px minmax(0, 900px); justify-content: center; gap: 28px; align-items: start; }
    .toc {
      position: sticky;
      top: 20px;
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .toc-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .toc a { display: block; padding: 5px 8px; border-radius: 7px; color: var(--muted); text-decoration: none; font-size: 14px; line-height: 1.45; }
    .toc a:hover, .toc a.active { color: var(--accent); background: rgba(37, 99, 235, .08); }
    .toc a[data-level="3"] { padding-left: 22px; font-size: 13px; }
    article {
      min-width: 0;
      padding: clamp(24px, 4vw, 56px);
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    h1, h2, h3, h4, h5 { line-height: 1.3; scroll-margin-top: 24px; }
    h1 { margin: 0 0 1.2em; font-size: clamp(30px, 5vw, 46px); letter-spacing: -.035em; }
    h2 { margin: 2.2em 0 .8em; padding-top: .3em; border-top: 1px solid var(--line); font-size: 27px; }
    h3 { margin: 1.8em 0 .65em; font-size: 21px; }
    h4 { margin: 1.5em 0 .55em; font-size: 18px; }
    h5 { margin: 1.35em 0 .5em; font-size: 16px; }
    p, ul, ol { margin: .85em 0; }
    li + li { margin-top: .28em; }
    strong { color: #b42318; }
    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 24px auto;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 8px 30px rgba(0, 0, 0, .08);
    }
    pre {
      position: relative;
      overflow-x: auto;
      margin: 18px 0;
      padding: 20px;
      border-radius: 12px;
      background: var(--code-bg);
      color: var(--code-text);
      font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    :not(pre) > code { padding: .16em .4em; border-radius: 5px; background: rgba(127, 127, 127, .14); font-size: .9em; }
    blockquote { margin: 18px 0; padding: 2px 18px; border-left: 4px solid var(--accent); color: var(--muted); }
    hr { margin: 36px 0; border: 0; border-top: 1px solid var(--line); }
    .footer { margin-top: 28px; text-align: center; color: var(--muted); font-size: 13px; }
    .mobile-toc { display: none; width: 100%; margin-bottom: 16px; padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--text); }
    @media (max-width: 900px) {
      .shell { width: min(100% - 20px, 760px); padding-top: 16px; }
      .layout { display: block; }
      .toc { display: none; }
      .mobile-toc { display: block; }
      article { padding: 24px 18px; border-radius: 16px; }
      h2 { font-size: 24px; }
      pre { margin-inline: -8px; padding: 16px; }
    }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; --bg: #111210; --panel: rgba(28, 29, 27, .94); --text: #eeeeea; --muted: #a7a7a0; --line: #3a3b37; --accent: #80aaff; --shadow: none; }
      body { background: radial-gradient(circle at 15% 0, #172443 0, transparent 28rem), var(--bg); }
      strong { color: #ff9b8f; }
      img { background: #fff; }
    }
    @media print {
      body { background: #fff; }
      .shell { width: 100%; padding: 0; }
      .topbar, .toc, .mobile-toc, .footer { display: none; }
      .layout { display: block; }
      article { padding: 0; border: 0; box-shadow: none; }
      pre { white-space: pre-wrap; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar"><span class="brand">GPT Image Playground</span><span>操作文档</span></header>
    <select class="mobile-toc" aria-label="跳转到章节"><option value="">目录</option></select>
    <div class="layout">
      <nav class="toc" aria-label="文章目录"><p class="toc-title">目录</p><div id="toc-links"></div></nav>
      <article>${article}</article>
    </div>
    <footer class="footer">由项目内 Markdown 自动生成 · 更新内容后运行 npm run build:manual</footer>
  </div>
  <script>
    const headings = [...document.querySelectorAll('article h1, article h2, article h3')]
    const toc = document.querySelector('#toc-links')
    const mobileToc = document.querySelector('.mobile-toc')
    const used = new Map()
    const slugify = (text) => {
      const base = text.trim().toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
      const count = used.get(base) || 0
      used.set(base, count + 1)
      return count ? base + '-' + (count + 1) : base
    }
    headings.forEach((heading, index) => {
      const id = slugify(heading.textContent || ('section-' + index))
      heading.id = id
      if (heading.tagName === 'H1' && index === 0) return
      const link = document.createElement('a')
      link.href = '#' + id
      link.textContent = heading.textContent
      link.dataset.level = heading.tagName.slice(1)
      toc.append(link)
      const option = document.createElement('option')
      option.value = '#' + id
      option.textContent = (heading.tagName === 'H3' ? '　' : '') + heading.textContent
      mobileToc.append(option)
    })
    mobileToc.addEventListener('change', () => {
      if (mobileToc.value) location.hash = mobileToc.value
      mobileToc.value = ''
    })
    const links = [...toc.querySelectorAll('a')]
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (!visible) return
      links.forEach((link) => link.classList.toggle('active', link.hash === '#' + visible.target.id))
    }, { rootMargin: '-10% 0px -75%' })
    headings.forEach((heading) => observer.observe(heading))
  </script>
  <!-- generated from docs/manual/infinite-canvas-guide.md -->
</body>
</html>
`

await writeFile(outputPath, html)
console.log(`Generated ${outputPath.pathname}`)
