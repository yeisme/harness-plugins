/**
 * mermaid SVG 白名单净化。
 *
 * mermaid 已以 securityLevel:'strict' 运行（转义标签 HTML、禁 click 链接），
 * 这里再按"允许列表"收紧一遍：未知标签/属性、<style>/<script>/foreignObject、
 * url(...) 与事件属性一律丢弃。净化失败抛错，由 graft 层降级回源码。
 */

const TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline',
  'line', 'text', 'tspan', 'defs', 'marker', 'title', 'desc',
  'lineargradient', 'radialgradient', 'stop', 'pattern', 'clippath', 'use',
])

const ATTRS = new Set([
  'id', 'class', 'style', 'transform', 'viewBox', 'preserveAspectRatio',
  'xmlns', 'role', 'aria-label', 'aria-hidden', 'aria-roledescription',
  'd', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
  'cx', 'cy', 'r', 'rx', 'ry', 'offset', 'gradientTransform',
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dx', 'dy', 'dominant-baseline',
  'marker-end', 'marker-start', 'marker-mid',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
  'patternUnits', 'clipPathUnits', 'spreadMethod', 'stop-color',
])

const DANGEROUS_VALUE = /url\s*\(|javascript:|<script|expression\s*\(/i

// Project only inert SVG presentation from Mermaid's generated CSS. Never
// attach its stylesheet to the Host document or preserve executable CSS.
const PRESENTATION = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family',
  'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline']

function materializePresentation(svg: Element): void {
  if (typeof CSSStyleSheet === 'undefined' || typeof CSSStyleSheet.prototype.replaceSync !== 'function') return
  const inline = new Map<Element, string>()
  for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) inline.set(element, element.getAttribute('style') ?? '')
  for (const source of Array.from(svg.querySelectorAll('style'))) {
    if (/@import|url\s*\(|\\/iu.test(source.textContent ?? '')) continue
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(source.textContent ?? '')
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue
      let elements: Element[]
      try { elements = Array.from(svg.querySelectorAll(rule.selectorText)); if (svg.matches(rule.selectorText)) elements.unshift(svg) } catch { continue }
      for (const property of PRESENTATION) {
        const value = rule.style.getPropertyValue(property).trim()
        if (!value || /url\s*\(|var\s*\(|expression\s*\(|[<>\\]/iu.test(value)) continue
        for (const element of elements) element.setAttribute(property, value)
      }
    }
  }
  // Explicit inline declarations retain precedence over generated rules.
  for (const [element, original] of inline) {
    const style = document.createElement('span').style
    style.cssText = original
    for (const property of PRESENTATION) {
      const value = style.getPropertyValue(property).trim()
      if (value && !/url\s*\(|var\s*\(|expression\s*\(|[<>\\]/iu.test(value)) element.setAttribute(property, value)
    }
  }
}

function sanitizeStyleValue(value: string): string {
  if (DANGEROUS_VALUE.test(value) || /\\/u.test(value)) return ''
  const parsed = document.createElement('span').style
  parsed.cssText = value
  return PRESENTATION.flatMap(property => {
    const safe = parsed.getPropertyValue(property).trim()
    return safe && !/var\s*\(|[<>]/iu.test(safe) ? [`${property}:${safe}`] : []
  }).join(';')
}

function sanitizeElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (['marker-end', 'marker-start', 'marker-mid'].includes(attr.name)) {
      const local = /^url\(#([A-Za-z_][\w.-]*)\)$/u.exec(attr.value)
      if (local !== null && el.ownerDocument.getElementById(local[1]!)?.tagName.toLowerCase() === 'marker') continue
    }
    if (!ATTRS.has(attr.name) || DANGEROUS_VALUE.test(attr.value)) el.removeAttribute(attr.name)
    else if (attr.name === 'style') el.setAttribute('style', sanitizeStyleValue(attr.value))
  }
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'style' || tag === 'script' || tag === 'foreignobject' || !TAGS.has(tag)) child.remove()
    else sanitizeElement(child)
  }
}

/** 净化一段 mermaid SVG 输出；非 SVG 输入抛错。 */
export function sanitizeMermaidSvg(svgText: string): string {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg === null || svg.tagName.toLowerCase() !== 'svg') throw new Error('mermaid output is not an svg document')
  materializePresentation(svg)
  sanitizeElement(svg)
  const style = `${svg.getAttribute('style') ?? ''};max-width:100%;height:auto;`
  svg.setAttribute('style', style)
  return svg.outerHTML
}
