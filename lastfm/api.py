from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse, Http404, HttpResponseRedirect, JsonResponse
from django.utils import timezone

from .models import *

def get_lastfm_grid(request):
  if request.method != "GET":
    return HttpResponse("Invalid request type.", 501)
  
  username = request.GET.get("username", None)
  period = request.GET.get("period", None)
  size = request.GET.get("size", '3')
  
  if username is None or period is None:
    return HttpResponse("Incomplete request data.", 400)
  
  try:
    grid : LastFMGrid = LastFMGrid.objects.get(username = username, period = period, size = int(size))
  except LastFMGrid.DoesNotExist:
    return JsonResponse({ "ready": False, "message": "Grid does not exist." })
  
  if (timezone.now() - grid.created_at).total_seconds() > 120.0:
    return JsonResponse({ "ready": False, "message": "Grid is too old." })
  
  if grid.results is None:
    return JsonResponse({ "ready": False, "message": "Results are empty." })
  
  return JsonResponse({ "ready": True, **grid.results })