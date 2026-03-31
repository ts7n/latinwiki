# frozen_string_literal: true

module WikiMarkdown
  class Renderer < Redcarpet::Render::HTML
    def link(link, title, content)
      attrs = " href=\"#{link}\""
      attrs += " title=\"#{title}\"" if title && !title.empty?
      attrs += ' target="_blank" rel="noopener noreferrer"'
      "<a#{attrs}>#{content}</a>"
    end

    def autolink(link, link_type)
      %(<a href="#{link}" target="_blank" rel="noopener noreferrer">#{link}</a>)
    end

    def block_code(code, language)
      if language.to_s.strip.downcase == "mermaid"
        escaped_code = ERB::Util.html_escape(code.strip)
        %(<div class="wiki-mermaid-block" data-code="#{escaped_code}"><pre><code class="language-mermaid">#{escaped_code}</code></pre></div>)
      else
        lang_attr = language && !language.empty? ? %( class="language-#{ERB::Util.html_escape(language)}") : ""
        "<pre><code#{lang_attr}>#{ERB::Util.html_escape(code)}</code></pre>"
      end
    end

    def table(content)
      "<table class=\"wiki-table\">#{content}</table>"
    end

    def header(text, level)
      base_id = slugify(text)
      @seen_ids ||= {}
      @seen_ids[base_id] = (@seen_ids[base_id] || 0) + 1
      id = @seen_ids[base_id] == 1 ? base_id : "#{base_id}-#{@seen_ids[base_id]}"

      @sections ||= []
      @sections << { level: level, title: text, id: id } if level >= 2
      render_level = level == 1 ? 2 : level
      anchor = "<a href=\"##{id}\" class=\"wiki-heading-anchor\" aria-hidden=\"true\">#</a>"
      "<h#{render_level} id=\"#{id}\" class=\"wiki-heading-with-anchor\">#{text} #{anchor}</h#{render_level}>"
    end

    private

    def slugify(text)
      text.to_s.downcase
          .gsub(/[^\p{Word}\s-]/, "")
          .strip
          .gsub(/\s+/, "-")
          .presence || "section"
    end
  end

  BLOCK_MATH_RE  = /\$\$(.+?)\$\$/m
  INLINE_MATH_RE = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/

  COLLAPSIBLE_OPEN_RE = /<details>\s*<summary>(.*?)<\/summary>/m
  COLLAPSIBLE_CLOSE_RE = %r{</details>}

  def self.render(content)
    content ||= ""

    placeholders = {}
    counter = 0

    renderer = Renderer.new
    markdown = Redcarpet::Markdown.new(renderer,
      fenced_code_blocks: true,
      tables: true,
      no_intra_emphasis: true,
      lax_spacing: true
    )

    processed = content.gsub(COLLAPSIBLE_OPEN_RE) do
      summary_md = Regexp.last_match(1).strip
      summary_html = markdown.render(summary_md).gsub(%r{\A<p>(.*)</p>\s*\z}m, '\1').strip
      key = "WIKICOLLAPSIBLE#{counter += 1}OPEN"
      placeholders[key] = %(<details>\n<summary>#{summary_html}</summary>)
      "\n\n#{key}\n\n"
    end

    processed = processed.gsub(COLLAPSIBLE_CLOSE_RE) do
      key = "WIKICOLLAPSIBLE#{counter += 1}CLOSE"
      placeholders[key] = "</details>"
      "\n\n#{key}\n\n"
    end

    processed = processed.gsub(BLOCK_MATH_RE) do
      latex = Regexp.last_match(1).strip
      key = "WIKIMATH#{counter += 1}BLOCK"
      placeholders[key] = %(<div class="wiki-math-block" data-latex="#{ERB::Util.html_escape(latex)}">#{ERB::Util.html_escape(latex)}</div>)
      "\n\n#{key}\n\n"
    end

    processed = processed.gsub(INLINE_MATH_RE) do
      latex = Regexp.last_match(1).strip
      key = "WIKIMATH#{counter += 1}INLINE"
      placeholders[key] = %(<span class="wiki-math-inline" data-latex="#{ERB::Util.html_escape(latex)}">#{ERB::Util.html_escape(latex)}</span>)
      key
    end

    html = markdown.render(processed)

    placeholders.each do |key, replacement|
      html.gsub!(%r{<p>#{Regexp.escape(key)}</p>|#{Regexp.escape(key)}}, replacement)
    end

    sections = renderer.instance_variable_get(:@sections) || []
    { html: html.html_safe, sections: sections }
  end
end
