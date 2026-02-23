class User < ApplicationRecord
  has_many :page_coordinators, dependent: :destroy
  has_many :coordinated_pages, through: :page_coordinators, source: :page

  def self.find_by_username(username)
    return nil if username.blank?

    prefix = ActiveRecord::Base.sanitize_sql_like(username.to_s)
    User.where("email LIKE ? AND (email LIKE '%@lsoc.org' OR email LIKE '%@latinschool.org')", "#{prefix}@%").first
  end

  def username
    return nil if email.blank?

    email.split("@").first
  end

  def role_label
    return nil if email.blank?

    if email.end_with?("@latinschool.org")
      "Faculty/Staff"
    elsif email.end_with?("@lsoc.org")
      "Student"
    end
  end
end
