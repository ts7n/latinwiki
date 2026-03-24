# frozen_string_literal: true

class User < ApplicationRecord
  has_many :page_coordinators, dependent: :destroy
  has_many :coordinated_pages, through: :page_coordinators, source: :page

  def self.find_by_username(username)
    return nil if username.blank?

    prefix = username.to_s.strip
    domains = Rails.application.config.wiki_user_domains
    return nil if domains.blank?

    emails = domains.map { |d| "#{prefix}@#{d}" }
    where(email: emails).first
  end

  def username
    return nil if email.blank?

    email.split("@").first
  end

  def role_label
    return nil if email.blank?

    domain = email.split("@", 2).last.to_s
    labels = Rails.application.config.wiki_role_labels
    labels[domain] || labels[domain.to_s]
  end
end
