from tethys_sdk.base import TethysAppBase


class App(TethysAppBase):
    """
    Tethys app class for NextGen Community Model.
    """
    name = 'NextGen Community Water Model Health Monitor'
    description = ''
    package = 'nextgen_community_model'  # WARNING: Do not change this value
    index = 'map_view'
    icon = f'{package}/images/icon.png'
    root_url = 'nextgen-community-model'
    color = '#192a56'
    tags = ''
    enable_feedback = False
    feedback_emails = []
