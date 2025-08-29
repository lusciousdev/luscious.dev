import base64
import json
import logging
import math
import typing
from io import BytesIO

import requests
from celery import Celery, shared_task
from celery.schedules import crontab
from django.conf import settings
from PIL import Image

from .lastfm import *
from .models import *

logger = logging.getLogger("lastfm")


def create_grid(width, height, image_urls) -> Image.Image:
    assert len(image_urls) >= (width * height)

    img_list: typing.List[Image.Image] = []
    for url in image_urls:
        if url != "":
            resp = requests.get(url)
            try:
                img_list.append(Image.open(BytesIO(resp.content)))
            except Exception as e:
                logger.error(url)
                logger.error(resp.content)
                logger.error(e)
                img_list.append(Image.new("RGB", size=(300, 300), color="black"))
        else:
            img_list.append(Image.new("RGB", size=(300, 300), color="black"))

    ah, aw = img_list[0].size

    imgh = height * ah
    imgw = width * aw

    grid = Image.new("RGB", size=(imgw, imgh))

    for i, img in enumerate(img_list[:(width * height)]):
        grid.paste(img, box=((i % width) * aw, (i // width) * ah))

    return grid


@shared_task
def calc_lastfm_grid(username, period, width, height):
    print(f"Calculating grid for {username} {period} {width}x{height}")

    grid, newgrid = LastFMGrid.objects.get_or_create(
        username=username, period=period, width=width, height=height
    )

    if (
        not newgrid
        and (timezone.now() - grid.created_at).total_seconds() < 120.0
        and grid.results is not None
    ):
        print("Grid has been recently edited.")
        return

    grid.results = None
    grid.save()

    topalbums = get_top_albums(username, period, width * height)

    img_urls = ["" for i in range(width * height)]
    for i, album in enumerate(topalbums):
        if "art" in album:
            img_urls[i] = album["art"]

    gridimg = create_grid(width, height, img_urls)

    buffered = BytesIO()
    gridimg.save(buffered, format="JPEG")
    data_url = "data:image/jpg;base64," + base64.b64encode(buffered.getvalue()).decode()

    grid.results = {
        "topalbums": topalbums,
        "image": data_url,
    }

    grid.save()
