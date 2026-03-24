import { Controller } from "@hotwired/stimulus"
import mermaid from "mermaid"

// Handles client-side rendering of special content blocks:
//   • Mermaid diagrams  (fenced ```mermaid code blocks)
//   • KaTeX math        (\[…\] block and \(…\) inline, produced by the backend
//                        preprocessor for $$…$$ and $…$ markdown syntax)
export default class extends Controller {
  connect() {
    this.renderMermaid()
    this.renderMath()
  }

  // Find every <pre><code class="language-mermaid"> block, pass the source text
  // to mermaid.js and replace the <pre> with the generated SVG.
  renderMermaid() {
    const blocks = Array.from(
      this.element.querySelectorAll("pre code.language-mermaid"),
    )
    if (blocks.length === 0) return

    mermaid.initialize({ startOnLoad: false, theme: "default" })

    blocks.forEach((codeEl) => {
      const pre = codeEl.parentElement
      const source = codeEl.textContent || ""
      const id = `wiki-mermaid-${Math.random().toString(36).slice(2)}`

      const wrapper = document.createElement("div")
      wrapper.className = "wiki-mermaid"

      mermaid.render(id, source)
        .then(({ svg }) => {
          wrapper.innerHTML = svg
          pre.replaceWith(wrapper)
        })
        .catch(() => {
          // On error leave the raw code block visible so content isn't lost.
          wrapper.classList.add("wiki-mermaid--error")
          wrapper.textContent = source
          pre.replaceWith(wrapper)
        })
    })
  }

  // Invoke KaTeX's renderMathInElement (loaded via CDN) on the article body.
  // The backend wraps block math in \[…\] and inline math in \(…\).
  renderMath() {
    if (typeof window.renderMathInElement !== "function") return

    window.renderMathInElement(this.element, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    })
  }
}
