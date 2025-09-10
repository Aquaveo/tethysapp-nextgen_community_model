import json
import os
import shutil

from tethys_sdk.layouts import MapLayout
from tethys_sdk.routing import controller
from tethysapp.nextgen_community_model.app import App

import geopandas as gpd

from pathlib import Path


@controller(name='map_view', url='nextgen_community_model/map', app_workspace=True, app_resources=True)
def map_view(request, app_workspace, app_resources):
    """
    Controller for the Map View page.
    """

    context = {}
    return App.render(request, 'map_view.html', context)
