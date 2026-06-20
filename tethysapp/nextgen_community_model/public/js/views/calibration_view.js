import { VisualizationView } from "./visualization_view.js";
import { resetCatchmentToOriginalStyles, updateCatchmentColorComprehensive } from "../utils/catchment_styles.js";
import { getVPUName } from "../utils/vpu_names.js";
import { calibrationData } from "../data/calibration_data.mock.js";

/**
 * CalibrationView: A visualization view that colors VPUs and catchments based on their calibration status.
 */
export class CalibrationView extends VisualizationView
{
    /**
     * Create a CalibrationView instance.
     */
    constructor()
    {
        // Define the legend for the Calibration visualization
        const legend = [
            { color: '#1a9850', label: 'Calibrated' },
            { color: '#fee08b', label: 'Partially Calibrated' },
            { color: '#d73027', label: 'Not Calibrated' },
        ];

        // Call the parent constructor with the calibration data and the legend
        super(calibrationData, legend);
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
        // Colors for calibration status
        const calibrationStatusColors = {
            'Not Calibrated': '#d73027',       // Red
            'Partially Calibrated': '#fee08b', // Yellow
            'Calibrated': '#1a9850',           // Green
        };

        // Hide last run time label
        $('#last-run-time-label').addClass('hidden');
        
        // Reset catchment styles
        resetCatchmentToOriginalStyles(map);

        // Keep track of all uncalibrated catchments across VPUs
        let uncalibratedCatchments = [];

        // Color VPUs by calibration status and add crosshatch patterns
        for (const vpuId in this.vpuData.vpus)
        {
            // Get calibration status and corresponding color
            const calibrationStatus = this.calibrationStatus(vpuId);
            const color = calibrationStatusColors[calibrationStatus] || '#d6d6d6ff'; // Default to white if unknown
            
            // Set VPU outline color
            map.setPaintProperty(`vpu-${vpuId}`, 'line-color', '#d6d6d6ff');
            
            // Add crosshatch pattern with the same color to VPU fill
            // const patternId = `crosshatch-vpu-${vpuId}`;
            // addColoredCrosshatchPattern(map, patternId, color);
            
            let fillLayerId = `vpu-fill-${vpuId}`;
            if (map.getLayer(fillLayerId))
            {
                map.setPaintProperty(fillLayerId, 'fill-opacity', 0.4);
                map.setPaintProperty(fillLayerId, 'fill-color', color);
            }

            // Get uncalibrated catchments for this VPU
            uncalibratedCatchments = uncalibratedCatchments.concat(this.vpuData.vpus[vpuId].uncalibratedCatchments);
        }

        // Update catchment colors: Green for calibrated, Red for uncalibrated
        updateCatchmentColorComprehensive(map, '#1a9850', '#d73027', uncalibratedCatchments);

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
     * @param {Object} vpuData - This view's `this.vpuData[feature.properties.vpuid]`
     *                           entry, pre-resolved so subclasses don't repeat the
     *                           lookup. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     */
    buildVpuPopup(feature, vpuData)
    {
        let html = `<h6><b>VPU ${feature.properties.vpuid}</b></h6>`;
        html += `<p><strong>${getVPUName(feature.properties.vpuid)}</strong></p>`;
        html += this.buildCalibrationTable(this.calibrationStatus(feature.properties.vpuid), vpuData);
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

        // Determine calibration status for this catchment based on the parent VPU's uncalibratedCatchments list
		let calibrationStatus = 'Unknown';
		if (vpuData.uncalibratedCatchments)
		{
			calibrationStatus = vpuData.uncalibratedCatchments.includes(catchmentId)
				? 'Not Calibrated'
				: 'Calibrated';
		}

        // Build HTML for the catchment popup
		let html = `<h6><b>Catchment ${catchmentNumber}</b></h6>`;

        // Catchment is calibrated
		if (calibrationStatus === 'Calibrated')
		{
            // Show detailed calibration info for this catchment
			html += this.buildCalibrationTable(calibrationStatus, vpuData);
		}
        // Catchment is uncalibrated
		else
		{
            // Show only the calibration status for uncalibrated catchments
			html += `<p><strong>Calibration Status: ${calibrationStatus}</strong></p>`;
		}

        // Return the constructed HTML for the popup
		return html;
    }

    /**
     * Build the HTML table for displaying calibration information.
     *
     * @param {string} status - The calibration status (e.g., 'Calibrated', 'Not Calibrated').
     * @param {Object} vpuData - The VPU data object containing author and publication information.
     * @returns {string} HTML markup for the calibration info table and download button.
     */
	buildCalibrationTable(status, vpuData)
	{
        // Format publications as a line break-separated list, or show 'None' if there are no publications
		const publications = (vpuData.author.publications && vpuData.author.publications.length > 0)
			? vpuData.author.publications.join('<br>')
			: 'None';

        // Build and return HTML for the calibration info table and download button
		return `
			<table class="performance-table">
				<tr><td>Calibration Status</td> <td>${status}</td></tr>
				<tr><td>Author(s)</td> <td>${vpuData.author.name || 'Unknown'}</td></tr>
				<tr><td>Contact Info</td> <td>${vpuData.author.contactInfo || 'Unknown'}</td></tr>
				<tr><td>Publications</td> <td>${publications}</td></tr>
			</table>

			<button class="download-btn">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
					<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
					<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
				</svg>
				Download Calibration JSON
			</button>
		`;
	}

    /**
     * Get the calibration status for a given VPU.
     *
     * @param {string} vpuId - The ID of the VPU.
     * @returns {string} The calibration status ('Not Calibrated', 'Partially Calibrated', 'Calibrated', or 'Unknown VPU').
     */
	calibrationStatus(vpuId)
	{
		// Get the VPU data
		let vpuData = this.vpuData.vpus[vpuId];
		if (!vpuData) return 'Unknown VPU';

		// Check for no calibration
		if (!vpuData.calibrated)
		{
			return 'Not Calibrated';
		}

		// Check for partial calibration
		if (vpuData.uncalibratedCatchments && vpuData.uncalibratedCatchments.length > 0)
		{
			return 'Partially Calibrated';
		}

		// Fully calibrated
		return 'Calibrated';
	}
}