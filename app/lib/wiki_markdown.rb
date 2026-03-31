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

  def self.render(content)
    content ||= ""

    placeholders = {}
    counter = 0

    processed = content.gsub(BLOCK_MATH_RE) do
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

    renderer = Renderer.new
    markdown = Redcarpet::Markdown.new(renderer,
      fenced_code_blocks: true,
      tables: true,
      no_intra_emphasis: true,
      lax_spacing: true
    )
    html = markdown.render(processed)

    placeholders.each do |key, replacement|
      html.gsub!(%r{<p>#{Regexp.escape(key)}</p>|#{Regexp.escape(key)}}, replacement)
    end

    sections = renderer.instance_variable_get(:@sections) || []
    { html: html.html_safe, sections: sections }
  end
end
