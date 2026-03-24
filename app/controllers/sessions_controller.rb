# frozen_string_literal: true

class SessionsController < ApplicationController
  def create
    auth = request.env["omniauth.auth"]
    email = auth.info.email

    unless allowed_email?(email)
      redirect_to root_path, alert: Rails.application.config.wiki_unauthorized_domain_message
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

    domain = email.split("@", 2).last.to_s
    Rails.application.config.wiki_user_domains.include?(domain) ||
      AllowedEmail.permitted?(email)
  end
end
