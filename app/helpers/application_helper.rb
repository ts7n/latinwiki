module ApplicationHelper
  def transform_embeds_for_editor(html)
    return html if html.blank?

    doc = Nokogiri::HTML5.fragment(html)
    doc.css(".wiki-embed-wrapper").each do |wrapper|
      iframe = wrapper.at_css("iframe")
      next unless iframe

      iframe_html = iframe.to_html
      encoded = Base64.strict_encode64(iframe_html)
      src = iframe["src"].to_s
      label = src.present? ? src.sub(%r{\Ahttps?://}, "").truncate(40) : "iframe"
      placeholder_html = <<~HTML.squish
        <span class="wiki-embed-placeholder" contenteditable="false" data-embed="#{ERB::Util.html_escape(encoded)}" data-embed-src="#{ERB::Util.html_escape(src)}">
          <span class="wiki-embed-placeholder-inner">
            <span class="wiki-embed-icon">◇</span>
            <code class="wiki-embed-preview">#{ERB::Util.html_escape(label)}</code>
            <button type="button" class="wiki-embed-edit-btn">Edit</button>
            <button type="button" class="wiki-embed-remove-btn">Remove</button>
          </span>
        </span>
      HTML
      wrapper.replace(Nokogiri::HTML5.fragment(placeholder_html))
    end
    doc.to_html
  end

  def edit_doc_query(path)
    path_to_cat_pg(path)
  end

  def diff_doc_query(path, v:, with:)
    path_to_cat_pg(path).merge(v: v, with: with)
  end

  def history_doc_query(path)
    path_to_cat_pg(path)
  end

  def path_to_cat_pg(path)
    parts = path.to_s.split("/").reject(&:blank?)
    return {} if parts.empty?

    { cat: (parts[0..-2].join("/") if parts.size > 1), pg: parts.last }.compact
  end

  def build_toc_groups(sections)
    return [] if sections.blank?

    groups = []
    sections.each do |s|
      if s[:level] == 2
        groups << { title: s[:title], id: s[:id], children: [] }
      elsif s[:level] == 3 && groups.any?
        groups.last[:children] << { title: s[:title], id: s[:id] }
      end
    end
    groups
  end
end
