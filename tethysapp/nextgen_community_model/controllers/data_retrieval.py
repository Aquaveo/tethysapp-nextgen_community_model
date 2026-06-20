import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import boto3
from botocore import UNSIGNED
from botocore.config import Config
from django.http import JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from tethys_sdk.routing import controller


BUCKET = 'ciroh-community-ngen-datastream'

# Lazy-constructed anonymous S3 client (the NRDS bucket allows public reads).
_s3_client = None


def _get_s3():
    """Return a process-wide anonymous S3 client, creating it on first use."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            's3',
            config=Config(signature_version=UNSIGNED, max_pool_connections=20),
        )
    return _s3_client


@controller(name='get_last_run_data', url='api/last-run-data', login_required=False)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_last_run_data(request):
    """Return per-VPU output status for a given date.

    Query params:
        date (str, optional): YYYYMMDD. Defaults to today (UTC).

    Response shape:
        {
            "date": "20260608",
            "vpus": {
                "01": {
                    "expected": 58,
                    "found": 52,
                    "by_datastream": {
                        "cfe_nom": {"expected": 29, "found": 26},
                        "lstm_0":  {"expected": 29, "found": 26}
                    }
                },
                "03W": {
                    "expected": 82,
                    "found": 75,
                    "by_datastream": {
                        "cfe_nom":      {"expected": 29, "found": 28},
                        "lstm_0":       {"expected": 29, "found": 29},
                        "routing_only": {"expected": 24, "found": 18}
                    }
                },
                ...
            },
            "qkrig_exists": true
        }

    Note: `routing_only` only appears under VPU 03W (it's the only VPU it covers).
    Other VPUs have just `cfe_nom` and `lstm_0` in their `by_datastream` dict.
    """
    # Get the date query parameter, defaulting to today if not provided
    date = request.GET.get('date', datetime.now(timezone.utc).strftime('%Y%m%d'))

    try:
        # Get the list of expected output keys for the given date
        expected_keys = _last_run_expected_outputs(date)
        
        # Get the list of existing keys in the bucket for the given date, across all datastreams
        existing_keys = _list_existing_keys_for_date(date)

        # Determine which expected keys are present in the bucket, organized by VPU
        # and broken down per datastream within each VPU.
        vpus = {}
        qkrig_exists = False

        for key in expected_keys:
            # qkrig has no VPU dimension — track it separately
            if key.startswith('outputs/qkrig/'):
                qkrig_exists = key in existing_keys
                continue

            # For non-qkrig keys, extract the VPU and datastream from the key
            vpu = _extract_vpu_from_key(key)
            datastream = _extract_datastream_from_key(key)
            if vpu is None or datastream is None:
                continue  # shouldn't happen for non-qkrig keys, but be defensive

            # Initialize the VPU entry if we haven't seen this VPU before
            if vpu not in vpus:
                vpus[vpu] = {'expected': 0, 'found': 0, 'by_datastream': {}}

            # Initialize the per-datastream entry within this VPU if needed
            if datastream not in vpus[vpu]['by_datastream']:
                vpus[vpu]['by_datastream'][datastream] = {'expected': 0, 'found': 0}

            # Bump both the VPU-level total and the per-datastream count
            exists = key in existing_keys
            vpus[vpu]['expected'] += 1
            vpus[vpu]['by_datastream'][datastream]['expected'] += 1
            
            # Bump found counts if the key was present in S3
            if exists:
                vpus[vpu]['found'] += 1
                vpus[vpu]['by_datastream'][datastream]['found'] += 1

        # Return the structured response with per-VPU counts and qkrig existence
        return JsonResponse({
            'date': date,
            'vpus': vpus,
            'qkrig_exists': qkrig_exists,
        })
    except Exception as e:
        return JsonResponse(
            {'error': str(e), 'error_type': type(e).__name__},
            status=500,
        )


def _extract_vpu_from_key(key: str) -> str:
    """Pull the VPU id out of a key like '.../VPU_03N/...'. Returns None if not found.

    Examples:
        '.../short_range/00/VPU_01/ngen-run.tar.gz' -> '01'
        '.../medium_range/00/1/VPU_03N/ngen-run.tar.gz' -> '03N'
    """
    match = re.search(r'/VPU_([^/]+)/', key)
    return match.group(1) if match else None


def _extract_datastream_from_key(key: str) -> str:
    """Pull the datastream name out of a key. Returns None if not in the expected shape.

    The datastream is always the second path segment (after 'outputs/').

    Examples:
        'outputs/cfe_nom/v2.2_hydrofabric/...'      -> 'cfe_nom'
        'outputs/lstm_0/v2.2_hydrofabric/...'       -> 'lstm_0'
        'outputs/routing_only/v2.2_hydrofabric/...' -> 'routing_only'
    """
    parts = key.split('/', 2)
    if len(parts) >= 2 and parts[0] == 'outputs':
        return parts[1]
    return None


def _list_existing_keys_for_date(date: str) -> set:
    """List every key in the bucket for the given date, across all datastreams.

    Uses one paginated `list_objects_v2` per datastream prefix, parallelized.
    This is much cheaper than HEAD-ing each of the 1,243 expected keys individually.
    
    Args:
        date (str): The date of the run in 'YYYYMMDD' format.

    Returns:
        set: A set of existing S3 keys for the given date.
    """
    # Define the prefixes to search for this date across all datastreams
    prefixes = [
        f'outputs/cfe_nom/v2.2_hydrofabric/ngen.{date}/',
        f'outputs/lstm_0/v2.2_hydrofabric/ngen.{date}/',
        f'outputs/routing_only/v2.2_hydrofabric/ngen.{date}/',
        f'outputs/qkrig/qkrig.{date}/',
    ]

    # Use a thread pool to list keys under each prefix in parallel, then combine results
    all_keys = set()
    with ThreadPoolExecutor(max_workers=len(prefixes)) as executor:
        for keyset in executor.map(_list_keys_with_prefix, prefixes):
            all_keys.update(keyset)
    
    # Return the combined set of all keys found under the prefixes
    return all_keys


def _list_keys_with_prefix(prefix: str) -> set:
    """Return all S3 keys under a given prefix, handling pagination.
    
    Args:
        prefix (str): The S3 prefix to list keys under.

    Returns:
        set: A set of S3 keys under the given prefix.
    """
    # Use a paginator to handle potentially large numbers of keys under this prefix
    keys = set()
    paginator = _get_s3().get_paginator('list_objects_v2')
    
    # Iterate through each page of results and add the keys to the set
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get('Contents', []):
            keys.add(obj['Key'])
    
    # Return the set of keys found under the prefix
    return keys


def _last_run_expected_outputs(date: str, datetime_current: datetime | None = None) -> list[str]:
    """Returns a list of expected output file paths for the last run of the nextgen community model.

    The expected number of entries at the end of the day in the returned list is 1,243, which corresponds to:

    - 504 cfe_nom short range outputs (24 hours * 21 VPUs)
    - 84 cfe_nom medium range outputs (4 hours * 21 VPUs)
    - 21 cfe_nom analysis_assim_extend outputs (1 hour * 21 VPUs)
    - 504 lstm_0 short range outputs (24 hours * 21 VPUs)
    - 84 lstm_0 medium range outputs (4 hours * 21 VPUs)
    - 21 lstm_0 analysis_assim_extend outputs (1 hour * 21 VPUs)
    - 24 routing_only short range outputs (24 hours * 1 VPU)
    - 1 qkrig output (1 file)

    Args:
        date (str): The date to get the expected outputs for in the format 'YYYYMMDD'.
        datetime_current (datetime): The current date and time

    Returns:
        list[str]: A list of output file paths whose existence signals successful completion of the run.
    """
    # The list of expected outputs
    list_output = []

    # Get the current time if it wasn't given
    if datetime_current is None:
        datetime_current = datetime.now(timezone.utc)
    
    # Get the current hour, using 24 if the date is not today (assumes all outputs for past dates are expected to be complete)
    date_is_today = False
    current_hour = 24
    if date == datetime_current.strftime('%Y%m%d'):
        date_is_today = True
        current_hour = datetime_current.hour
    
    # Check whether the given date is in the future
    if datetime.strptime(date, '%Y%m%d').replace(tzinfo=timezone.utc).date() > datetime_current.date():
        # Return empty list as future runs haven't happened yet and we won't have any expected output
        return []
    
    # ---

    # cfe_nom short range
    cfe_nom_short_range_path = 'outputs/cfe_nom/v2.2_hydrofabric/ngen.{date}/short_range/{hour}/VPU_{vpu}/ngen-run.tar.gz'

    for hour in ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']:
        # Don't add output paths that haven't run yet
        if int(hour) > current_hour:
            continue
        
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(cfe_nom_short_range_path.format(date=date, hour=hour, vpu=vpu))

    # cfe_nom medium range
    cfe_nom_medium_range_path = 'outputs/cfe_nom/v2.2_hydrofabric/ngen.{date}/medium_range/{hour}/1/VPU_{vpu}/ngen-run.tar.gz'

    for hour in ['00', '06', '12', '18']:
        # Don't add output paths that haven't run yet
        if int(hour) > current_hour:
            continue
        
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(cfe_nom_medium_range_path.format(date=date, hour=hour, vpu=vpu))

    # cfe_nom analysis_assim_extend
    cfe_nom_analysis_assim_extend_path = 'outputs/cfe_nom/v2.2_hydrofabric/ngen.{date}/analysis_assim_extend/16/VPU_{vpu}/ngen-run.tar.gz'

    if current_hour >= 16:
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(cfe_nom_analysis_assim_extend_path.format(date=date, vpu=vpu))

    # ---

    # lstm_0 short range
    lstm_0_short_range_path = 'outputs/lstm_0/v2.2_hydrofabric/ngen.{date}/short_range/{hour}/VPU_{vpu}/ngen-run.tar.gz'

    for hour in ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']:
        # Don't add output paths that haven't run yet
        if int(hour) > current_hour:
            continue
        
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(lstm_0_short_range_path.format(date=date, hour=hour, vpu=vpu))

    # lstm_0 medium range
    lstm_0_medium_range_path = 'outputs/lstm_0/v2.2_hydrofabric/ngen.{date}/medium_range/{hour}/1/VPU_{vpu}/ngen-run.tar.gz'

    for hour in ['00', '06', '12', '18']:
        # Don't add output paths that haven't run yet
        if int(hour) > current_hour:
            continue
        
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(lstm_0_medium_range_path.format(date=date, hour=hour, vpu=vpu))

    # lstm_0 analysis_assim_extend
    lstm_0_analysis_assim_extend_path = 'outputs/lstm_0/v2.2_hydrofabric/ngen.{date}/analysis_assim_extend/16/VPU_{vpu}/ngen-run.tar.gz'

    if current_hour >= 16:
        for vpu in ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18']:
            list_output.append(lstm_0_analysis_assim_extend_path.format(date=date, vpu=vpu))

    # ---

    # routing_only short range
    routing_only_short_range_path = 'outputs/routing_only/v2.2_hydrofabric/ngen.{date}/short_range/{hour}/VPU_03W/ngen-run.tar.gz'

    for hour in ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']:
        # Don't add output paths that haven't run yet
        if int(hour) > current_hour:
            continue
        
        list_output.append(routing_only_short_range_path.format(date=date, hour=hour))

    # ---

    # qkrig
    qkrig_path = 'outputs/qkrig/qkrig.{date}/qkrig_output_{date}.parquet'

    if not date_is_today or current_hour >= 5:
        list_output.append(qkrig_path.format(date=date))

    # Return the list of expected output file paths
    return list_output
