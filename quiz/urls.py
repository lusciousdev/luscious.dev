from django.urls import path
from django.contrib.auth.decorators import login_required

from . import views
from . import api

app_name = 'quiz'
urlpatterns = [
  path("", views.HomeView.as_view(), name="home"),
  path("profile/", login_required(views.ProfileView.as_view()), name="profile"),
  path("create/", views.create_quiz, name="create_quiz"),
  path("edit/<slug:slug>/", login_required(views.EditQuizView.as_view()), name="edit_quiz"),
  path("update/", api.update_quiz, name="update_quiz"),
  path("<slug:slug>/", views.TakeQuizView.as_view(), name="take_quiz")
]