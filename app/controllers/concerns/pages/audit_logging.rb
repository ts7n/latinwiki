# frozen_string_literal: true

module Pages
  module AuditLogging
    extend ActiveSupport::Concern

    private

    def log_audit
      return unless current_user
      return unless response.redirect? || response.successful?

      page = @page.is_a?(Page) ? @page : nil
      return unless page || action_name == "create"

      metadata = {}
      rationale = params.dig(:page, :rationale).to_s.strip.presence
      metadata[:rationale] = rationale if rationale

      AuditLog.create!(
        user: current_user,
        action: action_name,
        page_path: page&.path || @created_page_path,
        page_title: page&.title || @created_page_title,
        ip_address: request.remote_ip,
        user_agent: request.user_agent.to_s.truncate(500),
        metadata: metadata.presence
      )
    rescue StandardError => e
      Rails.logger.error("AuditLog failed: #{e.message}")
    end
  end
end
