import { VisualizationView } from "./visualization_view.js";
import { updateCatchmentColorComprehensive, updateCatchmentColorByVpu } from "../utils/catchment_styles.js";
import { getVPUName } from "../utils/vpu_names.js";
import { dateToAppString, dateToApiString } from "../utils/date_utils.js";

/**
 * LastRunView: A visualization view that colors VPUs and catchments based on the success of the last model run.
 */
export class LastRunView extends VisualizationView
{
    /**
     * Create a LastRunView instance.
     */
    constructor()
    {
        // Define the legend for the Last Run visualization
        const legend = [
            { color: '#28a745', label: 'Successful Run' },
            { color: '#FEE08B', label: 'In Progress' },
            { color: '#dc3545', label: 'Failed Run' },
        ];

        // Call the parent constructor with the last run data and the legend
        super(undefined, legend);

        // Set the last run time to midnight UTC of the current day for comparison in vpuRunSuccessful
        this.lastRunTime = new Date().setUTCHours(0, 0, 0, 0);
        this.selectedDate = null;
    }

    /**
     * Run view-specific setup code when this view is selected from the dropdown.
     * 
     * Fetches the last run vpuData from the server if it hasn't been fetched already.
     * 
     * @param {maplibregl.Map} map - The MapLibre map instance.
     */
    async onSelect(map)
    {
        // Get the selected date from the date picker
        const selectedDate = $('#last-run-view-date-picker').val();

        // Failed to get the user's selected date
        if (!selectedDate)
        {
            return;
        }

        // User selected the same date as before
        if (selectedDate === this.selectedDate)
        {
            return;
        }

        // Convert selectedDate to format expected by the API controllers
        const selectedDateObject = new Date(selectedDate);
        const formattedDate = dateToApiString(selectedDateObject);

        // Update the last selected date
        this.selectedDate = selectedDate;
        
        try
        {
            // Fetch last run data from the server
            const response = await fetch(`api/last-run-data?date=${formattedDate}`);
            
            // Check for error
            if (!response.ok)
            {
                throw new Error(`Failed to fetch last run data: ${response.statusText}`);
            }

            // Parse the JSON response
            const data = await response.json();
            console.log('Fetched last run data:', data);

            // Update this view's VPU data
            this.vpuData = data;
        } 
        catch (error)
        {
            console.error('Error fetching last run data:', error);
            this.vpuData = undefined;
        }
    }

    /**
     * Re-paint the map for this view.
     *
     * Called whenever the view becomes active (see `mapSetVisualizationMode`) and
     * again from `map.on('idle')` for views that need re-application after pan/zoom
     * — MapLibre only renders currently-loaded tiles, so newly-streamed tiles need
     * a fresh styling pass.
     *
     * Typical implementation steps:
     *   - Iterate `this.vpuData` and update `fill-color` / `line-color` on each
     *     `vpu-fill-{id}` and `vpu-{id}` layer via `map.setPaintProperty()`.
     *   - Re-color catchments using helpers like `updateCatchmentColorComprehensive()`.
     *   - Re-order text labels with `map.moveLayer('vpu-labels')` so they stay on top.
     *
     * @param {maplibregl.Map} map - The MapLibre map instance to paint.
     * @returns {void}
     */
    updateMap(map)
    {
        // Show last run time label
        $('#last-run-time-label').removeClass('hidden');

        // Show the date picker
        $('#last-run-view-date-picker-wrapper').removeClass('hidden');

        // Arrays to keep track of successful and failed VPUs (for catchment styling)
        let vpusSuccessful = [];
        let vpusFailed = [];

        // Get the current date in the format expected by the app
        const today = dateToAppString(new Date());

        // Update VPU and catchment colors based on run status
        if (this.vpuData['vpus'] !== undefined)
        {
            for (let vpuId in this.vpuData['vpus'])
            {
                // Get the data for the current VPU
                const vpuData = this.vpuData['vpus'][vpuId];

                // Get layer id of current VPU
                let layerId = `vpu-${vpuId}`;

                // Make sure layer for current VPU exists
                if (map.getLayer(layerId))
                {
                    // Run was successful for this VPU
                    if (this.vpuRunSuccessful(vpuData))
                    {
                        // Set VPU outline color
                        map.setPaintProperty(layerId, 'line-color', '#d6d6d6ff');
                        
                        // Set VPU fill color
                        let fillLayerId = `vpu-fill-${vpuId}`;
                        if (map.getLayer(fillLayerId))
                        {
                            // Add solid fill to the corresponding fill layer
                            map.setPaintProperty(fillLayerId, 'fill-opacity', 0.5);
                            map.setPaintProperty(fillLayerId, 'fill-color', '#28a745'); // Success green color
                        }

                        // Keep track that this VPU was successful (for catchment styling)
                        vpusSuccessful.push(vpuId);
                    }
                    // Run was NOT successful for this VPU
                    else
                    {
                        // Set VPU outline color
                        map.setPaintProperty(layerId, 'line-color', '#d6d6d6ff');
                        map.moveLayer(layerId);
                        
                        // Set VPU fill color
                        let fillLayerId = `vpu-fill-${vpuId}`;
                        const fillColor = this.selectedDate == today ? '#fee08b' : '#dc3545';   // In-Progress: Yellow, Failure: Red
                        if (map.getLayer(fillLayerId))
                        {
                            map.setPaintProperty(fillLayerId, 'fill-opacity', 0.5);
                            map.setPaintProperty(fillLayerId, 'fill-color', fillColor);
                        }

                        // Keep track that this VPU failed (for catchment styling)
                        vpusFailed.push(vpuId);
                    }
                }
            }
        }
        
        // Apply catchment styling based on VPU success/failure
        const fillColor = this.selectedDate == today ? '#8D8458' : '#dc3545';   // In-Progress: Yellow, Failure: Red
        updateCatchmentColorByVpu(map, vpusSuccessful, '#28a745');
        updateCatchmentColorByVpu(map, vpusFailed, fillColor);

        // Move text labels above all other layers
        if (map.getLayer('vpu-labels'))
        {
            map.moveLayer('vpu-labels');
        }
    }

    /**
     * Options object passed to the MapLibre popup constructor for this view.
     *
     * The return value is forwarded verbatim to `new maplibregl.Popup(options)`
     * inside `updateOnClick`. Return `{}` for MapLibre defaults, or override
     * fields like `maxWidth` and `className` to widen the popup or hook in
     * custom CSS for table layouts.
     *
     * @returns {Object} A MapLibre `PopupOptions` object.
     */
    getPopupOptions()
    {
		return {
			maxWidth: 'none',
			className: 'custom-popup'
		};
    }

    /**
     * Build the HTML body shown in the popup when a VPU fill is clicked.
     *
     * Invoked by the base-class `updateOnClick` after it has identified the
     * clicked feature and pre-resolved the matching `vpuData` entry. The returned
     * string is passed directly to `maplibregl.Popup.setHTML()`, so it must be a
     * self-contained markup snippet (no `<html>` / `<body>` wrappers).
     *
     * @param {Object} feature - MapLibre rendered feature from `queryRenderedFeatures`.
     *                           `feature.properties.vpuid` holds the VPU identifier
     *                           (e.g. `'01'`, `'03N'`).
     * @param {Object} vpuData - This view's `this.vpuData.vpus[feature.properties.vpuid]`
     *                           entry, pre-resolved so subclasses don't repeat the
     *                           lookup. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     */
    buildVpuPopup(feature, vpuData)
    {
        // Determine if USGS Kriging was successful or not
        const qkrigExists = this?.vpuData?.qkrig_exists;

        // Build the HTML for the popup
        let html = `<h6><b>VPU ${feature.properties.vpuid}</b></h6>`;
        html += `<p><strong>${getVPUName(feature.properties.vpuid)}</strong></p>`;
        html += this.buildRunStatusTable(vpuData, qkrigExists);

        // Return the constructed HTML for the VPU popup
        return html;
    }

    /**
     * Build the HTML body shown in the popup when a catchment polygon is clicked.
     *
     * Same contract as `buildVpuPopup`, but invoked for catchment clicks. The
     * feature's `properties.divide_id` is of the form `'cat-12345'` and identifies
     * the specific catchment; `vpuData` is the *parent VPU's* record — catchments
     * are looked up indirectly via their containing VPU's id, not by `divide_id`.
     *
     * @param {Object} feature - MapLibre rendered feature from `queryRenderedFeatures`.
     *                           `feature.properties.divide_id` holds the catchment id
     *                           (e.g. `'cat-4634'`); `feature.properties.vpuid` holds
     *                           the parent VPU id used to resolve `vpuData`.
     * @param {Object} vpuData - The parent VPU's record from `this.vpuData`,
     *                           pre-resolved. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     */
    buildCatchmentPopup(feature, vpuData)
    {
        // Extract catchment number from divide_id (e.g. 'cat-4634' -> '4634')
		const catchmentId = feature.properties.divide_id || 'Unknown';
		const catchmentNumber = catchmentId.replace('cat-', '');

        // Return the VPU popup for the catchment
        return this.buildVpuPopup(feature, vpuData);
    }

    /**
     * Helper method to build an HTML table summarizing run status for a given VPU/Catchment.
     *
     * @param {Object} vpuData - The VPU data record containing performance metrics.
     * @param {bool} qkrigExists - Indicates if USGS Kriging data is available.
     * @returns {string} HTML markup for the performance metrics table.
     */
	buildRunStatusTable(vpuData, qkrigExists)
	{
        // Add HTML table opening
		let html = `
			<table class="performance-table">
		`;

        // Add basic run status rows
        html += `   <tr><td>Successful Run</td> <td>${this.vpuRunSuccessful(vpuData) ? 'Yes' : 'No'}</td></tr>`;
        html += `   <tr><td>Run Summary</td> <td>${vpuData.found} / ${vpuData.expected}</td></tr>`;

        // Add CFE + NOAH-OWP (if available)
        if (vpuData?.by_datastream?.cfe_nom)
        {
            html += `   <tr><td>CFE + NOAH-OWP</td><td>${vpuData.by_datastream.cfe_nom.found} / ${vpuData.by_datastream.cfe_nom.expected}</td></tr>`;
        }

        // Add LSTM (if available)
        if (vpuData?.by_datastream?.lstm_0)
        {
            html += `   <tr><td>LSTM</td><td>${vpuData.by_datastream.lstm_0.found} / ${vpuData.by_datastream.lstm_0.expected}</td></tr>`;
        }

        // Add Routing-Only (if available)
        if (vpuData?.by_datastream?.routing_only)
        {
            html += `   <tr><td>Routing-Only</td><td>${vpuData.by_datastream.routing_only.found} / ${vpuData.by_datastream.routing_only.expected}</td></tr>`;
        }

        // Add USGS Kriging
        if (qkrigExists)
        {
            html += `   <tr><td>USGS Kriging</td><td>Available</td></tr>`;
        }
        else
        {
            html += `   <tr><td>USGS Kriging</td><td>Not Available</td></tr>`;
        }

        // Close the HTML table
        html += `</table>`;

        // Return the constructed HTML table
		return html;
	}

    /**
     * Unload the visualization view, cleaning up any resources or event listeners.
     * 
     * Child classes should override this method to perform any necessary cleanup.
     *
     * @param {maplibregl.Map} map - The MapLibre map instance
     */
    unload(map)
    {
        // Hide last run time label
        $('#last-run-time-label').addClass('hidden');

        // Hide the date picker
        $('#last-run-view-date-picker-wrapper').addClass('hidden');
    }

    /**
     * Determines if a VPU run was successful based on its data.
     *
     * @param {Object} vpuData - The VPU data object containing runTime and missingCatchments.
     * @returns {boolean} True if the run was successful, false otherwise.
     */
	vpuRunSuccessful(vpuData)
	{
		return (vpuData.expected === vpuData.found);
	}
}