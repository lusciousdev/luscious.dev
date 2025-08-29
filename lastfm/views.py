import typing
from typing import Any

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse, reverse_lazy
from django.views import generic

from .forms import InfoForm
from .lastfm import *
from .models import *
from .tasks import *


# Create your views here.
class IndexView(generic.FormView):
    form_class = InfoForm
    template_name = "lastfm/index.html"

    def form_valid(self, form: InfoForm, *args, **kwargs):
        username = form.cleaned_data.get("username")
        period = form.cleaned_data.get("period")
        width = form.cleaned_data.get("width")
        height = form.cleaned_data.get("height")
        return HttpResponseRedirect(self.get_success_url(username, period, width, height))

    def get_success_url(self, username=None, period="7day", width="3", height="3") -> str:
        if not username:
            return reverse_lazy("lastfm:index")
        usernameurl = reverse_lazy("lastfm:user", kwargs={"username": username})
        return f"{usernameurl}?period={period}&width={width}&height={height}"


class UserView(generic.FormView):
    form_class = InfoForm
    template_name = "lastfm/user.html"

    def get_period(self):
        return (
            "7day" if "period" not in self.request.GET else self.request.GET["period"]
        )

    def get_size(self) -> tuple[int, int]:
        width = int(self.request.GET.get("width", "3"))
        height = int(self.request.GET.get("height", "3"))
        return (width, height)

    def get_context_data(self, **kwargs: Any) -> typing.Dict[str, Any]:
        context = super().get_context_data(**kwargs)
        context["username"] = self.kwargs["username"]
        context["period"] = self.get_period()

        size = self.get_size()

        context["width"], context["height"] = size

        calc_lastfm_grid.delay(context["username"], context["period"], size[0], size[1])

        return context

    def get_initial(self):
        initial = super().get_initial()

        initial["username"] = self.kwargs["username"]
        initial["period"] = self.get_period()

        initial["width"], initial["height"] = self.get_size()

        return initial

    def form_valid(self, form: InfoForm, *args, **kwargs):
        username = form.cleaned_data.get("username")
        period = form.cleaned_data.get("period")
        width = form.cleaned_data.get("width")
        height = form.cleaned_data.get("height")
        return HttpResponseRedirect(
            self.get_success_url(username, period, width, height)
        )

    def get_success_url(
        self, username=None, period="7day", width="3", height="3"
    ) -> str:
        if not username:
            return reverse_lazy("lastfm:index")
        usernameurl = reverse_lazy("lastfm:user", kwargs={"username": username})
        return f"{usernameurl}?period={period}&width={width}&height={height}"


def redirect_home(request):
    return HttpResponseRedirect(reverse("lastfm:index"))
