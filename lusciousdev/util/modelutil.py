
from django.utils import timezone
from django.utils.http import int_to_base36

import datetime
import uuid

ID_LENGTH = 16
def id_gen(id_len = ID_LENGTH) -> str:
  return int_to_base36(uuid.uuid4().int)[:id_len]

def current_time_seconds() -> int:
  return int(datetime.datetime.now().timestamp())