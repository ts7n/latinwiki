import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["editor", "input", "linkModal", "linkText", "linkUrl", "unlinkBtn", "linkBubble", "embedModal", "embedCode", "draftLinkWrap", "draftLink"]
  static values = { draftKey: String }

  connect() {
    this.form = this.element.closest("form")
    if (this.form) {
      this.form.addEventListener("submit", this.handleSubmit.bind(this))
      this.form.addEventListener("keydown", this.handleFormKeydown.bind(this))
    }
    this.linkModalTarget.addEventListener("keydown", this.handleModalKeydown.bind(this))
    if (this.hasEmbedModalTarget) {
      this.embedModalTarget.addEventListener("keydown", this.handleEmbedModalKeydown.bind(this))
    }
    this.editorTarget.addEventListener("keydown", this.handleEditorKeydown.bind(this))
    this.editorTarget.addEventListener("input", this.boundHandleInput = this.handleInput.bind(this))
    this.editorTarget.addEventListener("paste", this.boundHandlePaste = this.handlePaste.bind(this))
    this.editorTarget.addEventListener("click", (this.boundHandleEditorClick = this.handleEditorClick.bind(this)))
    document.addEventListener("selectionchange", this.boundUpdateLinkBubble = this.updateLinkBubble.bind(this))
    document.addEventListener("selectionchange", this.boundUpdateToolbarState = this.updateToolbarState.bind(this))
    this.editorTarget.addEventListener("click", this.boundUpdateLinkBubble)
    this.editorTarget.addEventListener("click", this.boundUpdateToolbarState)
    this.editorTarget.addEventListener("keyup", this.boundUpdateLinkBubble)
    this.editorTarget.addEventListener("keyup", this.boundUpdateToolbarState)
    this.editorTarget.addEventListener("scroll", this.boundUpdateLinkBubble)
    this.savedSelection = null
    this.currentLinkAnchors = []
    if (this.hasDraftKeyValue) {
      this.boundSaveDraft = this.scheduleSaveDraft.bind(this)
      this.editorTarget.addEventListener("input", this.boundSaveDraft)
      this.form?.addEventListener("input", this.boundSaveDraft)
      // Only show the draft link for drafts that existed before this page load
      this.updateDraftLink()
      this.draftLinkFrozen = true
    }
    setTimeout(() => this.updateToolbarState(), 0)
  }

  disconnect() {
    if (this.form) {
      this.form.removeEventListener("submit", this.handleSubmit.bind(this))
      this.form.removeEventListener("keydown", this.handleFormKeydown.bind(this))
    }
    if (this.boundSaveDraft) {
      this.editorTarget.removeEventListener("input", this.boundSaveDraft)
      this.form?.removeEventListener("input", this.boundSaveDraft)
      if (this.draftSaveTimeout) clearTimeout(this.draftSaveTimeout)
    }
    this.linkModalTarget?.removeEventListener("keydown", this.handleModalKeydown.bind(this))
    if (this.hasEmbedModalTarget) {
      this.embedModalTarget.removeEventListener("keydown", this.handleEmbedModalKeydown.bind(this))
    }
    this.editorTarget?.removeEventListener("keydown", this.handleEditorKeydown.bind(this))
    this.editorTarget?.removeEventListener("input", this.boundHandleInput)
    this.editorTarget?.removeEventListener("paste", this.boundHandlePaste)
    if (this.boundHandleEditorClick) {
      this.editorTarget.removeEventListener("click", this.boundHandleEditorClick)
    }
    if (this.boundUpdateLinkBubble) {
      document.removeEventListener("selectionchange", this.boundUpdateLinkBubble)
      this.editorTarget?.removeEventListener("click", this.boundUpdateLinkBubble)
      this.editorTarget?.removeEventListener("keyup", this.boundUpdateLinkBubble)
      this.editorTarget?.removeEventListener("scroll", this.boundUpdateLinkBubble)
    }
    if (this.boundUpdateToolbarState) {
      document.removeEventListener("selectionchange", this.boundUpdateToolbarState)
      this.editorTarget?.removeEventListener("click", this.boundUpdateToolbarState)
      this.editorTarget?.removeEventListener("keyup", this.boundUpdateToolbarState)
    }
  }

  updateToolbarState() {
    const sel = window.getSelection()
    if (!sel.rangeCount || !this.editorTarget.contains(sel.anchorNode)) {
      this.element.querySelectorAll("[data-format]").forEach((btn) => btn.classList.remove("wiki-editor-btn--active"))
      return
    }
    const activeFormats = new Set()
    const block = this.getBlockAncestor(sel.anchorNode)
    const inHeading = block && (block.tagName === "H2" || block.tagName === "H3")
    if (document.queryCommandState("bold") && !inHeading) activeFormats.add("bold")
    if (document.queryCommandState("italic")) activeFormats.add("italic")
    if (document.queryCommandState("insertUnorderedList")) activeFormats.add("insertUnorderedList")
    if (document.queryCommandState("insertOrderedList")) activeFormats.add("insertOrderedList")
    if (block) {
      const tag = block.tagName.toUpperCase()
      if (tag === "H2" || tag === "H3") activeFormats.add(tag.toLowerCase())
      if (block.closest?.("blockquote")) activeFormats.add("blockquote")
    }
    this.element.querySelectorAll("[data-format]").forEach((btn) => {
      const format = btn.dataset.format
      if (activeFormats.has(format)) {
        btn.classList.add("wiki-editor-btn--active")
      } else {
        btn.classList.remove("wiki-editor-btn--active")
      }
    })
  }

  updateLinkBubble() {
    if (!this.hasLinkBubbleTarget) return
    if (!this.linkModalTarget.hidden) return

    const anchors = this.getAnchorGroupAtCaret()
    if (anchors.length > 0 && this.editorTarget.contains(anchors[0])) {
      this.currentLinkAnchors = anchors
      this.savedSelection = this.saveSelection()
      this.linkBubbleTarget.hidden = false
      this.positionLinkBubble(anchors[0])
    } else {
      this.linkBubbleTarget.hidden = true
    }
  }

  positionLinkBubble(anchor) {
    const rect = anchor.getBoundingClientRect()
    const bubble = this.linkBubbleTarget
    const bubbleHeight = 36
    bubble.style.position = "fixed"
    bubble.style.top = `${Math.max(4, rect.top - bubbleHeight - 6)}px`
    bubble.style.left = `${rect.left}px`
  }

  openLinkModalFromBubble(e) {
    e.preventDefault()
    this.openLinkModal(e)
  }

  unlinkFromBubble(e) {
    e.preventDefault()
    this.restoreSelection(this.savedSelection)
    this.editorTarget.focus()
    if (this.currentLinkAnchors.length > 0) {
      this.currentLinkAnchors.forEach((anchor) => {
        const text = anchor.textContent
        const span = document.createElement("span")
        span.textContent = text
        anchor.parentNode.replaceChild(span, anchor)
      })
    } else {
      document.execCommand("unlink", false, null)
    }
    this.currentLinkAnchors = []
    this.linkBubbleTarget.hidden = true
  }

  handleFormKeydown(e) {
    if (e.key !== "Enter") return
    if (!this.linkModalTarget.hidden) return
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) {
      e.preventDefault()
    }
  }

  handleModalKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.applyLink(e)
    }
  }

  handleEmbedModalKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault()
      this.closeEmbedModal(e)
    }
  }

  handleEditorClick(e) {
    const target = e.target.closest?.(".wiki-embed-edit-btn, .wiki-embed-remove-btn")
    if (!target) return
    const placeholder = target.closest(".wiki-embed-placeholder")
    if (!placeholder || !this.editorTarget.contains(placeholder)) return
    e.preventDefault()
    e.stopPropagation()
    if (target.classList.contains("wiki-embed-remove-btn")) {
      placeholder.remove()
    } else {
      const encoded = placeholder.dataset.embed
      const code = encoded ? this.decodeBase64(encoded) : ""
      if (this.hasEmbedCodeTarget) this.embedCodeTarget.value = code
      this.editingEmbedPlaceholder = placeholder
      if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = false
    }
    this.updateToolbarState()
  }

  handleInput() {
    this.tryMarkdownBlockShortcut()
  }

  handleEditorKeydown(e) {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      this.savedSelection = this.saveSelection()
      this.openLinkModal(e)
      return
    }
    if (this.linkModalTarget.hidden === false) return
    if (e.key === "Enter" && !e.shiftKey) {
      if (this.breakOutOfBlockquoteOnEnter(e)) return
      if (this.breakOutOfListOnEnter(e)) return
    }
    if (e.key === "Tab") {
      if (this.handleListIndent(e)) return
    }
    if (e.key === "Backspace") {
      if (this.breakOutOfBlockquoteOnBackspace(e)) return
      if (this.breakOutOfListOnBackspace(e)) return
    }
    if (e.key === "*" || e.key === "_") {
      // defer to after the character is inserted
      setTimeout(() => this.tryMarkdownInlineShortcut(), 0)
    }
  }

  tryMarkdownBlockShortcut() {
    const sel = window.getSelection()
    if (!sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return

    let block = this.getBlockAncestor(range.startContainer)
    if (!block) {
      const node = range.startContainer
      if (node.nodeType === Node.TEXT_NODE && node.parentElement === this.editorTarget) {
        const p = document.createElement("p")
        node.parentNode.insertBefore(p, node)
        p.appendChild(node)
        const r = document.createRange()
        r.setStart(node, range.startOffset)
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
        block = p
      }
    }
    if (!block || !this.editorTarget.contains(block)) return

    const raw = block.textContent || ""
    // Match prefix + space at the start (the space was just typed)
    const blockMap = { "### ": "h3", "## ": "h2", "> ": "blockquote" }
    for (const [prefix, tag] of Object.entries(blockMap)) {
      if (raw.startsWith(prefix)) {
        const after = raw.slice(prefix.length)
        const el = document.createElement(tag)
        if (after.trim()) {
          el.textContent = after
        } else {
          el.appendChild(document.createElement("br"))
        }
        block.parentNode.replaceChild(el, block)
        const r = document.createRange()
        r.selectNodeContents(el)
        r.collapse(false)
        sel.removeAllRanges()
        sel.addRange(r)
        this.updateToolbarState()
        return
      }
    }

    if (/^\d+\.\s/.test(raw)) {
      block.innerHTML = "<br>"
      const r = document.createRange()
      r.setStart(block, 0)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      document.execCommand("insertOrderedList", false, null)
      this.updateToolbarState()
      return
    }

    if (/^(\*|-)\s/.test(raw)) {
      block.innerHTML = "<br>"
      const r = document.createRange()
      r.setStart(block, 0)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      document.execCommand("insertUnorderedList", false, null)
      this.updateToolbarState()
      return
    }

    return false
  }

  tryMarkdownInlineShortcut() {
    const sel = window.getSelection()
    if (!sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return

    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) return

    const text = textNode.textContent
    const cursor = range.startOffset

    const before = text.slice(0, cursor)

    // **text** → bold
    const boldMatch = /\*\*(.+?)\*\*$/.exec(before)
    if (boldMatch) {
      this.applyInlineFormat(textNode, boldMatch, cursor, "bold")
      return
    }

    // *text* → italic (not preceded by another *)
    const italicMatch = /(?<!\*)\*([^*]+)\*$/.exec(before)
    if (italicMatch) {
      this.applyInlineFormat(textNode, italicMatch, cursor, "italic")
      return
    }

    // _text_ → italic
    const underscoreMatch = /_([^_]+)_$/.exec(before)
    if (underscoreMatch) {
      this.applyInlineFormat(textNode, underscoreMatch, cursor, "italic")
    }
  }

  applyInlineFormat(textNode, match, cursor, format) {
    const fullMatch = match[0]
    const innerText = match[1]
    const matchStart = cursor - fullMatch.length

    const sel = window.getSelection()
    const selectRange = document.createRange()
    selectRange.setStart(textNode, matchStart)
    selectRange.setEnd(textNode, cursor)
    sel.removeAllRanges()
    sel.addRange(selectRange)

    document.execCommand("insertText", false, innerText)

    // Re-select the inserted text and format it
    const newSel = window.getSelection()
    if (!newSel.rangeCount) return
    const newRange = newSel.getRangeAt(0)
    const fmtRange = document.createRange()
    fmtRange.setStart(newRange.startContainer, newRange.startOffset - innerText.length)
    fmtRange.setEnd(newRange.startContainer, newRange.startOffset)
    sel.removeAllRanges()
    sel.addRange(fmtRange)
    document.execCommand(format, false, null)

    // Move cursor outside the formatted element so typing continues unformatted
    const finalSel = window.getSelection()
    if (finalSel.rangeCount) {
      const r = finalSel.getRangeAt(0)
      r.collapse(false)
      let node = r.endContainer
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      const fmtTags = ["B", "STRONG", "I", "EM"]
      if (node && fmtTags.includes(node.tagName)) {
        const zws = document.createTextNode("\u200B")
        node.parentNode.insertBefore(zws, node.nextSibling)
        const escaped = document.createRange()
        escaped.setStart(zws, 1)
        escaped.collapse(true)
        finalSel.removeAllRanges()
        finalSel.addRange(escaped)
      }
    }
    this.updateToolbarState()
  }

  handlePaste(e) {
    e.preventDefault()
    const data = e.clipboardData
    const html = data.getData("text/html")
    const text = data.getData("text/plain")
    let toInsert
    if (html) {
      toInsert = this.sanitizePasteHtml(html)
    } else {
      const escaped = this.escapeHtml(text)
      toInsert = escaped
        .split(/\r?\n\r?\n/)
        .map((para) => `<p>${para.replace(/\r?\n/g, "<br>")}</p>`)
        .join("") || "<p><br></p>"
    }
    document.execCommand("insertHTML", false, toInsert)
    this.updateToolbarState()
  }

  sanitizePasteHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const allowedInline = new Set(["a", "b", "strong", "i", "em", "span"])
    const allowedBlock = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote"])
    const blockMap = { h1: "h2", h4: "h3", h5: "h3", h6: "h3" }

    const sanitizeNode = (node, parentFragment) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parentFragment.appendChild(node.cloneNode(true))
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return

      const tag = node.tagName.toLowerCase()
      const mapped = blockMap[tag] || tag

      if (tag === "br") {
        parentFragment.appendChild(doc.createElement("br"))
        return
      }

      if (allowedInline.has(mapped)) {
        const el = doc.createElement(mapped)
        if (mapped === "a") {
          const href = node.getAttribute("href")
          if (href) el.setAttribute("href", href)
        }
        Array.from(node.childNodes).forEach((c) => sanitizeNode(c, el))
        parentFragment.appendChild(el)
        return
      }

      if (allowedBlock.has(mapped)) {
        const el = doc.createElement(mapped)
        Array.from(node.childNodes).forEach((c) => sanitizeNode(c, el))
        parentFragment.appendChild(el)
        return
      }

      if (tag === "div") {
        Array.from(node.childNodes).forEach((c) => sanitizeNode(c, parentFragment))
        return
      }

      Array.from(node.childNodes).forEach((c) => sanitizeNode(c, parentFragment))
    }

    const topBlocks = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"]
    const result = doc.createDocumentFragment()
    let textBuffer = ""

    const flushText = () => {
      if (textBuffer.trim()) {
        const p = doc.createElement("p")
        p.textContent = textBuffer
        result.appendChild(p)
        textBuffer = ""
      }
    }

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textBuffer += node.textContent
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return

      const tag = node.tagName.toLowerCase()
      if (topBlocks.includes(tag) || tag === "li") {
        flushText()
        const fragment = doc.createDocumentFragment()
        sanitizeNode(node, fragment)
        if (fragment.childNodes.length) result.appendChild(fragment)
      } else {
        Array.from(node.childNodes).forEach(walk)
      }
    }
    walk(doc.body)
    flushText()

    const wrap = doc.createElement("div")
    while (result.firstChild) wrap.appendChild(result.firstChild)
    const out = wrap.innerHTML.trim()
    return out || "<p><br></p>"
  }

  getBlockquoteAncestor(node) {
    let n = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)
    while (n && n !== this.editorTarget) {
      if (n.tagName === "BLOCKQUOTE") return n
      n = n.parentElement
    }
    return null
  }

  getBlockAncestor(node) {
    const blockTags = ["P", "DIV", "H1", "H2", "H3", "LI", "BLOCKQUOTE"]
    let n = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)
    while (n && n !== this.editorTarget) {
      if (blockTags.includes(n.tagName)) return n
      n = n.parentElement
    }
    return null
  }

  isBlockEmpty(block) {
    if (!block) return false
    const text = block.textContent || ""
    const html = (block.innerHTML || "").toLowerCase()
    return text.trim() === "" || html === "" || html === "<br>" || html === "<br/>"
  }

  breakOutOfBlockquoteOnEnter(e) {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    const blockquote = this.getBlockquoteAncestor(range.commonAncestorContainer)
    if (!blockquote) return false

    const block = this.getBlockAncestor(range.startContainer)
    const atEndOfBlockquote = this.isAtEndOfBlockquote(range, blockquote)
    const inEmptyBlock = block && this.getBlockquoteAncestor(block) === blockquote && this.isBlockEmpty(block)

    if (!atEndOfBlockquote && !inEmptyBlock) return false

    e.preventDefault()

    const p = document.createElement("p")
    p.appendChild(document.createElement("br"))

    const next = blockquote.nextSibling
    if (next) {
      this.editorTarget.insertBefore(p, next)
    } else {
      this.editorTarget.appendChild(p)
    }

    const newRange = document.createRange()
    newRange.setStart(p, 0)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    return true
  }

  isAtEndOfBlockquote(range, blockquote) {
    const container = range.startContainer
    const offset = range.startOffset
    if (range.collapsed !== true) return false
    const lastNode = this.getLastTextOrElementNode(blockquote)
    if (!lastNode) return true
    if (lastNode.nodeType === Node.TEXT_NODE) {
      return container === lastNode && offset >= lastNode.length
    }
    const lastChild = lastNode.lastChild
    if (!lastChild) return container === lastNode
    if (lastChild.nodeType === Node.TEXT_NODE) {
      return container === lastChild && offset >= lastChild.length
    }
    return container === lastNode && offset >= lastNode.childNodes.length
  }

  getLastTextOrElementNode(node) {
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) return n
      let last = null
      for (let i = n.childNodes.length - 1; i >= 0; i--) {
        last = walk(n.childNodes[i])
        if (last) return last
      }
      return n.nodeType === Node.ELEMENT_NODE ? n : null
    }
    return walk(node)
  }

  breakOutOfBlockquoteOnBackspace(e) {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return false
    const blockquote = this.getBlockquoteAncestor(range.commonAncestorContainer)
    if (!blockquote) return false

    if (!this.isAtStartOfBlockquote(range, blockquote)) return false

    e.preventDefault()
    this.unwrapBlockquote(blockquote, sel)
    return true
  }

  isAtStartOfBlockquote(range, blockquote) {
    const container = range.startContainer
    const offset = range.startOffset
    const firstNode = this.getFirstTextOrElementNode(blockquote)
    if (!firstNode) return true
    if (firstNode.nodeType === Node.TEXT_NODE) {
      return container === firstNode && offset === 0
    }
    const firstChild = firstNode.firstChild
    if (!firstChild) return container === firstNode && offset === 0
    if (firstChild.nodeType === Node.TEXT_NODE) {
      return container === firstChild && offset === 0
    }
    return container === firstNode && offset === 0
  }

  getFirstTextOrElementNode(node) {
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) return n
      for (let i = 0; i < n.childNodes.length; i++) {
        const r = walk(n.childNodes[i])
        if (r) return r
      }
      return n.nodeType === Node.ELEMENT_NODE ? n : null
    }
    return walk(node)
  }

  saveSelection() {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!this.editorTarget.contains(range.commonAncestorContainer)) return null
    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset
    }
  }

  restoreSelection(saved) {
    if (!saved) return
    try {
      const range = document.createRange()
      range.setStart(saved.startContainer, saved.startOffset)
      range.setEnd(saved.endContainer, saved.endOffset)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    } catch (_) {}
  }

  saveSelectionOnMouseDown() {
    this.savedSelection = this.saveSelection()
  }

  openLinkModal(e) {
    e.preventDefault()
    if (!this.savedSelection) this.savedSelection = this.saveSelection()
    this.editorTarget.focus()

    const sel = window.getSelection()
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    let text = ""
    let url = ""
    let anchors = []
    let hasTextPrefill = false

    if (range && !range.collapsed) {
      anchors = this.getSelectedAnchorGroup()
      if (anchors.length > 0) {
        text = anchors.map((a) => a.textContent).join("")
        url = anchors[0].getAttribute("href") || ""
        hasTextPrefill = true
      } else {
        text = sel.toString()
        hasTextPrefill = true
      }
    } else {
      anchors = this.getAnchorGroupAtCaret()
      if (anchors.length > 0) {
        text = anchors.map((a) => a.textContent).join("")
        url = anchors[0].getAttribute("href") || ""
        hasTextPrefill = true
      }
    }

    this.linkTextTarget.value = text
    this.linkUrlTarget.value = url
    this.currentLinkAnchors = anchors
    if (this.hasUnlinkBtnTarget) {
      this.unlinkBtnTarget.hidden = anchors.length === 0
    }
    this.linkModalTarget.hidden = false
    if (this.hasLinkBubbleTarget) this.linkBubbleTarget.hidden = true
    if (hasTextPrefill) {
      this.linkUrlTarget.focus()
    } else {
      this.linkTextTarget.focus()
    }
  }

  getAnchorGroupAtCaret() {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return []
    let node = sel.anchorNode
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const anchor = node?.closest?.("a")
    return anchor ? this.getConsecutiveAnchors(anchor) : []
  }

  getSelectedAnchorGroup() {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return []
    const range = sel.getRangeAt(0)
    let node = range.commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const anchor = node?.closest?.("a")
    return anchor ? this.getConsecutiveAnchors(anchor) : []
  }

  getConsecutiveAnchors(anchor) {
    const result = [anchor]
    let prev = anchor.previousSibling
    while (prev && prev.nodeType === 1 && prev.tagName === "A") {
      result.unshift(prev)
      prev = prev.previousSibling
    }
    let next = anchor.nextSibling
    while (next && next.nodeType === 1 && next.tagName === "A") {
      result.push(next)
      next = next.nextSibling
    }
    return result
  }

  closeLinkModal() {
    this.linkModalTarget.hidden = true
    this.currentLinkAnchors = []
    this.editorTarget.focus()
  }

  openEmbedModal(e) {
    e?.preventDefault()
    if (!this.savedSelection) this.savedSelection = this.saveSelection()
    this.editingEmbedPlaceholder = null
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.value = ""
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = false
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.focus()
  }

  closeEmbedModal(e) {
    e?.preventDefault()
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = true
    this.editingEmbedPlaceholder = null
    this.editorTarget.focus()
  }

  applyEmbed(e) {
    e?.preventDefault()
    const code = this.hasEmbedCodeTarget ? this.embedCodeTarget.value.trim() : ""
    const iframeHtml = this.extractAndSanitizeIframe(code)
    if (!iframeHtml) {
      this.closeEmbedModal(e)
      return
    }
    this.restoreSelection(this.savedSelection)
    this.editorTarget.focus()
    if (this.editingEmbedPlaceholder) {
      const encoded = this.encodeBase64(iframeHtml)
      const src = this.getIframeSrc(iframeHtml)
      const label = src ? src.replace(/^https?:\/\//, "").slice(0, 40) : "iframe"
      this.editingEmbedPlaceholder.dataset.embed = encoded
      this.editingEmbedPlaceholder.dataset.embedSrc = src || ""
      const inner = this.editingEmbedPlaceholder.querySelector(".wiki-embed-placeholder-inner")
      if (inner) {
        const preview = inner.querySelector(".wiki-embed-preview")
        if (preview) preview.textContent = label
      }
      this.editingEmbedPlaceholder = null
    } else {
      this.insertEmbedPlaceholder(iframeHtml)
    }
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = true
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.value = ""
    this.editorTarget.focus()
  }

  insertEmbedPlaceholder(iframeHtml) {
    const encoded = this.encodeBase64(iframeHtml)
    const src = this.getIframeSrc(iframeHtml)
    const label = src ? src.replace(/^https?:\/\//, "").slice(0, 40) : "iframe"
    const html = `<span class="wiki-embed-placeholder" contenteditable="false" data-embed="${this.escapeHtml(encoded)}" data-embed-src="${this.escapeHtml(src || "")}"><span class="wiki-embed-placeholder-inner"><span class="wiki-embed-icon">◇</span><code class="wiki-embed-preview">${this.escapeHtml(label)}</code><button type="button" class="wiki-embed-edit-btn">Edit</button><button type="button" class="wiki-embed-remove-btn">Remove</button></span></span>`
    document.execCommand("insertHTML", false, html)
  }

  extractAndSanitizeIframe(code) {
    const doc = new DOMParser().parseFromString(code, "text/html")
    const iframe = doc.querySelector("iframe")
    if (!iframe) return null
    const src = iframe.getAttribute("src")
    if (!src || !/^https:\/\//i.test(src)) return null
    const allowed = ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "title"]
    const iframe2 = doc.createElement("iframe")
    allowed.forEach((attr) => {
      const v = iframe.getAttribute(attr)
      if (v) iframe2.setAttribute(attr, v)
    })
    if (!iframe2.getAttribute("src") || !/^https:\/\//i.test(iframe2.getAttribute("src"))) return null
    return iframe2.outerHTML
  }

  getIframeSrc(html) {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const iframe = doc.querySelector("iframe")
    return iframe?.getAttribute("src") || ""
  }

  encodeBase64(s) {
    return btoa(unescape(encodeURIComponent(s)))
  }

  decodeBase64(s) {
    try {
      return decodeURIComponent(escape(atob(s)))
    } catch {
      return ""
    }
  }

  applyLink(e) {
    e.preventDefault()
    const text = this.linkTextTarget.value.trim()
    const url = this.linkUrlTarget.value.trim()
    this.restoreSelection(this.savedSelection)
    this.editorTarget.focus()

    if (this.currentLinkAnchors.length > 0) {
      const content = text || this.currentLinkAnchors.map((a) => a.textContent).join("")
      const first = this.currentLinkAnchors[0]
      first.textContent = content
      if (url) {
        first.setAttribute("href", url)
      } else {
        first.removeAttribute("href")
      }
      this.currentLinkAnchors.slice(1).forEach((a) => a.remove())
    } else {
      const content = text || url || "link"
      const href = url || "#"
      const html = `<a href="${this.escapeHtml(href)}">${this.escapeHtml(content)}</a>`
      document.execCommand("insertHTML", false, html)
    }
    this.closeLinkModal()
  }

  escapeHtml(s) {
    const div = document.createElement("div")
    div.textContent = s
    return div.innerHTML
  }

  unlink(e) {
    e.preventDefault()
    this.restoreSelection(this.savedSelection)
    this.editorTarget.focus()
    if (this.currentLinkAnchors.length > 0) {
      this.currentLinkAnchors.forEach((anchor) => {
        const text = anchor.textContent
        const span = document.createElement("span")
        span.textContent = text
        anchor.parentNode.replaceChild(span, anchor)
      })
    } else {
      document.execCommand("unlink", false, null)
    }
    this.currentLinkAnchors = []
    this.closeLinkModal()
  }

  handleSubmit(e) {
    const markdown = this.htmlToMarkdown(this.editorTarget.innerHTML)
    this.inputTarget.value = markdown
    if (this.hasDraftKeyValue) {
      this.clearDraft()
      this.updateDraftLink()
    }
  }

  draftStorageKey() {
    return `wiki-draft-${this.draftKeyValue}`
  }

  scheduleSaveDraft() {
    if (this.draftSaveTimeout) clearTimeout(this.draftSaveTimeout)
    this.draftSaveTimeout = setTimeout(() => this.saveDraft(), 500)
  }

  saveDraft() {
    if (!this.hasDraftKeyValue || !this.form) return
    const draft = { html: this.editorTarget.innerHTML, fields: {}, savedAt: Date.now() }
    this.form.querySelectorAll("input, select, textarea").forEach((el) => {
      const name = el.getAttribute("name")
      if (name && el !== this.inputTarget && el.type !== "hidden") {
        draft.fields[name] = el.value
      }
    })
    try {
      localStorage.setItem(this.draftStorageKey(), JSON.stringify(draft))
      // Don't update the draft link after page load — it should only reflect what existed on load
    } catch (_) {}
  }

  updateDraftLink() {
    if (!this.hasDraftLinkWrapTarget || !this.hasDraftKeyValue) return
    try {
      const raw = localStorage.getItem(this.draftStorageKey())
      if (!raw) {
        this.draftLinkWrapTarget.hidden = true
        return
      }
      const draft = JSON.parse(raw)
      if (!draft.html) {
        this.draftLinkWrapTarget.hidden = true
        return
      }
      const savedAt = draft.savedAt
      const label = (typeof savedAt === "number" && savedAt > 0) ? this.formatTimeAgo(savedAt) : "previously"
      this.draftLinkTarget.textContent = `Restore draft from ${label}`
      this.draftLinkWrapTarget.hidden = false
    } catch (_) {
      this.draftLinkWrapTarget.hidden = true
    }
  }

  formatTimeAgo(ms) {
    const sec = Math.floor((Date.now() - ms) / 1000)
    if (sec < 60) return "just now"
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} min ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} hr ago`
    const day = Math.floor(hr / 24)
    return `${day} day${day === 1 ? "" : "s"} ago`
  }

  restoreDraftFromLink(e) {
    e.preventDefault()
    this.restoreDraft()
    this.clearDraft()
    this.updateDraftLink()
    this.editorTarget.focus()
  }

  restoreDraft() {
    if (!this.form) return
    try {
      const raw = localStorage.getItem(this.draftStorageKey())
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.html) this.editorTarget.innerHTML = draft.html
      if (draft.fields) {
        Object.entries(draft.fields).forEach(([name, value]) => {
          const el = Array.from(this.form.querySelectorAll("[name]")).find((n) => n.getAttribute("name") === name)
          if (el && el !== this.inputTarget) el.value = value
        })
      }
    } catch (_) {}
  }

  clearDraft() {
    try {
      localStorage.removeItem(this.draftStorageKey())
    } catch (_) {}
  }

  htmlToMarkdown(html) {
    if (typeof TurndownService === "undefined") {
      const el = document.createElement("div")
      el.innerHTML = html
      return el.textContent || ""
    }
    const service = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced"
    })
    service.addRule("wikiEmbedPlaceholder", {
      filter: (node) =>
        node.classList?.contains("wiki-embed-placeholder") &&
        node.hasAttribute?.("data-embed"),
      replacement: (_content, node) => {
        const encoded = node.getAttribute("data-embed")
        if (!encoded) return ""
        try {
          const iframeHtml = decodeURIComponent(escape(atob(encoded)))
          return `\n<div class="wiki-embed-wrapper">${iframeHtml}</div>\n`
        } catch {
          return ""
        }
      }
    })
    try {
      return service.turndown(html) || ""
    } catch {
      const el = document.createElement("div")
      el.innerHTML = html
      return el.textContent || ""
    }
  }

  bold(e) {
    e.preventDefault()
    this.editorTarget.focus()
    document.execCommand("bold", false, null)
    this.updateToolbarState()
  }

  italic(e) {
    e.preventDefault()
    this.editorTarget.focus()
    document.execCommand("italic", false, null)
    this.updateToolbarState()
  }

  formatBlock(e) {
    e.preventDefault()
    this.editorTarget.focus()
    const format = e.currentTarget.dataset.formatParam || "p"
    const sel = window.getSelection()
    if (sel.rangeCount) {
      const block = this.getBlockAncestor(sel.anchorNode)
      if (block && block.tagName.toUpperCase() === format.toUpperCase()) {
        document.execCommand("formatBlock", false, "p")
      } else {
        document.execCommand("formatBlock", false, format)
      }
    }
    this.updateToolbarState()
  }

  quote(e) {
    e.preventDefault()
    this.editorTarget.focus()
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const blockquote = this.getBlockquoteAncestor(range.commonAncestorContainer)
    if (blockquote) {
      this.unwrapBlockquote(blockquote, sel)
    } else {
      document.execCommand("formatBlock", false, "blockquote")
    }
    this.updateToolbarState()
  }

  unwrapBlockquote(blockquote, sel) {
    const parent = blockquote.parentNode
    let firstUnwrapped = null
    while (blockquote.firstChild) {
      const node = parent.insertBefore(blockquote.firstChild, blockquote)
      if (!firstUnwrapped) firstUnwrapped = node
    }
    parent.removeChild(blockquote)
    if (firstUnwrapped) {
      const newRange = document.createRange()
      newRange.setStart(firstUnwrapped, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }
    this.updateToolbarState()
  }

  handleListIndent(e) {
    const sel = window.getSelection()
    if (!sel.rangeCount) return false
    const range = sel.getRangeAt(0)
    const li = this.getListItemAncestor(range.commonAncestorContainer)
    if (!li) return false
    const list = this.getListAncestor(li)
    if (!list) return false

    e.preventDefault()
    if (e.shiftKey) {
      document.execCommand("outdent", false, null)
    } else {
      document.execCommand("indent", false, null)
    }
    this.updateToolbarState()
    return true
  }

  getListAncestor(node) {
    let n = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)
    while (n && n !== this.editorTarget) {
      if (n.tagName === "UL" || n.tagName === "OL") return n
      n = n.parentElement
    }
    return null
  }

  getListItemAncestor(node) {
    let n = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)
    while (n && n !== this.editorTarget) {
      if (n.tagName === "LI") return n
      if (n.tagName === "UL" || n.tagName === "OL") return null
      n = n.parentElement
    }
    return null
  }

  isAtStartOfListItem(range, li) {
    const container = range.startContainer
    const offset = range.startOffset
    if (range.collapsed !== true) return false
    const firstNode = this.getFirstTextOrElementNode(li)
    if (!firstNode) return true
    if (firstNode.nodeType === Node.TEXT_NODE) {
      return container === firstNode && offset === 0
    }
    const firstChild = firstNode.firstChild
    if (!firstChild) return container === firstNode && offset === 0
    if (firstChild.nodeType === Node.TEXT_NODE) {
      return container === firstChild && offset === 0
    }
    return container === firstNode && offset === 0
  }

  breakOutOfListOnBackspace(e) {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return false
    const li = this.getListItemAncestor(range.commonAncestorContainer)
    if (!li) return false
    const list = this.getListAncestor(li)
    if (!list) return false
    if (list.firstElementChild !== li) return false
    if (!this.isAtStartOfListItem(range, li)) return false

    e.preventDefault()
    this.unwrapList(list, sel)
    return true
  }

  breakOutOfListOnEnter(e) {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    const li = this.getListItemAncestor(range.commonAncestorContainer)
    if (!li) return false
    const list = this.getListAncestor(li)
    if (!list) return false
    if (!this.isBlockEmpty(li)) return false

    e.preventDefault()
    const p = document.createElement("p")
    p.appendChild(document.createElement("br"))
    if (li.nextElementSibling) {
      // Items remain after this one — split the list
      const newList = document.createElement(list.tagName)
      let sibling = li.nextElementSibling
      while (sibling) {
        const next = sibling.nextElementSibling
        newList.appendChild(sibling)
        sibling = next
      }
      list.parentNode.insertBefore(p, list.nextSibling)
      p.parentNode.insertBefore(newList, p.nextSibling)
    } else {
      list.parentNode.insertBefore(p, list.nextSibling)
    }
    li.remove()
    if (list.children.length === 0) list.remove()
    const newRange = document.createRange()
    newRange.setStart(p, 0)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    this.updateToolbarState()
    return true
  }

  unwrapList(list, sel) {
    const parent = list.parentNode
    const items = Array.from(list.querySelectorAll(":scope > li"))
    if (items.length === 0) return
    let firstUnwrapped = null
    items.forEach((li) => {
      const p = document.createElement("p")
      while (li.firstChild) p.appendChild(li.firstChild)
      if (!p.innerHTML.trim()) p.appendChild(document.createElement("br"))
      const node = parent.insertBefore(p, list)
      if (!firstUnwrapped) firstUnwrapped = node
    })
    parent.removeChild(list)
    if (firstUnwrapped) {
      const newRange = document.createRange()
      newRange.setStart(firstUnwrapped, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }
    this.updateToolbarState()
  }

  insertUnorderedList(e) {
    e.preventDefault()
    this.editorTarget.focus()
    document.execCommand("insertUnorderedList", false, null)
    this.updateToolbarState()
  }

  insertOrderedList(e) {
    e.preventDefault()
    this.editorTarget.focus()
    document.execCommand("insertOrderedList", false, null)
    this.updateToolbarState()
  }
}
