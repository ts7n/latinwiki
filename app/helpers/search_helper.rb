# frozen_string_literal: true

module SearchHelper
  SNIPPET_LENGTH = 200
  SNIPPET_PADDING = 80

  # Returns an HTML snippet for a page search result: either the section around
  # the first match (with matched terms bolded) or the first two lines of content.
  def search_result_snippet(page, query)
    return "" if page.blank? || query.blank?

    content = page.content.to_s
    snippet = extract_snippet_around_match(content, query_words(query))
    snippet = first_lines(content, 2) if snippet.blank?
    highlight_matches(snippet, query_words(query))
  end

  # Returns an HTML snippet for a people search result.
  def search_user_snippet(user, query)
    return "" if user.blank? || query.blank?

    content = user.description.to_s
    return "" if content.blank?

    highlight_matches(content.truncate(SNIPPET_LENGTH), query_words(query))
  end

  def query_words(query)
    words = query.to_s.split(/\s+/).map(&:strip).reject { |w| w.length < 2 }
    words.presence || [query.to_s.strip].reject(&:blank?)
  end

  private

  def extract_snippet_around_match(content, words)
    content_lower = content.downcase
    first_pos = nil

    words.each do |word|
      pos = content_lower.index(Regexp.escape(word.downcase))
      first_pos = pos if pos && (first_pos.nil? || pos < first_pos)
    end

    return "" if first_pos.nil?

    start_pos = [0, first_pos - SNIPPET_PADDING].max
    end_pos = [content.length, first_pos + words.join.length + SNIPPET_PADDING].min
    end_pos = [content.length, start_pos + SNIPPET_LENGTH].min
    start_pos = [0, end_pos - SNIPPET_LENGTH].max if end_pos - start_pos > SNIPPET_LENGTH

    snippet = content[start_pos...end_pos]
    snippet = "…#{snippet}" if start_pos.positive?
    snippet = "#{snippet}…" if end_pos < content.length
    snippet.strip
  end

  def first_lines(content, count)
    lines = content.lines.map(&:strip).reject(&:blank?).first(count)
    lines.join(" ").truncate(SNIPPET_LENGTH)
  end

  def highlight_matches(text, words)
    return "" if text.blank?

    result = ERB::Util.html_escape(text)
    words.each do |word|
      next if word.length < 2

      pattern = Regexp.new(Regexp.escape(word), Regexp::IGNORECASE)
      result = result.gsub(pattern) { |m| "<strong>#{ERB::Util.html_escape(m)}</strong>" }
    end
    result.html_safe
  end
end
