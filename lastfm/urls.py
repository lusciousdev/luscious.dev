from django.urls import path

from . import views

app_name = 'lastfm'
urlpatterns = [
  path("", views.IndexView.as_view(), name="index"),
  path("user/<str:username>", views.UserView.as_view(), name="user"),
  path("user/", views.redirect_home, name="userhome"),
]