from django.conf import settings
import requests
import json
import typing
import logging

class Album:
  name : str = ""
  artist : str = ""
  art : str = ""
  total_playtime : int = 0
  
  def __init__(self, name : str, artist : str, art : str):
    self.name = name
    self.artist = artist
    self.art = art
    self.total_playtime = 0
    
  def __eq__(self, other : 'Album'):
    return self.name == other.name and self.artist == other.artist
  
  def __str__(self):
    return f"\"{self.name}\" by {self.artist} ({ self.total_playtime / 1000 } seconds)"
  
  def add_track_plays(self, playcount : int, duration : int):
    self.total_playtime += (playcount * duration)
    
  def to_json(self) -> dict:
    total_seconds = self.total_playtime / 1000
    rem, playtime_seconds = divmod(total_seconds, 60)
    playtime_hours, playtime_minutes = divmod(rem, 60)
    return {
      "name": self.name,
      "artist": self.artist,
      "art": self.art,
      "playtime_hours": int(playtime_hours),
      "playtime_minutes": int(playtime_minutes),
      "playtime_seconds": int(playtime_seconds)
    }

def check_error(response_json : dict) -> bool:
  if 'error' in response_json:
    logging.warning(f"last.fm API Error: {response_json['message']} ({response_json['error']})")
    return True
  return False

def get_top_albums(username : str, period : str, size : int) -> typing.List[typing.Dict[str, str]]:
  limit = size * size
  resp = requests.get(f"{settings.LASTFM_API_URL}/2.0/?method=user.gettopalbums&api_key={settings.LASTFM_API_KEY}&user={username}&period={period}&limit={limit}&format=json")
  resp_json = resp.json()
  
  if check_error(resp_json):
    return None
  
  albums = []
  for album in resp_json['topalbums']['album']:
    albumobj = {
      'artist': album['artist']['name'],
      'name': album['name'],
      'art': album['image'][-1]['#text']
    }
    albums.append(albumobj)
  
  return albums
      