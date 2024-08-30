from django.urls import path

from . import views
from . import api

app_name = 'lastfm'
urlpatterns = [
  path("", views.IndexView.as_view(), name="index"),
  path("user/<str:username>", views.UserView.as_view(), name="user"),
  path("user/", views.redirect_home, name="userhome"),
  
  path("api/v1/grid/", api.get_lastfm_grid, name="api_get_lastfm_grid"),
]