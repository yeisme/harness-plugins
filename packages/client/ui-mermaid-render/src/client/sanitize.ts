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
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'use',
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

const DANGEROUS_VALUE = /url\(|javascript:|<script/i

function sanitizeStyleValue(value: string): string {
  return DANGEROUS_VALUE.test(value) ? '' : value
}

function sanitizeElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
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
  sanitizeElement(svg)
  const style = `${svg.getAttribute('style') ?? ''};max-width:100%;height:auto;`
  svg.setAttribute('style', style)
  return svg.outerHTML
}
