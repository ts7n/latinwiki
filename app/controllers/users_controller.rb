# frozen_string_literal: true

class UsersController < ApplicationController
  before_action :set_user_for_profile_edit, only: [ :edit ]
  before_action :set_user, only: [ :update ]
  before_action :require_owner, only: [ :edit, :update ]
  before_action :set_pages_for_sidebar

  def show
    unless current_user
      render "shared/permission_missing", status: :forbidden, layout: "application"
      return
    end
    @user = User.find_by_username(params[:username])
    if @user
      if @user.profile_content.blank? && current_user&.id == @user.id
        @show_empty_profile_help = true
        @content = nil
        @sections = []
      else
        rendered = WikiMarkdown.render(@user.profile_content.presence || "No content")
        @content = rendered[:html]
        @sections = rendered[:sections] || []
      end
    else
      @content = nil
      @sections = []
    end
    render :show, status: (@user ? :ok : :not_found)
  end

  def edit
    @content_html = WikiMarkdown.render(@user.profile_content.presence || "")[:html]
  end

  def update
    if @user.update(user_params)
      redirect_to user_path(@user.username), notice: "Profile updated."
    else
      @pages_for_sidebar ||= pages_for_sidebar
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_user_for_profile_edit
    unless current_user
      render "shared/permission_missing", status: :forbidden, layout: "application"
      return
    end
    @user = current_user
  end

  def set_user
    @user = User.find_by_username(params[:username])
    redirect_to root_path, alert: "User not found." unless @user
  end

  def require_owner
    redirect_to user_path(@user.username), alert: "You can only edit your own profile." unless current_user && current_user.id == @user.id
  end

  def set_pages_for_sidebar
    @pages_for_sidebar ||= pages_for_sidebar
  end

  def user_params
    params.require(:user).permit(:name, :pronouns, :profile_content, :description)
  end
end
