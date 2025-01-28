import typing
import googleapiclient.discovery
from django.conf import settings
from django.http import HttpResponse, Http404, HttpResponseRedirect, JsonResponse, HttpRequest
from django.utils import timezone
import random
from .models import *

def create_api_client():
  return googleapiclient.discovery.build("youtube", "v3", developerKey = settings.YOUTUBE_API_KEY)

def get_random_playlist_video(request):
  if request.method != "GET":
    return HttpResponse("Invalid request type.", 501)
  
  playlist_id = request.GET.get("id", None)
  
  if playlist_id is None:
    return HttpResponse("Missing playlist id.", 501)
  
  playlist_info, created = PlaylistInfo.objects.get_or_create(playlist_id = playlist_id)
    
  time_since_update = timezone.now() - playlist_info.last_fetched
    
  if created or time_since_update.total_seconds() > 7200:
    youtube_client = create_api_client()
    
    playlist_request = youtube_client.playlistItems().list(part = "id,contentDetails", playlistId = playlist_id, maxResults = 50)
    
    playlist_response = playlist_request.execute()
    
    video_list = []
    
    for video in playlist_response["items"]:
      video_id = video['contentDetails']['videoId']
      if video_id not in video_list:
        video_list.append(video_id)
        
    while playlist_response is not None and "nextPageToken" in playlist_response:
      playlist_request = youtube_client.playlistItems().list(part = "id,contentDetails", playlistId = playlist_id, maxResults = 50, pageToken = playlist_response['nextPageToken'])
      
      playlist_response = playlist_request.execute()
        
      for video in playlist_response["items"]:
        video_id = video['contentDetails']['videoId']
        if video_id not in video_list:
          video_list.append(video_id)
          
    playlist_info.info = video_list
    playlist_info.save()
    
  video_id = random.choice(playlist_info.info)
  return HttpResponse(f"https://youtube.com/watch?v={video_id}&list={playlist_id}", 200)