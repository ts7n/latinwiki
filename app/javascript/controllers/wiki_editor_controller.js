import { Controller } from "@hotwired/stimulus"
import { Editor, Node, Extension } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TurndownService from "turndown"

const EmbedPlaceholder = Node.create({
  name: "embedPlaceholder",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      embed: { default: null },
      embedSrc: { default: "" },
    }
  },

  parseHTML() {
    return [{
      tag: "span.wiki-embed-placeholder",
      getAttrs: (node) => ({
        embed: node.getAttribute("data-embed"),
        embedSrc: node.getAttribute("data-embed-src"),
      }),
    }, {
      tag: "div.wiki-embed-placeholder",
      getAttrs: (node) => ({
        embed: node.getAttribute("data-embed"),
        embedSrc: node.getAttribute("data-embed-src"),
      }),
    }]
  },

  renderHTML({ node }) {
    return ["div", {
      class: "wiki-embed-placeholder",
      "data-embed": node.attrs.embed,
      "data-embed-src": node.attrs.embedSrc || "",
    }]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div")
      dom.className = "wiki-embed-placeholder"
      dom.contentEditable = "false"

      const src = node.attrs.embedSrc || ""
      const label = src ? src.replace(/^https?:\/\//, "").slice(0, 40) : "iframe"

      const inner = document.createElement("span")
      inner.className = "wiki-embed-placeholder-inner"

      const icon = document.createElement("span")
      icon.className = "wiki-embed-icon"
      icon.textContent = "◇"

      const preview = document.createElement("code")
      preview.className = "wiki-embed-preview"
      preview.textContent = label

      const editBtn = document.createElement("button")
      editBtn.type = "button"
      editBtn.className = "wiki-embed-edit-btn"
      editBtn.textContent = "Edit"

      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.className = "wiki-embed-remove-btn"
      removeBtn.textContent = "Remove"

      inner.append(icon, preview, editBtn, removeBtn)
      dom.appendChild(inner)

      editBtn.addEventListener("click", (e) => {
        e.preventDefault()
        dom.dispatchEvent(new CustomEvent("wiki:embed-edit", {
          detail: { embed: node.attrs.embed, getPos },
          bubbles: true,
        }))
      })

      removeBtn.addEventListener("click", (e) => {
        e.preventDefault()
        const pos = getPos()
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
      })

      return { dom }
    }
  },
})

export default class extends Controller {
  static targets = [
    "editor", "input",
    "linkModal", "linkText", "linkUrl", "unlinkBtn", "linkBubble",
    "embedModal", "embedCode",
    "draftLinkWrap", "draftLink",
  ]
  static values = { draftKey: String }

  connect() {
    this.form = this.element.closest("form")

    const rawHtml = this.editorTarget.innerHTML.trim()
    this.editorTarget.innerHTML = ""
    const content = this.stripRenderArtifacts(rawHtml) || "<p></p>"

    const controller = this
    this.editor = new Editor({
      element: this.editorTarget,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {},
        }),
        EmbedPlaceholder,
        Extension.create({
          name: "wikiShortcuts",
          addKeyboardShortcuts() {
            return {
              "Mod-k": () => { controller.openLinkModal(); return true },
            }
          },
        }),
      ],
      content,
      editorProps: {
        attributes: { class: "wiki-editor-canvas" },
        transformPastedHTML: (html) => {
          return html
            .replace(/<h1([\s>])/gi, "<h2$1")
            .replace(/<\/h1>/gi, "</h2>")
            .replace(/<h[4-6]([\s>])/gi, "<h3$1")
            .replace(/<\/h[4-6]>/gi, "</h3>")
        },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData("text/plain")
          const html = event.clipboardData?.getData("text/html")
          if (!html && text && /^https?:\/\/\S+$/i.test(text.trim())) {
            const url = text.trim()
            if (!view.state.selection.empty) {
              this.editor.chain().setLink({ href: url }).run()
            } else {
              this.editor.chain()
                .insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] })
                .run()
            }
            return true
          }
          return false
        },
      },
      onCreate: ({ editor }) => {
        editor.view.dom.classList.toggle("is-empty", editor.isEmpty)
      },
      onUpdate: ({ editor }) => {
        editor.view.dom.classList.toggle("is-empty", editor.isEmpty)
        this.scheduleSaveDraft()
      },
      onSelectionUpdate: () => {
        this.updateToolbarState()
        this.updateLinkBubble()
      },
      onTransaction: () => {
        this.updateToolbarState()
      },
    })

    if (this.form) {
      this.boundSubmit = this.handleSubmit.bind(this)
      this.form.addEventListener("submit", this.boundSubmit)
      this.boundFormKeydown = this.handleFormKeydown.bind(this)
      this.form.addEventListener("keydown", this.boundFormKeydown)
    }

    this.boundModalKeydown = this.handleModalKeydown.bind(this)
    this.linkModalTarget.addEventListener("keydown", this.boundModalKeydown)

    if (this.hasEmbedModalTarget) {
      this.boundEmbedModalKeydown = this.handleEmbedModalKeydown.bind(this)
      this.embedModalTarget.addEventListener("keydown", this.boundEmbedModalKeydown)
    }

    this.boundEmbedEdit = this.handleEmbedEdit.bind(this)
    this.editorTarget.addEventListener("wiki:embed-edit", this.boundEmbedEdit)

    if (this.hasDraftKeyValue) {
      this.boundFormDraft = this.scheduleSaveDraft.bind(this)
      this.form?.addEventListener("input", this.boundFormDraft)
      this.updateDraftLink()
      this.draftLinkFrozen = true
    }
  }

  disconnect() {
    this.editor?.destroy()
    if (this.form) {
      this.form.removeEventListener("submit", this.boundSubmit)
      this.form.removeEventListener("keydown", this.boundFormKeydown)
    }
    this.linkModalTarget?.removeEventListener("keydown", this.boundModalKeydown)
    if (this.hasEmbedModalTarget) {
      this.embedModalTarget?.removeEventListener("keydown", this.boundEmbedModalKeydown)
    }
    this.editorTarget?.removeEventListener("wiki:embed-edit", this.boundEmbedEdit)
    if (this.boundFormDraft) this.form?.removeEventListener("input", this.boundFormDraft)
    if (this.draftSaveTimeout) clearTimeout(this.draftSaveTimeout)
  }

  // --- Toolbar ---

  updateToolbarState() {
    if (!this.editor) return
    this.element.querySelectorAll("[data-format]").forEach((btn) => {
      const f = btn.dataset.format
      let active = false
      switch (f) {
        case "bold": active = this.editor.isActive("bold") && !this.editor.isActive("heading"); break
        case "italic": active = this.editor.isActive("italic"); break
        case "h2": active = this.editor.isActive("heading", { level: 2 }); break
        case "h3": active = this.editor.isActive("heading", { level: 3 }); break
        case "blockquote": active = this.editor.isActive("blockquote"); break
        case "bulletList": active = this.editor.isActive("bulletList"); break
        case "orderedList": active = this.editor.isActive("orderedList"); break
      }
      btn.classList.toggle("wiki-editor-btn--active", active)
    })
  }

  bold(e) { e.preventDefault(); this.editor.chain().focus().toggleBold().run() }
  italic(e) { e.preventDefault(); this.editor.chain().focus().toggleItalic().run() }

  formatBlock(e) {
    e.preventDefault()
    const level = parseInt(e.currentTarget.dataset.formatParam?.replace("h", ""), 10)
    if (level) this.editor.chain().focus().toggleHeading({ level }).run()
  }

  quote(e) { e.preventDefault(); this.editor.chain().focus().toggleBlockquote().run() }
  insertUnorderedList(e) { e.preventDefault(); this.editor.chain().focus().toggleBulletList().run() }
  insertOrderedList(e) { e.preventDefault(); this.editor.chain().focus().toggleOrderedList().run() }

  // --- Link bubble ---

  updateLinkBubble() {
    if (!this.hasLinkBubbleTarget || !this.editor) return
    if (!this.linkModalTarget.hidden) return

    if (this.editor.isActive("link")) {
      const { from } = this.editor.state.selection
      const coords = this.editor.view.coordsAtPos(from)
      this.linkBubbleTarget.hidden = false
      this.linkBubbleTarget.style.position = "fixed"
      this.linkBubbleTarget.style.top = `${Math.max(4, coords.top - 42)}px`
      this.linkBubbleTarget.style.left = `${coords.left}px`
    } else {
      this.linkBubbleTarget.hidden = true
    }
  }

  openLinkModalFromBubble(e) { e.preventDefault(); this.openLinkModal() }

  unlinkFromBubble(e) {
    e.preventDefault()
    this.editor.chain().focus().extendMarkRange("link").unsetLink().run()
    this.linkBubbleTarget.hidden = true
  }

  // --- Link modal ---

  openLinkModal(e) {
    e?.preventDefault()
    let text = ""
    let url = ""
    let isEditing = false

    if (this.editor.isActive("link")) {
      this.editor.chain().extendMarkRange("link").run()
      const { from, to } = this.editor.state.selection
      text = this.editor.state.doc.textBetween(from, to)
      url = this.editor.getAttributes("link").href || ""
      isEditing = true
    } else if (!this.editor.state.selection.empty) {
      const { from, to } = this.editor.state.selection
      text = this.editor.state.doc.textBetween(from, to)
    }

    this.linkTextTarget.value = text
    this.linkUrlTarget.value = url
    if (this.hasUnlinkBtnTarget) this.unlinkBtnTarget.hidden = !isEditing
    this.linkModalTarget.hidden = false
    if (this.hasLinkBubbleTarget) this.linkBubbleTarget.hidden = true
    if (text) { this.linkUrlTarget.focus() } else { this.linkTextTarget.focus() }
  }

  closeLinkModal() {
    this.linkModalTarget.hidden = true
    this.editor.chain().focus().run()
  }

  applyLink(e) {
    e.preventDefault()
    const text = this.linkTextTarget.value.trim()
    const url = this.linkUrlTarget.value.trim()
    if (!url) { this.closeLinkModal(); return }

    if (this.editor.isActive("link")) {
      this.editor.chain().focus().extendMarkRange("link").run()
    }

    const { from, to, empty } = this.editor.state.selection

    if (!empty) {
      const label = text || this.editor.state.doc.textBetween(from, to) || url
      this.editor.chain().focus()
        .deleteRange({ from, to })
        .insertContentAt(from, { type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] })
        .run()
    } else {
      const label = text || url
      this.editor.chain().focus()
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] })
        .run()
    }

    this.closeLinkModal()
  }

  unlink(e) {
    e.preventDefault()
    this.editor.chain().focus().extendMarkRange("link").unsetLink().run()
    this.closeLinkModal()
  }

  // --- Embed ---

  openEmbedModal(e) {
    e?.preventDefault()
    this.editingEmbedGetPos = null
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.value = ""
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = false
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.focus()
  }

  closeEmbedModal(e) {
    e?.preventDefault()
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = true
    this.editingEmbedGetPos = null
    this.editor.chain().focus().run()
  }

  handleEmbedEdit(e) {
    const { embed, getPos } = e.detail
    this.editingEmbedGetPos = getPos
    if (this.hasEmbedCodeTarget) this.embedCodeTarget.value = this.decodeBase64(embed)
    if (this.hasEmbedModalTarget) this.embedModalTarget.hidden = false
  }

  applyEmbed(e) {
    e?.preventDefault()
    const code = this.hasEmbedCodeTarget ? this.embedCodeTarget.value.trim() : ""
    const iframeHtml = this.extractAndSanitizeIframe(code)
    if (!iframeHtml) { this.closeEmbedModal(); return }

    const encoded = this.encodeBase64(iframeHtml)
    const src = this.getIframeSrc(iframeHtml)

    if (this.editingEmbedGetPos) {
      const pos = this.editingEmbedGetPos()
      this.editor.chain().focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .insertContentAt(pos, { type: "embedPlaceholder", attrs: { embed: encoded, embedSrc: src } })
        .run()
    } else {
      this.editor.chain().focus()
        .insertContent({ type: "embedPlaceholder", attrs: { embed: encoded, embedSrc: src } })
        .run()
    }

    this.closeEmbedModal()
  }

  extractAndSanitizeIframe(code) {
    const doc = new DOMParser().parseFromString(code, "text/html")
    const iframe = doc.querySelector("iframe")
    if (!iframe) return null
    const src = iframe.getAttribute("src")
    if (!src || !/^https:\/\//i.test(src)) return null
    const allowed = ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "title"]
    const clean = doc.createElement("iframe")
    allowed.forEach((attr) => { const v = iframe.getAttribute(attr); if (v) clean.setAttribute(attr, v) })
    if (!clean.getAttribute("src") || !/^https:\/\//i.test(clean.getAttribute("src"))) return null
    return clean.outerHTML
  }

  getIframeSrc(html) {
    const doc = new DOMParser().parseFromString(html, "text/html")
    return doc.querySelector("iframe")?.getAttribute("src") || ""
  }

  encodeBase64(s) { return btoa(unescape(encodeURIComponent(s))) }
  decodeBase64(s) { try { return decodeURIComponent(escape(atob(s))) } catch { return "" } }

  // --- Keyboard ---

  handleFormKeydown(e) {
    if (e.key !== "Enter") return
    if (!this.linkModalTarget.hidden) return
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) e.preventDefault()
  }

  handleModalKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.applyLink(e) }
    if (e.key === "Escape") this.closeLinkModal()
  }

  handleEmbedModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); this.closeEmbedModal() }
  }

  // --- Submit ---

  handleSubmit() {
    this.inputTarget.value = this.htmlToMarkdown(this.editor.getHTML())
    if (this.hasDraftKeyValue) {
      this.clearDraft()
      this.updateDraftLink()
    }
  }

  stripRenderArtifacts(html) {
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    tmp.querySelectorAll(".wiki-heading-anchor").forEach((el) => el.remove())
    tmp.querySelectorAll(".wiki-heading-with-anchor").forEach((el) => {
      el.removeAttribute("id")
      el.classList.remove("wiki-heading-with-anchor")
      if (!el.className) el.removeAttribute("class")
    })
    return tmp.innerHTML
  }

  htmlToMarkdown(html) {
    const service = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" })
    service.addRule("embedPlaceholder", {
      filter: (node) => node.classList?.contains("wiki-embed-placeholder") && node.hasAttribute?.("data-embed"),
      replacement: (_content, node) => {
        const encoded = node.getAttribute("data-embed")
        if (!encoded) return ""
        try {
          const iframeHtml = decodeURIComponent(escape(atob(encoded)))
          return `\n<div class="wiki-embed-wrapper">${iframeHtml}</div>\n`
        } catch { return "" }
      },
    })
    try {
      return service.turndown(html) || ""
    } catch {
      const el = document.createElement("div")
      el.innerHTML = html
      return el.textContent || ""
    }
  }

  // --- Drafts ---

  scheduleSaveDraft() {
    if (!this.hasDraftKeyValue) return
    if (this.draftSaveTimeout) clearTimeout(this.draftSaveTimeout)
    this.draftSaveTimeout = setTimeout(() => this.saveDraft(), 500)
  }

  saveDraft() {
    if (!this.hasDraftKeyValue || !this.form || !this.editor) return
    const draft = { html: this.editor.getHTML(), fields: {}, savedAt: Date.now() }
    this.form.querySelectorAll("input, select, textarea").forEach((el) => {
      const name = el.getAttribute("name")
      if (name && el !== this.inputTarget && el.type !== "hidden") draft.fields[name] = el.value
    })
    try { localStorage.setItem(this.draftStorageKey(), JSON.stringify(draft)) } catch (_) {}
  }

  draftStorageKey() { return `wiki-draft-${this.draftKeyValue}` }

  updateDraftLink() {
    if (!this.hasDraftLinkWrapTarget || !this.hasDraftKeyValue) return
    try {
      const raw = localStorage.getItem(this.draftStorageKey())
      if (!raw) { this.draftLinkWrapTarget.hidden = true; return }
      const draft = JSON.parse(raw)
      if (!draft.html) { this.draftLinkWrapTarget.hidden = true; return }
      const label = (typeof draft.savedAt === "number" && draft.savedAt > 0) ? this.formatTimeAgo(draft.savedAt) : "previously"
      this.draftLinkTarget.textContent = `Restore draft from ${label}`
      this.draftLinkWrapTarget.hidden = false
    } catch (_) { this.draftLinkWrapTarget.hidden = true }
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
    this.editor.commands.focus()
  }

  restoreDraft() {
    if (!this.form || !this.editor) return
    try {
      const raw = localStorage.getItem(this.draftStorageKey())
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.html) this.editor.commands.setContent(draft.html)
      if (draft.fields) {
        Object.entries(draft.fields).forEach(([name, value]) => {
          const el = Array.from(this.form.querySelectorAll("[name]")).find((n) => n.getAttribute("name") === name)
          if (el && el !== this.inputTarget) el.value = value
        })
      }
    } catch (_) {}
  }

  clearDraft() {
    try { localStorage.removeItem(this.draftStorageKey()) } catch (_) {}
  }
}
