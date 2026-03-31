import { Controller } from "@hotwired/stimulus"
import { Editor, Node, Extension } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"
import katex from "katex"

// Lazy-loaded mermaid module
let mermaidReady = null
function loadMermaid() {
  if (mermaidReady) return mermaidReady
  mermaidReady = import("mermaid").then((mod) => {
    const m = mod.default
    m.initialize({ startOnLoad: false, theme: "default" })
    return m
  })
  return mermaidReady
}

let mermaidRenderCounter = 0
async function renderMermaidSvg(code, container) {
  try {
    const m = await loadMermaid()
    const id = `wiki-mmd-${++mermaidRenderCounter}`
    const { svg } = await m.render(id, code)
    container.innerHTML = svg
  } catch {
    container.innerHTML = `<pre class="wiki-mermaid-error"><code>${code.replace(/</g, "&lt;")}</code></pre>`
  }
}

// --- Embed Placeholder Node ---

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

      const preventFocus = (e) => e.preventDefault()
      editBtn.addEventListener("mousedown", preventFocus)
      removeBtn.addEventListener("mousedown", preventFocus)

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

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: (event) => !!(event.target.closest && event.target.closest("button")),
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
        destroy: () => {
          editBtn.removeEventListener("mousedown", preventFocus)
          removeBtn.removeEventListener("mousedown", preventFocus)
        },
      }
    }
  },
})

// --- Collapsible Details Node ---

const CollapsibleDetails = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary block+",
  defining: true,

  parseHTML() {
    return [{ tag: "details" }]
  },

  renderHTML() {
    return ["details", { class: "wiki-collapsible", open: true }, 0]
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      const wrapper = document.createElement("div")
      wrapper.className = "wiki-collapsible-wrapper"

      const container = document.createElement("div")
      container.className = "wiki-collapsible"

      const preventFocus = (e) => e.preventDefault()
      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.className = "wiki-collapsible-remove-btn"
      removeBtn.textContent = "×"
      removeBtn.title = "Remove collapsible section"
      removeBtn.contentEditable = "false"
      removeBtn.addEventListener("mousedown", preventFocus)
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const pos = getPos()
        if (pos == null) return
        const currentNode = editor.state.doc.nodeAt(pos)
        if (!currentNode) return
        editor.chain().focus().deleteRange({ from: pos, to: pos + currentNode.nodeSize }).run()
      })

      wrapper.appendChild(container)
      wrapper.appendChild(removeBtn)

      requestAnimationFrame(() => {
        const summary = container.querySelector(".wiki-collapsible-summary")
        if (summary) {
          const h = summary.offsetHeight
          removeBtn.style.height = h + "px"
          removeBtn.style.width = h + "px"
          removeBtn.style.maxHeight = "none"
        }
      })

      return {
        dom: wrapper,
        contentDOM: container,
        ignoreMutation: (mutation) => {
          if (!container.contains(mutation.target)) return true
          return false
        },
        stopEvent: (event) => !!(event.target.closest && event.target.closest(".wiki-collapsible-remove-btn")),
        destroy: () => {
          removeBtn.removeEventListener("mousedown", preventFocus)
        },
      }
    }
  },
})

const DetailsSummary = Node.create({
  name: "detailsSummary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }]
  },

  renderHTML() {
    return ["summary", { class: "wiki-collapsible-summary" }, 0]
  },

  addNodeView() {
    return () => {
      const dom = document.createElement("div")
      dom.className = "wiki-collapsible-summary"
      return { dom, contentDOM: dom }
    }
  },
})

// --- Math (LaTeX) Nodes ---

function renderKatex(latex, displayMode) {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, output: "html" })
  } catch {
    return `<code class="wiki-math-error">${latex}</code>`
  }
}

const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    }
  },

  parseHTML() {
    return [{
      tag: "span.wiki-math-inline",
      getAttrs: (node) => ({ latex: node.getAttribute("data-latex") || node.textContent }),
    }]
  },

  renderHTML({ node }) {
    return ["span", {
      class: "wiki-math-inline",
      "data-latex": node.attrs.latex,
    }, node.attrs.latex]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span")
      dom.className = "wiki-math-inline wiki-math-rendered"
      dom.contentEditable = "false"
      dom.innerHTML = renderKatex(node.attrs.latex, false)

      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      }
    }
  },
})

const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    }
  },

  parseHTML() {
    return [{
      tag: "div.wiki-math-block",
      getAttrs: (node) => ({ latex: node.getAttribute("data-latex") || node.textContent }),
    }]
  },

  renderHTML({ node }) {
    return ["div", {
      class: "wiki-math-block",
      "data-latex": node.attrs.latex,
    }, node.attrs.latex]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div")
      dom.className = "wiki-math-block wiki-math-rendered"
      dom.contentEditable = "false"
      dom.innerHTML = renderKatex(node.attrs.latex, true)

      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      }
    }
  },
})

// --- Mermaid Block Node ---

const MermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      code: { default: "" },
    }
  },

  parseHTML() {
    return [{
      tag: "div.wiki-mermaid-block",
      getAttrs: (node) => ({ code: node.getAttribute("data-code") || node.textContent }),
    }]
  },

  renderHTML({ node }) {
    return ["div", {
      class: "wiki-mermaid-block",
      "data-code": node.attrs.code,
    }, node.attrs.code]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div")
      dom.className = "wiki-mermaid-block wiki-mermaid-rendered"
      dom.contentEditable = "false"

      const renderArea = document.createElement("div")
      renderArea.className = "wiki-mermaid-render-area"
      dom.appendChild(renderArea)

      renderMermaidSvg(node.attrs.code, renderArea)

      dom.addEventListener("click", (e) => {
        if (e.target.closest("button")) return
        dom.dispatchEvent(new CustomEvent("wiki:mermaid-edit", {
          detail: { code: node.attrs.code, getPos },
          bubbles: true,
        }))
      })

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: (event) => !!(event.target.closest && event.target.closest("button")),
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      }
    }
  },
})

// --- Main Controller ---

export default class extends Controller {
  static targets = [
    "editor", "input",
    "linkModal", "linkText", "linkUrl", "unlinkBtn", "linkBubble",
    "embedModal", "embedCode",
    "mathModal", "mathLatex", "mathPreview",
    "mermaidModal", "mermaidCode", "mermaidPreview",
    "tableBubble",
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
          inclusive: false,
          HTMLAttributes: {},
        }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
        EmbedPlaceholder,
        CollapsibleDetails,
        DetailsSummary,
        MathInline,
        MathBlock,
        MermaidBlock,
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
        handleClickOn: (view, pos, node, nodePos, event, direct) => {
          if (!direct) return false
          if (node.type.name === "mathInline" || node.type.name === "mathBlock") {
            this.openMathEditForNode(node, nodePos)
            return true
          }
          return false
        },
        handleTextInput: (view, from, to, text) => {
          const { state } = view
          const $from = state.doc.resolve(from)
          const linkType = state.schema.marks.link
          if (!linkType) return false

          const linkBefore = $from.nodeBefore?.marks.some(m => m.type === linkType) ?? false
          const linkAfter = $from.nodeAfter?.marks.some(m => m.type === linkType) ?? false

          if (linkBefore === linkAfter) return false

          const marks = (state.storedMarks || $from.marks()).filter(m => m.type !== linkType)
          view.dispatch(state.tr.setStoredMarks(marks).insertText(text, from, to))
          return true
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
        this.updateTableBubble()
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

    if (this.hasMathModalTarget) {
      this.boundMathModalKeydown = this.handleMathModalKeydown.bind(this)
      this.mathModalTarget.addEventListener("keydown", this.boundMathModalKeydown)
    }

    if (this.hasMermaidModalTarget) {
      this.boundMermaidModalKeydown = this.handleMermaidModalKeydown.bind(this)
      this.mermaidModalTarget.addEventListener("keydown", this.boundMermaidModalKeydown)
    }

    this.boundEmbedEdit = this.handleEmbedEdit.bind(this)
    this.editorTarget.addEventListener("wiki:embed-edit", this.boundEmbedEdit)

    this.boundMermaidEdit = this.handleMermaidEdit.bind(this)
    this.editorTarget.addEventListener("wiki:mermaid-edit", this.boundMermaidEdit)

    if (this.hasTableBubbleTarget) {
      this.tableBubbleTarget.addEventListener("mousedown", (e) => e.preventDefault())
    }

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
    if (this.hasMathModalTarget) {
      this.mathModalTarget?.removeEventListener("keydown", this.boundMathModalKeydown)
    }
    if (this.hasMermaidModalTarget) {
      this.mermaidModalTarget?.removeEventListener("keydown", this.boundMermaidModalKeydown)
    }
    this.editorTarget?.removeEventListener("wiki:embed-edit", this.boundEmbedEdit)
    this.editorTarget?.removeEventListener("wiki:mermaid-edit", this.boundMermaidEdit)
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

  insertTable(e) {
    e.preventDefault()
    this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  insertDivider(e) {
    e.preventDefault()
    this.editor.chain().focus().setHorizontalRule().run()
  }

  insertCollapsible(e) {
    e.preventDefault()
    this.editor.chain().focus().insertContent({
      type: "details",
      content: [
        { type: "detailsSummary", content: [{ type: "text", text: "Section title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Content here..." }] },
      ],
    }).run()
  }

  // --- Table bubble ---

  updateTableBubble() {
    if (!this.hasTableBubbleTarget || !this.editor) return
    if (this.editor.isActive("table")) {
      const { $from } = this.editor.state.selection
      let depth = $from.depth
      while (depth > 0 && $from.node(depth).type.name !== "table") depth--
      if (depth > 0) {
        const tableStart = $from.before(depth)
        const dom = this.editor.view.nodeDOM(tableStart)
        if (dom && dom.getBoundingClientRect) {
          const rect = dom.getBoundingClientRect()
          this.tableBubbleTarget.hidden = false
          this.tableBubbleTarget.style.position = "fixed"
          this.tableBubbleTarget.style.top = `${Math.max(4, rect.top - this.tableBubbleTarget.offsetHeight - 4)}px`
          this.tableBubbleTarget.style.left = `${rect.left}px`
          return
        }
      }
      this.tableBubbleTarget.hidden = true
    } else {
      this.tableBubbleTarget.hidden = true
    }
  }

  addColumnBefore(e) { e.preventDefault(); this.editor.chain().focus().addColumnBefore().run() }
  addColumnAfter(e) { e.preventDefault(); this.editor.chain().focus().addColumnAfter().run() }
  deleteColumn(e) { e.preventDefault(); this.editor.chain().focus().deleteColumn().run() }
  addRowBefore(e) { e.preventDefault(); this.editor.chain().focus().addRowBefore().run() }
  addRowAfter(e) { e.preventDefault(); this.editor.chain().focus().addRowAfter().run() }
  deleteRow(e) { e.preventDefault(); this.editor.chain().focus().deleteRow().run() }
  deleteTable(e) { e.preventDefault(); this.editor.chain().focus().deleteTable().run() }

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

  // --- Math ---

  closeMathModal(e) {
    e?.preventDefault()
    if (this.hasMathModalTarget) this.mathModalTarget.hidden = true
    this.editingMathGetPos = null
    this.editor.chain().focus().run()
  }

  openMathEditForNode(node, nodePos) {
    this.editingMathGetPos = () => nodePos
    this.editingMathDisplayMode = node.type.name === "mathBlock"
    if (this.hasMathLatexTarget) this.mathLatexTarget.value = node.attrs.latex
    this.updateMathPreview()
    if (this.hasMathModalTarget) this.mathModalTarget.hidden = false
    if (this.hasMathLatexTarget) this.mathLatexTarget.focus()
  }

  updateMathPreview() {
    if (!this.hasMathPreviewTarget || !this.hasMathLatexTarget) return
    const latex = this.mathLatexTarget.value.trim()
    if (!latex) {
      this.mathPreviewTarget.innerHTML = '<span style="color:#999">Preview will appear here</span>'
      return
    }
    this.mathPreviewTarget.innerHTML = renderKatex(latex, this.editingMathDisplayMode || false)
  }

  applyMath(e) {
    e?.preventDefault()
    const latex = this.hasMathLatexTarget ? this.mathLatexTarget.value.trim() : ""
    if (!latex) { this.closeMathModal(); return }

    const nodeType = this.editingMathDisplayMode ? "mathBlock" : "mathInline"

    if (this.editingMathGetPos) {
      const pos = this.editingMathGetPos()
      this.editor.chain().focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .insertContentAt(pos, { type: nodeType, attrs: { latex } })
        .run()
    } else {
      this.editor.chain().focus()
        .insertContent({ type: nodeType, attrs: { latex } })
        .run()
    }

    this.closeMathModal()
  }

  removeMath(e) {
    e?.preventDefault()
    if (this.editingMathGetPos) {
      const pos = this.editingMathGetPos()
      this.editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run()
    }
    this.closeMathModal()
  }

  insertMathInline(e) {
    e?.preventDefault()
    this.editingMathGetPos = null
    this.editingMathDisplayMode = false
    if (this.hasMathLatexTarget) this.mathLatexTarget.value = ""
    if (this.hasMathPreviewTarget) this.mathPreviewTarget.innerHTML = ""
    if (this.hasMathModalTarget) this.mathModalTarget.hidden = false
    if (this.hasMathLatexTarget) this.mathLatexTarget.focus()
  }

  // --- Mermaid ---

  openMermaidModal(e) {
    e?.preventDefault()
    this.editingMermaidGetPos = null
    if (this.hasMermaidCodeTarget) this.mermaidCodeTarget.value = ""
    if (this.hasMermaidPreviewTarget) this.mermaidPreviewTarget.innerHTML = ""
    if (this.hasMermaidModalTarget) this.mermaidModalTarget.hidden = false
    if (this.hasMermaidCodeTarget) this.mermaidCodeTarget.focus()
  }

  closeMermaidModal(e) {
    e?.preventDefault()
    if (this.hasMermaidModalTarget) this.mermaidModalTarget.hidden = true
    this.editingMermaidGetPos = null
    this.editor.chain().focus().run()
  }

  handleMermaidEdit(e) {
    const { code, getPos } = e.detail
    this.editingMermaidGetPos = getPos
    if (this.hasMermaidCodeTarget) this.mermaidCodeTarget.value = code
    this.updateMermaidPreview()
    if (this.hasMermaidModalTarget) this.mermaidModalTarget.hidden = false
    if (this.hasMermaidCodeTarget) this.mermaidCodeTarget.focus()
  }

  updateMermaidPreview() {
    if (!this.hasMermaidPreviewTarget || !this.hasMermaidCodeTarget) return
    const code = this.mermaidCodeTarget.value.trim()
    if (!code) {
      this.mermaidPreviewTarget.innerHTML = '<span style="color:#999">Preview will appear here</span>'
      return
    }
    if (this.mermaidPreviewTimeout) clearTimeout(this.mermaidPreviewTimeout)
    this.mermaidPreviewTimeout = setTimeout(() => {
      renderMermaidSvg(code, this.mermaidPreviewTarget)
    }, 400)
  }

  applyMermaid(e) {
    e?.preventDefault()
    const code = this.hasMermaidCodeTarget ? this.mermaidCodeTarget.value.trim() : ""
    if (!code) { this.closeMermaidModal(); return }

    if (this.editingMermaidGetPos) {
      const pos = this.editingMermaidGetPos()
      const currentNode = this.editor.state.doc.nodeAt(pos)
      if (currentNode) {
        this.editor.chain().focus()
          .deleteRange({ from: pos, to: pos + currentNode.nodeSize })
          .insertContentAt(pos, { type: "mermaidBlock", attrs: { code } })
          .run()
      }
    } else {
      this.editor.chain().focus()
        .insertContent({ type: "mermaidBlock", attrs: { code } })
        .run()
    }

    this.closeMermaidModal()
  }

  removeMermaid(e) {
    e?.preventDefault()
    if (this.editingMermaidGetPos) {
      const pos = this.editingMermaidGetPos()
      const currentNode = this.editor.state.doc.nodeAt(pos)
      if (currentNode) {
        this.editor.chain().focus().deleteRange({ from: pos, to: pos + currentNode.nodeSize }).run()
      }
    }
    this.closeMermaidModal()
  }

  handleMermaidModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); this.closeMermaidModal() }
  }

  // --- Keyboard ---

  handleFormKeydown(e) {
    if (e.key !== "Enter") return
    if (!this.linkModalTarget.hidden) return
    if (this.hasMathModalTarget && !this.mathModalTarget.hidden) return
    if (this.hasMermaidModalTarget && !this.mermaidModalTarget.hidden) return
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) e.preventDefault()
  }

  handleModalKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.applyLink(e) }
    if (e.key === "Escape") this.closeLinkModal()
  }

  handleEmbedModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); this.closeEmbedModal() }
  }

  handleMathModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); this.closeMathModal() }
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
    const embedMap = {}
    let embedCounter = 0
    const preProcessed = html.replace(/<div[^>]*class="wiki-embed-placeholder"[^>]*data-embed="([^"]*)"[^>]*>(?:<\/div>)?/g, (_match, encoded) => {
      const key = `WIKIEMBED${embedCounter++}X`
      embedMap[key] = encoded
      return `<p>${key}</p>`
    })

    const service = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" })

    service.addRule("mathInline", {
      filter: (node) => node.nodeName === "SPAN" && node.classList && node.classList.contains("wiki-math-inline"),
      replacement: (_content, node) => {
        const latex = node.getAttribute("data-latex") || node.textContent
        return `$${latex}$`
      },
    })

    service.addRule("mathBlock", {
      filter: (node) => node.nodeName === "DIV" && node.classList && node.classList.contains("wiki-math-block"),
      replacement: (_content, node) => {
        const latex = node.getAttribute("data-latex") || node.textContent
        return `\n\n$$${latex}$$\n\n`
      },
    })

    service.addRule("mermaidBlock", {
      filter: (node) => node.nodeName === "DIV" && node.classList && node.classList.contains("wiki-mermaid-block"),
      replacement: (_content, node) => {
        const code = node.getAttribute("data-code") || node.textContent
        return `\n\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`
      },
    })

    service.addRule("collapsibleSummary", {
      filter: "summary",
      replacement: (content) => `<summary>${content.trim()}</summary>`,
    })

    service.addRule("collapsibleDetails", {
      filter: (node) => node.nodeName === "DETAILS",
      replacement: (content) => {
        const match = content.match(/<summary>([\s\S]*?)<\/summary>/)
        const summaryText = match ? match[1].trim() : "Details"
        const body = content.replace(/<summary>[\s\S]*?<\/summary>/, "").trim()
        return `\n\n<details>\n<summary>${summaryText}</summary>\n\n${body}\n\n</details>\n\n`
      },
    })

    service.use(gfm)

    let md
    try {
      md = service.turndown(preProcessed) || ""
    } catch {
      const el = document.createElement("div")
      el.innerHTML = html
      return el.textContent || ""
    }

    Object.entries(embedMap).forEach(([key, encoded]) => {
      try {
        const iframeHtml = decodeURIComponent(escape(atob(encoded)))
        md = md.replace(key, `\n\n<div class="wiki-embed-wrapper">${iframeHtml}</div>\n\n`)
      } catch {
        md = md.replace(key, "")
      }
    })

    return md
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
