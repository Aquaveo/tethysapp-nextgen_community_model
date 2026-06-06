import { VisualizationView } from "./visualization_view.js";
import { updateCatchmentColorComprehensive } from "../utils/catchment_styles.js";
import { getVPUName } from "../utils/vpu_names.js";
import { lastRunData } from "../data/last_run_data.mock.js";

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
            { color: '#dc3545', label: 'Failed Run' },
        ];

        // Call the parent constructor with the last run data and the legend
        super(lastRunData, legend);

        // Set the last run time to midnight UTC of the current day for comparison in vpuRunSuccessful
        this.lastRunTime = new Date().setUTCHours(0, 0, 0, 0);
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
        
        // Collect all missing catchments from failed VPUs
        let allMissingCatchments = [];

        // Update VPU and catchment colors based on run status
        for (let vpuId in this.vpuData)
        {
            // Get layer id of current VPU
            let layerId = `vpu-${vpuId}`;

            // Make sure layer for current VPU exists
            if (map.getLayer(layerId))
            {
                // Run was successful for this VPU
                if (this.vpuRunSuccessful(this.vpuData[vpuId]))
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
                }
                // Run was NOT successful for this VPU
                else
                {
                    // Set VPU outline color
                    map.setPaintProperty(layerId, 'line-color', '#d6d6d6ff');
                    map.moveLayer(layerId);
                    
                    // Set VPU fill color
                    let fillLayerId = `vpu-fill-${vpuId}`;
                    if (map.getLayer(fillLayerId))
                    {
                        map.setPaintProperty(fillLayerId, 'fill-opacity', 0.5);
                        map.setPaintProperty(fillLayerId, 'fill-color', '#dc3545'); // Failure red color
                    }
                    
                    // Get the catchments that failed in this VPU
                    if (this.vpuData[vpuId].missingCatchments.length > 0)
                    {
                        // Add missing catchments to the collection
                        allMissingCatchments.push(...this.vpuData[vpuId].missingCatchments);
                    }
                }
            }
        }
        
        // Apply comprehensive catchment styling: red for failed, green for successful
        updateCatchmentColorComprehensive(map, '#00FF00', '#FF0000', allMissingCatchments);

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
        return {};  // Use MapLibre defaults
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
     * @param {Object} vpuData - This view's `this.vpuData[feature.properties.vpuid]`
     *                           entry, pre-resolved so subclasses don't repeat the
     *                           lookup. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     */
    buildVpuPopup(feature, vpuData)
    {
		let html = `<h6><b>VPU ${feature.properties.vpuid}</b></h6>`;
		html += `<p><strong>${getVPUName(feature.properties.vpuid)}</strong></p>`;
		html += `Successful Run: ${this.vpuRunSuccessful(vpuData) ? 'Yes' : 'No'}`;
		html += `<p>Last Run Time: ${new Date(vpuData.runTime).toLocaleString()}</p>`;
		html += `<p>Number of Failed Catchments: ${vpuData.missingCatchments.length}</p>`;
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

        // Determine if this catchment was successful or not based on the parent VPU's missingCatchments list
		let catchmentSuccess = false;
		if (vpuData && vpuData.missingCatchments)
		{
			catchmentSuccess = !vpuData.missingCatchments.includes(catchmentId);
		}

        // Build HTML for the catchment popup
		let html = `<h6><b>Catchment ${catchmentNumber}</b></h6>`;
		html += `<p>Successful Run: ${catchmentSuccess ? 'Yes' : 'No'}</p>`;

        // Return the constructed HTML for the catchment popup
		return html;
    }

    /**
     * Determines if a VPU run was successful based on its data.
     *
     * @param {Object} vpuData - The VPU data object containing runTime and missingCatchments.
     * @returns {boolean} True if the run was successful, false otherwise.
     */
	vpuRunSuccessful(vpuData)
	{
		return (vpuData.runTime === this.lastRunTime && vpuData.missingCatchments.length === 0);
	}
}