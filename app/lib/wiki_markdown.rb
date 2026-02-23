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

  def self.render(content)
    renderer = Renderer.new
    markdown = Redcarpet::Markdown.new(renderer, fenced_code_blocks: true, tables: true)
    html = markdown.render(content || "")
    sections = renderer.instance_variable_get(:@sections) || []
    { html: html.html_safe, sections: sections }
  end
end
