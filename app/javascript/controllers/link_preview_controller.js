import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { offset: { type: Number, default: 12 } }

  connect() {
    this.tooltip = document.createElement("div")
    this.tooltip.className = "wiki-link-preview"
    this.tooltip.setAttribute("role", "tooltip")
    this.tooltip.hidden = true
    document.body.appendChild(this.tooltip)

    this.prefetchFavicons()

    this.boundMove = this.onMouseMove.bind(this)
    this.boundEnter = this.onArticleEnter.bind(this)
    this.boundLeave = this.onArticleLeave.bind(this)

    this.element.addEventListener("mouseenter", this.boundEnter)
    this.element.addEventListener("mouseleave", this.boundLeave)
  }

  disconnect() {
    this.element.removeEventListener("mouseenter", this.boundEnter)
    this.element.removeEventListener("mouseleave", this.boundLeave)
    document.removeEventListener("mousemove", this.boundMove)
    this.tooltip?.remove()
  }

  onArticleEnter() {
    document.addEventListener("mousemove", this.boundMove)
  }

  onArticleLeave() {
    this.tooltip.hidden = true
    document.removeEventListener("mousemove", this.boundMove)
  }

  onMouseMove(e) {
    const link = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("a[href]")
    const offset = this.offsetValue
    this.tooltip.style.left = `${e.clientX + offset}px`
    this.tooltip.style.top = `${e.clientY + offset}px`
    if (link && this.element.contains(link)) {
      const href = link.getAttribute("href")
      if (href && !href.startsWith("#")) {
        const preview = this.getPreviewForHref(href, link)
        if (!preview) {
          this.tooltip.hidden = true
          return
        }
        const icon = preview.icon === "envelope"
          ? this.envelopeIconSvg()
          : preview.faviconUrl
            ? `<img src="${preview.faviconUrl}" alt="" class="wiki-link-preview-favicon">`
            : ""
        this.tooltip.innerHTML = icon + this.escapeHtml(preview.label)
        this.tooltip.hidden = false
        return
      }
    }
    this.tooltip.hidden = true
  }

  envelopeIconSvg() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>'
    return `<span class="wiki-link-preview-icon wiki-link-preview-icon--envelope" aria-hidden="true">${svg}</span>`
  }

  getPreviewForHref(href, link) {
    try {
      if (href.startsWith("mailto:")) {
        return { label: href.replace(/^mailto:/, "").split("?")[0].trim() || "Email", icon: "envelope" }
      }
      if (href.startsWith("tel:")) return null
      const url = new URL(href, window.location.origin)
      if (url.origin === window.location.origin) {
        const path = (url.pathname.replace(/^\//, "") || url.searchParams.get("path") || "").replace(/\/$/, "")
        if (this.isBoringPath(path)) return null
        const title = this.prefetchedTitles?.get(path) ?? link.dataset.previewTitle ?? link.textContent?.trim()
        return { label: title || path || "LatinWiki", faviconUrl: null }
      }
      const domain = url.hostname.replace(/^www\./, "")
      const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(url.hostname)}`
      return { label: domain, faviconUrl }
    } catch {
      return null
    }
  }

  isBoringPath(path) {
    return !path || /^(edit|diff|history|search|auth|logout|pages)(\/|$|\?)/.test(path)
  }

  prefetchFavicons() {
    this.prefetchedTitles = new Map()
    const seen = new Set()
    this.element.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href")
      if (!href || href.startsWith("#")) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin === window.location.origin) {
          const path = (url.pathname.replace(/^\//, "") || url.searchParams.get("path") || "").replace(/\/$/, "")
          if (path && !this.isBoringPath(path) && !this.prefetchedTitles.has(path)) {
            this.prefetchedTitles.set(path, null)
            fetch(`/api/link_preview?path=${encodeURIComponent(path)}`)
              .then((r) => r.ok && r.json())
              .then((data) => { if (data?.title) this.prefetchedTitles.set(path, data.title) })
              .catch(() => {})
          }
        } else {
          const { faviconUrl } = this.parseHrefForPreview(href)
          if (faviconUrl && !seen.has(faviconUrl)) {
            seen.add(faviconUrl)
            const img = new Image()
            img.src = faviconUrl
          }
        }
      } catch (_) {}
    })
  }

  parseHrefForPreview(href) {
    try {
      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        return { domain: href.replace(/^[a-z]+:/, ""), faviconUrl: null }
      }
      const url = new URL(href, window.location.origin)
      const domain = url.hostname.replace(/^www\./, "")
      const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(url.hostname)}`
      return { domain, faviconUrl }
    } catch {
      return { domain: href, faviconUrl: null }
    }
  }

  escapeHtml(s) {
    const div = document.createElement("div")
    div.textContent = s
    return div.innerHTML
  }
}
