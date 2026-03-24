# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

return unless Page.table_exists?

# Only built-in seed page: meta/introduction (not configurable in wiki.yml).
Page.find_or_create_by!(slug: "introduction", section_slug: "meta") do |p|
  p.title = "Introduction"
  p.content = "Welcome to the wiki."
  p.position = 0
end

# Ensure all pages have at least one version (for pages created before versions existed)
if PageVersion.table_exists?
  Page.find_each do |page|
    next if page.versions.any?

    page.versions.create!(title: page.title, content: page.content, version_number: 1)
  end
end
