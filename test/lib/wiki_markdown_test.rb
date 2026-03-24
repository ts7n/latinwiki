# frozen_string_literal: true

require "test_helper"

class WikiMarkdownTest < ActiveSupport::TestCase
  # ── Tables ──────────────────────────────────────────────────────────────────

  test "renders markdown tables" do
    md = <<~MARKDOWN
      | Name   | Age |
      |--------|-----|
      | Alice  | 30  |
      | Bob    | 25  |
    MARKDOWN
    html = WikiMarkdown.render(md)[:html]
    assert_includes html, "<table>"
    assert_includes html, "<th>"
    assert_includes html, "<td>"
    assert_includes html, "Alice"
    assert_includes html, "Bob"
  end

  # ── Mermaid diagrams ────────────────────────────────────────────────────────

  test "renders mermaid fenced code block as code element with language-mermaid class" do
    md = <<~MARKDOWN
      ```mermaid
      graph TD
        A --> B
      ```
    MARKDOWN
    html = WikiMarkdown.render(md)[:html]
    assert_includes html, 'class="language-mermaid"'
    assert_includes html, "graph TD"
  end

  # ── Inline LaTeX ────────────────────────────────────────────────────────────

  test "renders inline math $...$ as math-inline span" do
    html = WikiMarkdown.render("Here is some math: $E = mc^2$")[:html]
    assert_includes html, '<span class="math-inline">'
    assert_includes html, "E = mc^2"
    assert_includes html, "\\("
    assert_includes html, "\\)"
  end

  test "renders block math $$...$$ as math-block div" do
    md = "$$E = mc^2$$"
    html = WikiMarkdown.render(md)[:html]
    assert_includes html, '<div class="math-block">'
    assert_includes html, "E = mc^2"
    assert_includes html, "\\["
    assert_includes html, "\\]"
  end

  test "math with underscores is not corrupted by markdown italic processing" do
    html = WikiMarkdown.render("$x_1 + x_2 = y_3$")[:html]
    assert_includes html, "x_1 + x_2 = y_3"
    refute_includes html, "<em>"
  end

  test "dollar signs not matching math pattern are left untouched" do
    html = WikiMarkdown.render("It costs $100 and $200.")[:html]
    refute_includes html, 'class="math-inline"'
  end

  test "html-escapes math content to prevent XSS" do
    html = WikiMarkdown.render('$<script>alert(1)</script>$')[:html]
    refute_includes html, "<script>"
    assert_includes html, "&lt;script&gt;"
  end

  # ── Collapsible sections ────────────────────────────────────────────────────

  test "renders :::details blocks as HTML details element" do
    md = <<~MARKDOWN
      :::details Click to expand
      Hidden content here.
      :::
    MARKDOWN
    html = WikiMarkdown.render(md)[:html]
    assert_includes html, "<details>"
    assert_includes html, "<summary>Click to expand</summary>"
    assert_includes html, "Hidden content here."
    assert_includes html, "wiki-details-body"
  end

  test "renders markdown inside :::details body" do
    md = <<~MARKDOWN
      :::details My section
      **Bold** text and a [link](https://example.com).
      :::
    MARKDOWN
    html = WikiMarkdown.render(md)[:html]
    assert_includes html, "<strong>Bold</strong>"
    assert_includes html, 'href="https://example.com"'
  end

  test "html-escapes details summary to prevent XSS" do
    md = ":::details <script>alert(1)</script>\nBody\n:::"
    html = WikiMarkdown.render(md)[:html]
    refute_includes html, "<script>"
    assert_includes html, "&lt;script&gt;"
  end

  # ── Headings and sections ───────────────────────────────────────────────────

  test "returns sections for table of contents" do
    md = "## First Section\n\nContent.\n\n## Second Section\n"
    result = WikiMarkdown.render(md)
    assert_equal 2, result[:sections].size
    assert_equal "First Section", result[:sections].first[:title]
  end
end
