import { VisualizationView } from "./visualization_view.js";
import { resetCatchmentToOriginalStyles, updateCatchmentColorRandom } from "../utils/catchment_styles.js";
import { getVPUName } from "../utils/vpu_names.js";
import { performanceData } from "../data/performance_data.mock.js";

export class PerformanceView extends VisualizationView
{
    /**
     * Create a PerformanceView instance.
     */
    constructor()
    {
        // Define the legend for the Performance visualization
        const legend = [
            { color: '#67001f', label: 'Poor Performance (0.0-0.2)' },
            { color: '#d6604d', label: 'Below Average (0.2-0.4)' },
            { color: '#f7f7f7', label: 'Average (0.4-0.6)' },
            { color: '#4393c3', label: 'Good (0.6-0.8)' },
            { color: '#053061', label: 'Excellent (0.8-1.0)' }
        ];

        // Call the parent constructor with the last run data and the legend
        super(performanceData, legend);
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
        // Hide last run time label
        $('#last-run-time-label').addClass('hidden');
        
        // Reset catchment styles
        resetCatchmentToOriginalStyles(map);

        // Get color scale
        const colorScale = this.getScaleDiverging();

        // Color VPUs by R² value and add crosshatch patterns
        for (const vpuId in this.vpuData)
        {
            // Get rSquared value and corresponding color
            const rSquared = this.vpuData[vpuId].coeffDeterm;
            const color = colorScale(rSquared);
            
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
        }

        // Set catchment colors to random colors
        updateCatchmentColorRandom(map, colorScale);

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
        html += this.buildPerformanceTable(vpuData);
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

        // Build HTML for catchment popup, including a performance table based on the parent VPU's data
		let html = `<h6><b>Catchment ${catchmentNumber}</b></h6>`;
		html += this.buildPerformanceTable(vpuData);

        // Return the constructed HTML for the catchment popup
		return html;
    }

    /**
     * Helper method to build an HTML table summarizing performance metrics for a given VPU.
     *
     * @param {Object} vpuData - The VPU data record containing performance metrics.
     * @returns {string} HTML markup for the performance metrics table.
     */
	buildPerformanceTable(vpuData)
	{
        // Build and return an HTML table summarizing performance metrics for this VPU
		return `
			<table class="performance-table">
				<tr><td>Coefficient of Determination</td> <td>${vpuData.coeffDeterm}</td></tr>
				<tr><td>Root Mean Square Error</td> <td>${vpuData.rootMeanSquareError}</td></tr>
				<tr><td>Mean Absolute Error</td> <td>${vpuData.meanAbsoluteError}</td></tr>
				<tr><td>Normalized Nash-Sutcliffe Efficiency</td> <td>${vpuData.normalizedNashSutcliffeEfficiency}</td></tr>
				<tr><td>Relative Bias</td> <td>${vpuData.relativeBias}</td></tr>
			</table>
		`;
	}

    /**
     * Returns a diverging scale based on the input value.
     * @returns {function} D3 diverging scale function
     * @example
     * // Create a diverging scale
     * const divergingScale = getDivergingScale();
     * // Get color for a value of 0.75
     * const color = divergingScale(0.75);
     * console.log(color); // Outputs a color string
     */
    getScaleDiverging()
    {
        return d3.scaleDiverging([0, 0.5, 1], d3.interpolateRdBu);
    }
}