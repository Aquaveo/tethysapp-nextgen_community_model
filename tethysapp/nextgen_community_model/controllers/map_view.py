import datetime
import json
import os
import shutil

from tethys_sdk.gizmos import DatePicker
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
    # Get the current date
    today = datetime.date.today()
    
    # Create the date picker
    last_run_view_date_picker = DatePicker(
        name='last-run-view-date-picker',
        display_text='',
        autoclose=True,
        initial=today.strftime('%d %B %Y'),
        start_date='-7d',
        end_date='+0d',
        format='d MM yyyy',
    )

    # Create the context dictionary
    context = {
        'last_run_view_date_picker': last_run_view_date_picker
    }
    
    return App.render(request, 'map_view.html', context)
