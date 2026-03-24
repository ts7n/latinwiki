# frozen_string_literal: true

module WikiMarkdown
  class Renderer < Redcarpet::Render::HTML
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

  # Protect block math ($$...$$) and inline math ($...$) from Redcarpet's
  # markdown processing so that LaTeX syntax like _ and * is not reinterpreted.
  def self.extract_math(content)
    math_stash = []

    # Block math $$...$$ — must be matched before inline $...$
    content = content.gsub(/\$\$([^\$]+)\$\$/m) do
      idx = math_stash.size
      math_stash << [ :block, Regexp.last_match(1).strip ]
      "WIKIMATH#{idx}ENDMATH"
    end

    # Inline math $...$ — must not start or end with whitespace
    content = content.gsub(/\$(?!\s)([^$\n]+?)(?<!\s)\$/) do
      idx = math_stash.size
      math_stash << [ :inline, Regexp.last_match(1) ]
      "WIKIMATH#{idx}ENDMATH"
    end

    [ content, math_stash ]
  end

  def self.restore_math(html, math_stash)
    return html if math_stash.empty?

    html.gsub(/WIKIMATH(\d+)ENDMATH/) do
      type, latex = math_stash[Regexp.last_match(1).to_i]
      escaped = ERB::Util.html_escape(latex)
      if type == :block
        "<div class=\"math-block\">\\[#{escaped}\\]</div>"
      else
        "<span class=\"math-inline\">\\(#{escaped}\\)</span>"
      end
    end
  end

  # Extract :::details … ::: blocks so that their Markdown body is rendered
  # by a nested Redcarpet pass rather than being swallowed by the HTML-block
  # passthrough rule.
  def self.extract_details(content)
    details_stash = []

    content = content.gsub(/^:::details[ \t]+(.*?)\n(.*?)^:::[ \t]*\n?/m) do
      idx = details_stash.size
      details_stash << { summary: Regexp.last_match(1).strip, body: Regexp.last_match(2) }
      "WIKIDETAILS#{idx}ENDDETAILS\n"
    end

    [ content, details_stash ]
  end

  def self.restore_details(html, details_stash)
    return html if details_stash.empty?

    body_renderer = Renderer.new
    body_markdown = Redcarpet::Markdown.new(body_renderer, fenced_code_blocks: true, tables: true)

    html.gsub(/<p>\s*WIKIDETAILS(\d+)ENDDETAILS\s*<\/p>|WIKIDETAILS(\d+)ENDDETAILS/) do
      idx = (Regexp.last_match(1) || Regexp.last_match(2)).to_i
      info = details_stash[idx]
      summary_escaped = ERB::Util.html_escape(info[:summary])
      body_html = body_markdown.render(info[:body] || "")
      "<details>\n<summary>#{summary_escaped}</summary>\n<div class=\"wiki-details-body\">#{body_html}</div>\n</details>"
    end
  end

  def self.render(content)
    content = content || ""

    # Pre-process custom block syntaxes before Redcarpet sees the source.
    content, details_stash = extract_details(content)
    content, math_stash    = extract_math(content)

    renderer = Renderer.new
    markdown = Redcarpet::Markdown.new(renderer, fenced_code_blocks: true, tables: true)
    html = markdown.render(content)

    # Post-process: restore extracted blocks with rendered HTML.
    html = restore_details(html, details_stash)
    html = restore_math(html, math_stash)

    sections = renderer.instance_variable_get(:@sections) || []
    { html: html.html_safe, sections: sections }
  end
end
