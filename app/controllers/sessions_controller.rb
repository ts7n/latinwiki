class SessionsController < ApplicationController
  ALLOWED_DOMAINS = %w[lsoc.org latinschool.org].freeze

  def create
    auth = request.env["omniauth.auth"]
    email = auth.info.email

    unless allowed_email?(email)
      redirect_to root_path, alert: "This email is not authorized to login. If you\'re currently at Latin, you need to sign in with your school Google account. If you\'re an alumni, see the homepage for access instructions."
      return
    end

    user = User.find_or_create_by(google_uid: auth.uid) do |u|
      u.name = auth.info.name
      u.email = email
      u.avatar_url = auth.info.image
    end

    session[:user_id] = user.id
    redirect_to root_path, notice: "Signed in as #{user.name}"
  end

  def destroy
    session[:user_id] = nil
    redirect_to root_path, notice: "Signed out"
  end

  def failure
    redirect_to root_path, alert: "Authentication failed"
  end

  private

  def allowed_email?(email)
    return false if email.blank?

    ALLOWED_DOMAINS.any? { |domain| email.end_with?("@#{domain}") } ||
      AllowedEmail.permitted?(email)
  end
end