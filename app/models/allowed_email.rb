class AllowedEmail < ApplicationRecord
  validates :email, presence: true, uniqueness: true

  def self.permitted?(email)
    return false if email.blank?
    where("LOWER(email) = LOWER(?)", email.strip).exists?
  end
end
