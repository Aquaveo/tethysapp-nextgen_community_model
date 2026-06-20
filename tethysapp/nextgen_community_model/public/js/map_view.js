// import { Protocol } from "pmtiles"

import { LastRunView } from "./views/last_run_view.js";
import { CalibrationView } from "./views/calibration_view.js";
import { PerformanceView } from "./views/performance_view.js";
import { saveInitialCatchmentStyles } from "./utils/catchment_styles.js";
import { addCrosshatchPatterns, addColoredCrosshatchPattern } from "./utils/patterns.js";
import { getVPUName } from "./utils/vpu_names.js";
import { addVpuOutlines, addVpuTextLabels } from "./utils/vpu_layers.js";

const vpuIds = ['01', '02', '03N', '03S', '03W', '04', '05', '06', '07', '08', '09', '10L', '10U', '11', '12', '13', '14', '15', '16', '17', '18'];

const vpuColors = [
	'#e41a1c', 
	'#377eb8', 
	'#4daf4a', 
	'#984ea3', 
	'#ff7f00', 
	'#ffff33', 
	'#a65628', 
	'#f781bf', 
	'#999999', 
	'#1f78b4', 
	'#33a02c', 
	'#fb9a99', 
	'#e31a1c', 
	'#fdbf6f', 
	'#ff9900', 
	'#6a3d9a', 
	'#cab2d6', 
	'#cab2d6', 
	'#b668ddff',
	'#2ca02c',
	'#d62728',
	'#17becf',
	'#bcbd22',
];

// Create objects for each visualization view, keyed by their display names
let visualizationViews = {};
visualizationViews['Last Run'] = new LastRunView();
visualizationViews['Calibration'] = new CalibrationView();
visualizationViews['Performance'] = new PerformanceView();

let visualizationViewCurrent = 'Last Run';

/**
 * Handle missing style images by recreating them
 * @param {object} map - The maplibre map object
 */
function handleStyleImageMissing(map)
{
	map.on('styleimagemissing', function(e) {
		if (e.id === 'crosshatch-success' || e.id === 'crosshatch-fail')
		{
			const successPattern = e.id === 'crosshatch-success';
			const failPattern = e.id === 'crosshatch-fail';
			addCrosshatchPatterns(map, successPattern, failPattern);
		}
		else
		if (e.id.startsWith('crosshatch-vpu-'))
		{
			// Handle dynamic VPU crosshatch patterns
			const vpuId = e.id.replace('crosshatch-vpu-', '');
			const performanceView = visualizationViews['Performance'];
			if (performanceView && performanceView.vpuData[vpuId])
			{
				const rSquared = performanceView.vpuData[vpuId].coeffDeterm;
				const color = d3.interpolateViridis(rSquared);
				addColoredCrosshatchPattern(map, e.id, color);
			}
		}
	});
}

/** Sets the map visualization mode by applying the corresponding view's update functions
 * @param {object} map - The maplibre map object
 * @param {string} mode - The visualization mode to set (e.g., 'Last Run', 'Performance', etc.)
 */
async function mapSetVisualizationMode(map, mode)
{
	if (visualizationViews[mode])
	{
		try
		{
			// Show loading wheel
			$('#loading-wheel').removeClass('hidden');

			// Remove all event listeners of type 'click'
			const oldHandler = map._listeners?.click;
			if (oldHandler)
			{
				delete map._listeners.click;
			}
			
			// Standard removal as backup
			map.off('click');

			// Unload the current visualization
			if (visualizationViews[visualizationViewCurrent])
			{
				visualizationViews[visualizationViewCurrent].unload(map);
			}
			
			// Apply the new visualization
			await visualizationViews[mode].onSelect(map);
			visualizationViews[mode].updateMap(map);
			visualizationViews[mode].updateOnClick(map);
			
			// Update legend for the current mode
			visualizationViews[mode].updateLegend();

			// Keep track of the current visualization mode
			visualizationViewCurrent = mode;
		}
		finally
		{
			// Hide loading wheel
			$('#loading-wheel').addClass('hidden');
		}
	}
}

$(function() {
	// Set the last run time text (set to current date for now)
	$('#last-run-time-label').text(`Last Run: ${new Date().toLocaleString()}`);

    // Update map when visualization mode changes
    $('input[name="visualization-mode"]').on('change', async function() {
        const currentIndex = $('input[name="visualization-mode"]').index(this);
        const selectedLabel = $(this).next('label');

        console.log(currentIndex, selectedLabel.text());
	
        // Update map based on selected visualization mode
        if (visualizationViews[selectedLabel.text()])
		{
            await mapSetVisualizationMode(map, selectedLabel.text());
        }
    });

    // Register the PMTiles protocol with maplibre
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // Initialize the maplibre map
    const map = new maplibregl.Map({
		container: 'map',
    	// style: 'https://demotiles.maplibre.org/style.json',
		style: 'https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/styles/dark-style.json',
		center: [-100.04, 38.907],
		zoom: 3
    });

    // Wait for the map to load before adding layers
    map.on('load', async function() {
        // Add handler for missing style images
        handleStyleImageMissing(map);
        
        // Add source data loading handler - optimized for performance
        let lastStyleApplication = 0;
        
        map.on('sourcedata', function(e) {
            // Only handle the correct source and avoid excessive re-styling
            if (e.sourceId === 'hydrofabric' && e.isSourceLoaded) {
                // Save initial styles once when source loads
                setTimeout(() => {
                    // saveInitialCatchmentStyles(map);
                }, 100);
            }
        });
        
        // Re-apply styles after map movement stops
		// Needed because styling only works with loaded layers
        map.on('idle', function() {
            const now = Date.now();
            // Throttle to max once per second
            if (now - lastStyleApplication > 1000)
			{
                const currentMode = $('input[name="visualization-mode"]:checked').next('label').text();
                if (visualizationViews[currentMode])
				{
                    console.log('Re-applying styles after map idle');
                    visualizationViews[currentMode].updateMap(map);
                    lastStyleApplication = now;
                }
            }
        });
        
        // Save initial catchment layer styles
        saveInitialCatchmentStyles(map);
        
        // Remove layers we do not want
        const layersToRemove = ['flowpaths', 'vpu'];
        layersToRemove.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        });

		// Add VPU Outline layers
		addVpuOutlines(map, vpuIds, vpuColors);

		// Add VPU text labels
		addVpuTextLabels(map);
		
		// Add divide_id styling
		// addDivideIdStyling(map);
		
		// Add crosshatch pattern for failed runs (with a small delay to ensure style is loaded)
		setTimeout(() => {
			addCrosshatchPatterns(map);
		}, 100);

		// Set cursor to pointer when hovering over VPUs and Catchments
		map.on('mousemove', (e) => {
			const features = map.queryRenderedFeatures(e.point);
			const overInteractive = features.some(f =>
				f.layer.id.startsWith('vpu-fill-') ||
				f.layer.id.startsWith('catchments')
			);
			map.getCanvas().style.cursor = overInteractive ? 'pointer' : '';
		});

		// Reset cursor when leaving the map entirely
		map.getCanvas().addEventListener('mouseleave', () => {
			map.getCanvas().style.cursor = '';
		});

		// Initialize map by setting view to "Last Run"
		await mapSetVisualizationMode(map, 'Last Run');
    });

	// Add event listener for last run view date picker
	$('#last-run-view-date-picker-wrapper input[type="text"]').on('change', async function() {
		if (visualizationViewCurrent !== 'Last Run') return;

		try
		{
			$('#loading-wheel').removeClass('hidden');
			await visualizationViews['Last Run'].onSelect(map);
			visualizationViews['Last Run'].updateMap(map);
		}
		finally
		{
			$('#loading-wheel').addClass('hidden');
		}
	});
});
