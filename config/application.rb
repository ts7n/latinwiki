require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :development, :test, or :production.
Bundler.require(*Rails.groups)

module Latinwiki
  class Application < Rails::Application
    wiki_config_path = root.join("config/wiki.yml")
    wiki_config = (File.exist?(wiki_config_path) ? YAML.load_file(wiki_config_path) : {}).deep_symbolize_keys

    config.wiki_name = wiki_config[:wiki_name].presence || "Wiki"
    config.wiki_accent_color = wiki_config[:accent_color].presence || "#2563eb"
    user_domains = Array(wiki_config[:user_domains]).map(&:to_s)
    config.wiki_user_domains = user_domains
    moderator_domains = Array(wiki_config[:moderator_domains]).map(&:to_s).presence
    config.wiki_moderator_domains = moderator_domains || config.wiki_user_domains
    config.wiki_role_labels = (wiki_config[:role_labels] || {}).stringify_keys

    config.wiki_sections = wiki_config[:sections] || []
    config.wiki_default_path = (wiki_config[:default_path] || "meta/introduction").to_s
    config.wiki_sign_in_required_message =
      wiki_config[:sign_in_required_message].presence ||
      "Sign in with Google to continue."
    config.wiki_unauthorized_domain_message =
      wiki_config[:unauthorized_domain_message].presence ||
      "This email address is not allowed to sign in."

    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that
    # do not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # Configuration can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
