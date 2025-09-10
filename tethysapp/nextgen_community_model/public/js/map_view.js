// import { Protocol } from "pmtiles"

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

let visualizationViews = {};

// Store initial catchment layer styles
let initialCatchmentStyles = {};

visualizationViews['Last Run'] = {
	vpuRunSuccessful: function(vpuData)
	{
		return (vpuData.runTime == this.lastRunTime && vpuData.missingCatchments.length === 0);
	},
	updateMap: function(map)
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
					map.setPaintProperty(layerId, 'line-color', '#00FF00'); // Green for success
					
					// Add crosshatch pattern to VPU
					let fillLayerId = `vpu-fill-${vpuId}`;
					if (map.getLayer(fillLayerId))
					{
						// Add crosshatch pattern to the corresponding fill layer
						map.setPaintProperty(fillLayerId, 'fill-opacity', 0.5);
						map.setPaintProperty(fillLayerId, 'fill-pattern', 'crosshatch-success');
					}
				}
				// Run was NOT successful for this VPU
				else
				{
					// Set VPU outline color
					map.setPaintProperty(layerId, 'line-color', '#FF0000'); // Red for failure
					map.moveLayer(layerId);
					
					// Add crosshatch pattern to VPU
					let fillLayerId = `vpu-fill-${vpuId}`;
					if (map.getLayer(fillLayerId))
					{
						map.setPaintProperty(fillLayerId, 'fill-opacity', 0.5);
						map.setPaintProperty(fillLayerId, 'fill-pattern', 'crosshatch-fail');
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
	},
	updateOnClick: function(map)
	{
		// Create a reference to this object (the "Last Run" view) for use in the click handler
        const self = this;

		// Update the map click handler
        map.on('click', function(e) {
            // Query all features at click point
            const allFeatures = map.queryRenderedFeatures(e.point);
            
            if (allFeatures.length > 0)
			{
                console.log('All features at click point:', allFeatures);
                
                // Organize features by type
                const vpuFills = allFeatures.filter(f => f.layer.id.startsWith('vpu-fill-'));
				const catchmentFeatures = allFeatures.filter(f => f.layer.id.startsWith('catchments'));
                
                console.log('VPU fills (clicked inside):', vpuFills);
                console.log('Catchment features:', catchmentFeatures);
                
				let selectedFeature = null;
				let featureType = 'unknown';

				if (vpuFills.length > 0)
				{
					selectedFeature = vpuFills[0];
					featureType = 'vpu';
				} 
				else
				if (catchmentFeatures.length > 0)
				{
					selectedFeature = catchmentFeatures[0];
					featureType = 'catchment';
				}

                // Show info about the top feature
                const topFeature = allFeatures[0];
                console.log(`Top layer: ${topFeature.layer.id}`);
                console.log('Feature properties:', topFeature.properties);
                
                // Create popup content based on feature type
                let popupContent = `<h6>${e.lngLat}</h6>`;

				//
				let vpuData = self.vpuData[selectedFeature.properties.vpuid];
				
				if (featureType === 'vpu')
				{
					popupContent = `<h6><b>VPU ${selectedFeature.properties.vpuid}</b></h6>`;
					popupContent += `<p><strong>${getVPUName(selectedFeature.properties.vpuid)}</strong></p>`;
					popupContent += `Successful Run: ${self.vpuRunSuccessful(vpuData) ? 'Yes' : 'No'}`;
					popupContent += `<p>Last Run Time: ${new Date(vpuData.runTime).toLocaleString()}</p>`;
					popupContent += `<p>Number of Failed Catchments: ${vpuData.missingCatchments.length}</p>`;

				}
				else
				if (featureType === 'catchment')
				{
					let catchmentId = selectedFeature.properties.divide_id || 'Unknown';

					let catchmentNumber = catchmentId.replace('cat-', '');

					let catchmentSuccess = false;

					if (vpuData && vpuData.missingCatchments)
					{
						catchmentSuccess = !vpuData.missingCatchments.includes(catchmentId);
					}

					popupContent = `<h6><b>Catchment ${catchmentNumber}</b></h6>`;
					popupContent += `<p>Successful Run: ${catchmentSuccess ? 'Yes' : 'No'}</p>`;
				}
                
                // Show popup
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
            }
        });
	},
	lastRunTime: new Date().setUTCHours(0, 0, 0, 0),
	vpuData: {
		'01': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: ['cat-4634', 'cat-20021', 'cat-20017', 'cat-1187', 'cat-1191', 'cat-1192', 'cat-20018', 'cat-20016', 'cat-1186', 'cat-1123']
		},
		'02': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'03N': {
			runTime: new Date().setUTCHours(0, 0, 0, 0) - (24 * 60 * 60 * 1000),
			missingCatchments: []
		},
		'03S': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		}, 
		'03W': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'04': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'05': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'06': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'07': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'08': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'09': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'10L': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'10U': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'11': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'12': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'13': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'14': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'15': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'16': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'17': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		},
		'18': {
			runTime: new Date().setUTCHours(0, 0, 0, 0),
			missingCatchments: []
		}
	},
};

visualizationViews['Calibration'] = {
	updateMap: function(map)
	{
		// Hide last run time label
		$('#last-run-time-label').addClass('hidden');

		resetCatchmentColors(map);
		// resetCatchmentToOriginalStyles(map);
	},
	updateOnClick: function(map)
	{
        map.on('click', function(e) {
            // Query all features at click point
            const allFeatures = map.queryRenderedFeatures(e.point);
            
            if (allFeatures.length > 0)
			{
                console.log('All features at click point:', allFeatures);
                
                // Organize features by type
                const vpuFills = allFeatures.filter(f => f.layer.id.startsWith('vpu-fill-'));
                const vpuBoundaries = allFeatures.filter(f => f.layer.id.startsWith('vpu-') && f.layer.type === 'line');
                const otherFeatures = allFeatures.filter(f => 
                    !f.layer.id.startsWith('vpu-') && f.layer.id !== 'vpu-labels'
                );
                
                console.log('VPU fills (clicked inside):', vpuFills);
                console.log('VPU boundaries:', vpuBoundaries);
                console.log('Other features:', otherFeatures);
                
                // Show info about the top feature
                const topFeature = allFeatures[0];
                console.log(`Top layer: ${topFeature.layer.id}`);
                console.log('Feature properties:', topFeature.properties);
                
                // Create popup content based on feature type
                let popupContent = `<h6>${e.lngLat}</h6>`;
                
                if (vpuFills.length > 0)
				{
                    const fill = vpuFills[0];
                    const vpuId = fill.properties.vpuid;
                    const vpuName = getVPUName(vpuId);

					map.setPaintProperty(`vpu-${vpuId}`, 'line-color', '#eeff00ff');
					map.moveLayer(`vpu-${vpuId}`);

                    popupContent += `<h3>Inside VPU ${vpuId}</h3>`;
                    popupContent += `<p><strong>${vpuName}</strong></p>`;
                    popupContent += `<p><em>Clicked inside polygon area</em></p>`;
                }
				else
				if (vpuBoundaries.length > 0)
				{
                    const boundary = vpuBoundaries[0];
                    popupContent += `<h3>${boundary.layer.id}</h3>`;
                    popupContent += `<pre>${JSON.stringify(boundary.properties, null, 2)}</pre>`;
                }
				else
				{
                    popupContent += `<h3>${topFeature.layer.id}</h3>`;
                    popupContent += `<pre>${JSON.stringify(topFeature.properties, null, 2)}</pre>`;
                }
                
                // Show popup
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
            }
        });
	},
};

visualizationViews['Performance'] = {
	updateMap: function(map)
	{
		// Hide last run time label
		$('#last-run-time-label').addClass('hidden');

		resetCatchmentToOriginalStyles(map);
	},
	updateOnClick: function(map)
	{
        map.on('click', function(e) {
            // Query all features at click point
            const allFeatures = map.queryRenderedFeatures(e.point);
            
            if (allFeatures.length > 0)
			{
                console.log('All features at click point:', allFeatures);
                
                // Organize features by type
                const vpuFills = allFeatures.filter(f => f.layer.id.startsWith('vpu-fill-'));
                const vpuBoundaries = allFeatures.filter(f => f.layer.id.startsWith('vpu-') && f.layer.type === 'line');
                const otherFeatures = allFeatures.filter(f => 
                    !f.layer.id.startsWith('vpu-') && f.layer.id !== 'vpu-labels'
                );
                
                console.log('VPU fills (clicked inside):', vpuFills);
                console.log('VPU boundaries:', vpuBoundaries);
                console.log('Other features:', otherFeatures);
                
                // Show info about the top feature
                const topFeature = allFeatures[0];
                console.log(`Top layer: ${topFeature.layer.id}`);
                console.log('Feature properties:', topFeature.properties);
                
                // Create popup content based on feature type
                let popupContent = `<h6>${e.lngLat}</h6>`;
                
                if (vpuFills.length > 0)
				{
                    const fill = vpuFills[0];
                    const vpuId = fill.properties.vpuid;
                    const vpuName = getVPUName(vpuId);

					map.setPaintProperty(`vpu-${vpuId}`, 'line-color', '#eeff00ff');
					map.moveLayer(`vpu-${vpuId}`);

                    popupContent += `<h3>Inside VPU ${vpuId}</h3>`;
                    popupContent += `<p><strong>${vpuName}</strong></p>`;
                    popupContent += `<p><em>Clicked inside polygon area</em></p>`;
                }
				else
				if (vpuBoundaries.length > 0)
				{
                    const boundary = vpuBoundaries[0];
                    popupContent += `<h3>${boundary.layer.id}</h3>`;
                    popupContent += `<pre>${JSON.stringify(boundary.properties, null, 2)}</pre>`;
                }
				else
				{
                    popupContent += `<h3>${topFeature.layer.id}</h3>`;
                    popupContent += `<pre>${JSON.stringify(topFeature.properties, null, 2)}</pre>`;
                }
                
                // Show popup
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
            }
        });
	},
}

/** Helper function to get the name of a VPU given its ID.
 * @param {string} vpuId - The ID of the VPU.
 * @returns {string} - The name of the VPU or 'Unknown' if not found.
 * @example
 * // Get the name of VPU '03N'
 * const name = getVPUName('03N');
 * console.log(name); // Outputs: South Atlantic-North
 */
function getVPUName(vpuId)
{
    const vpuNames = {
        '01': 'New England',
        '02': 'Mid-Atlantic',
        '03N': 'South Atlantic-North',
        '03S': 'South Atlantic-South', 
        '03W': 'South Atlantic-West',
        '04': 'Great Lakes',
        '05': 'Ohio',
        '06': 'Tennessee',
        '07': 'Upper Mississippi',
        '08': 'Lower Mississippi',
        '09': 'Souris-Red-Rainy',
        '10L': 'Missouri-Lower',
        '10U': 'Missouri-Upper',
        '11': 'Arkansas-White-Red',
        '12': 'Texas-Gulf',
        '13': 'Rio Grande',
        '14': 'Upper Colorado',
        '15': 'Lower Colorado',
        '16': 'Great Basin',
        '17': 'Pacific Northwest',
        '18': 'California'
    };

    return vpuNames[vpuId] || 'Unknown';
}

/**
 * Adds the VPU outline layers to the given map for the given vpu ids.
 * 
 * @param {object} map - The maplibre map object to add layers to.
 * @param {Array<string>} vpuIds - The list of VPU IDs to add outlines for.	 ex: ['01', '02', '03N', ...]
 * @param {Array<string>} vpuColors - The list of colors corresponding to each VPU ID. ex: ['#e41a1c', '#377eb8', ...]
 * @returns {void}
 * @example
 * // Add outlines for all VPUs to the map
 * addVpuOutlines(map, ['01', '02', '03N'], ['#e41a1c', '#377eb8', '#4daf4a']);
 */
function addVpuOutlines(map, vpuIds, vpuColors)
{
	// Add outlines for each VPU
	for(let i = 0;i < vpuIds.length;i++)
	{
		// Get vpu number and color
		let vpuId = vpuIds[i];
		let color = vpuColors[i];

		// Add invisible filled layer for click detection
		map.addLayer({
			id: `vpu-fill-${vpuId}`,
			type: 'fill',
			source: 'conus_vpu',
			'source-layer': 'vpu',
			filter: ['==', 'vpuid', vpuId],
			paint: {
				'fill-opacity': 0,
				'fill-color': color
			},
			minzoom: 0,
			maxzoom: 24
		});

		// Add visible outline layer
		map.addLayer({
			id: `vpu-${vpuId}`,
			type: 'line',
			source: 'conus_vpu',
			'source-layer': 'vpu',
			filter: ['==', 'vpuid', vpuId],
			paint: {
				'line-width': 2,
				'line-color': color
			},
			minzoom: 0,
			maxzoom: 24
		});
	}
}

/**
 * Adds the VPU text labels to the given map.
 * 
 * @param {object} map - The maplibre map object to add layers to.
 * @example
 * // Add VPU text labels to the map
 * addVpuTextLabels(map);
 */
function addVpuTextLabels(map)
{
	// Add labels source
	map.addSource('vpu-labels', {
		type: 'geojson',
		data: '/static/nextgen_community_model/vpu_labels/vpu_labels.geojson'
	});

	// Add labels
	map.addLayer({
		id: 'vpu-labels',
		type: 'symbol',
		source: 'vpu-labels',
		layout: {
			'text-field': [
				'concat',
				['get', 'description'],
				'\n',
				['get', 'title']
			],
			'text-font': ['Noto Sans Regular'],
			'text-size': 14,
			'text-anchor': 'center',
			'text-justify': 'center',
			'text-offset': [0, 0],
			'text-allow-overlap': true,
			'text-ignore-placement': false,
			'symbol-placement': 'point'
		},
		paint: {
			'text-color': '#ffffff',
			'text-halo-color': '#000000',
			'text-halo-width': 2
		},
		minzoom: 0,
		maxzoom: 24
	});
}

/**
 * Captures the initial styles of catchment layers for later restoration
 * @param {object} map - The maplibre map object
 */
function saveInitialCatchmentStyles(map)
{
	// Get all layers in the map style
	const layers = map.getStyle().layers;
	
	// Iterate through layers to find catchment layers
	layers.forEach(layer => {
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{	
			// Save the initial paint properties
			initialCatchmentStyles[layer.id] = {
				type: layer.type,
				paint: {}
			};
			
			if (layer.type === 'line')
			{
				// Get current paint properties or use defaults
				initialCatchmentStyles[layer.id].paint = {
					'line-color': map.getPaintProperty(layer.id, 'line-color') || layer.paint?.['line-color'] || '#000000',
					'line-width': map.getPaintProperty(layer.id, 'line-width') || layer.paint?.['line-width'] || 1,
					'line-opacity': map.getPaintProperty(layer.id, 'line-opacity') || layer.paint?.['line-opacity'] || 1
				};
			} 
			else
			if (layer.type === 'fill')
			{
				initialCatchmentStyles[layer.id].paint = {
					'fill-color': map.getPaintProperty(layer.id, 'fill-color') || layer.paint?.['fill-color'] || '#000000',
					'fill-opacity': map.getPaintProperty(layer.id, 'fill-opacity') || layer.paint?.['fill-opacity'] || 1
				};
			}
		}
	});
}

/**
 * Updates styling for existing divide_id layers using filters and paint properties
 * @param {object} map - The maplibre map object
 * @param {string} highlightColor - Color to highlight specific divide_id features
 * @param {Array<string>} specificDivideIds - Array of specific divide_id values to highlight
 */
function updateCatchmentColor(map, highlightColor = '#00FF00', specificDivideIds = [])
{	
	// Find all layers that use the hydrofabric source and conus_divides source-layer
	const layers = map.getStyle().layers;
	
	layers.forEach(layer => {
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{	
			// Get the initial style for this layer
			const initialStyle = initialCatchmentStyles[layer.id];
			if (!initialStyle)
			{
				console.warn(`No initial style saved for layer: ${layer.id}`);
				console.log(`Available initial styles:`, Object.keys(initialCatchmentStyles));
				return;
			}
			
			if (specificDivideIds.length > 0)
			{	
				// Use paint expressions to conditionally style ONLY the specified features
				// Unspecified catchments remain untouched with their original styling
				if (layer.type === 'line')
				{
					const colorExpression = [
						'case',
						['in', ['get', 'divide_id'], ['literal', specificDivideIds]], highlightColor,
						initialStyle.paint['line-color'] // Use saved initial color for unspecified
					];
					const widthExpression = [
						'case',
						['in', ['get', 'divide_id'], ['literal', specificDivideIds]], 3,
						initialStyle.paint['line-width'] // Use saved initial width for unspecified
					];
					
					map.setPaintProperty(layer.id, 'line-color', colorExpression);
					map.setPaintProperty(layer.id, 'line-width', widthExpression);
				} 
				else
				if (layer.type === 'fill')
				{
					const colorExpression = [
						'case',
						['in', ['get', 'divide_id'], ['literal', specificDivideIds]], highlightColor,
						initialStyle.paint['fill-color'] // Use saved initial color for unspecified
					];
					
					map.setPaintProperty(layer.id, 'fill-color', colorExpression);
					map.setPaintProperty(layer.id, 'fill-opacity', 0.7); // Make sure specified ones are visible
					map.setLayoutProperty(layer.id, 'visibility', 'visible'); // Ensure layer is visible
				}
			}
			else
			{	
				// Apply uniform styling to ALL catchments when no specific IDs are provided
				if (layer.type === 'line')
				{
					map.setPaintProperty(layer.id, 'line-color', highlightColor);
					map.setPaintProperty(layer.id, 'line-width', 3);
				} 
				else
				if (layer.type === 'fill')
				{
					map.setPaintProperty(layer.id, 'fill-color', highlightColor);
					map.setPaintProperty(layer.id, 'fill-opacity', 0.7); // Make sure it's visible
					map.setLayoutProperty(layer.id, 'visibility', 'visible'); // Ensure layer is visible
				}
			}
		}
	});
}

/**
 * Resets catchment layers to their original saved styles
 * @param {object} map - The maplibre map object
 */
function resetCatchmentToOriginalStyles(map)
{
	// Get all layers in the map style
	const layers = map.getStyle().layers;
	
	// Iterate through layers to find catchment layers
	layers.forEach(layer => {
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{
			// Get the initial style for this layer
			const initialStyle = initialCatchmentStyles[layer.id];

			// Reset to initial style if available
			if (initialStyle)
			{
				if (layer.type === 'line')
				{
					map.setPaintProperty(layer.id, 'line-color', initialStyle.paint['line-color']);
					map.setPaintProperty(layer.id, 'line-width', initialStyle.paint['line-width']);
					map.setPaintProperty(layer.id, 'line-opacity', initialStyle.paint['line-opacity']);
				} 
				else
				if (layer.type === 'fill')
				{
					map.setPaintProperty(layer.id, 'fill-color', initialStyle.paint['fill-color']);
					map.setPaintProperty(layer.id, 'fill-opacity', initialStyle.paint['fill-opacity']);
				}
			}
		}
	});
}

/**
 * Updates styling for existing divide_id layers using filters and paint properties
 * @param {object} map - The maplibre map object
 */
function resetCatchmentColors(map)
{
	// Get all layers in the map style
	const layers = map.getStyle().layers;
	
	// Iterate through layers to find catchment layers
	layers.forEach(layer => {

		// Catchment layer found
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{
			// Get the initial style for this layer
			const initialStyle = initialCatchmentStyles[layer.id];

			// Reset to initial style if available
			if (initialStyle)
			{
				if (layer.type === 'line')
				{
					map.setPaintProperty(layer.id, 'line-color', initialStyle.paint['line-color']);
					map.setPaintProperty(layer.id, 'line-width', initialStyle.paint['line-width']);
					map.setPaintProperty(layer.id, 'line-opacity', initialStyle.paint['line-opacity']);
				} 
				else
				if (layer.type === 'fill')
				{
					map.setPaintProperty(layer.id, 'fill-color', initialStyle.paint['fill-color']);
					map.setPaintProperty(layer.id, 'fill-opacity', initialStyle.paint['fill-opacity']);
				}
			}
		}
	});
}

/**
 * Creates a crosshatch pattern and adds it to the map as an image
 * @param {object} map - The maplibre map object
 * @param {boolean} successPattern - If true, add the success pattern
 * @param {boolean} failPattern - If true, add the fail pattern
 */
function addCrosshatchPatterns(map, successPattern=true, failPattern=true)
{
	// Success crosshatch pattern
	if (successPattern)
	{
		// Create pattern dimensions
		const size = 16;
		const data = new Uint8Array(size * size * 4); // RGBA
		
		// Fill with transparent background
		for (let i = 0; i < data.length; i += 4)
		{
			data[i] = 0;     // R
			data[i + 1] = 0; // G
			data[i + 2] = 0; // B
			data[i + 3] = 0; // A (transparent)
		}
		
		// Draw crosshatch pattern
		for (let x = 0; x < size; x++)
		{
			for (let y = 0; y < size; y++)
			{
				// Create diagonal lines
				if (x === y || x === (size - 1 - y))
				{
					const index = (y * size + x) * 4;
					data[index] = 0;     	// R 
					data[index + 1] = 255;  // G (green)
					data[index + 2] = 0;  	// B
					data[index + 3] = 255;	// A (opaque)
				}
			}
		}
		
		// Add the pattern as an image to the map
		if (!map.hasImage('crosshatch-success'))
		{
			map.addImage('crosshatch-success', {
				width: size,
				height: size,
				data: data
			});
		}
	}

	// Fail crosshatch pattern
	if (failPattern)
	{
		// Create pattern dimensions
		const size = 16;
		const data = new Uint8Array(size * size * 4); // RGBA
		
		// Fill with transparent background
		for (let i = 0; i < data.length; i += 4)
		{
			data[i] = 0;     // R
			data[i + 1] = 0; // G
			data[i + 2] = 0; // B
			data[i + 3] = 0; // A (transparent)
		}
		
		// Draw crosshatch pattern
		for (let x = 0; x < size; x++)
		{
			for (let y = 0; y < size; y++)
			{
				// Create diagonal lines
				if (x === y || x === (size - 1 - y))
				{
					const index = (y * size + x) * 4;
					data[index] = 255;     // R (red)
					data[index + 1] = 0;   // G
					data[index + 2] = 0;   // B
					data[index + 3] = 255; // A (opaque)
				}
			}
		}
		
		// Add the pattern as an image to the map
		if (!map.hasImage('crosshatch-fail'))
		{
			map.addImage('crosshatch-fail', {
				width: size,
				height: size,
				data: data
			});
		}
	}
}

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
	});
}

/**
 * Updates catchment styling with comprehensive success/failure coloring
 * @param {object} map - The maplibre map object
 * @param {string} successColor - Color for successful catchments (default green)
 * @param {string} failureColor - Color for failed catchments (default red)
 * @param {Array<string>} failedDivideIds - Array of divide_id values that failed
 */
function updateCatchmentColorComprehensive(map, successColor = '#00FF00', failureColor = '#FF0000', failedDivideIds = [])
{
	// Get all layers in the map style
	const layers = map.getStyle().layers;
	
	// Iterate through layers to find catchment layers
	layers.forEach(layer => {
		// Catchment layer found
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{
			// Apply comprehensive styling based on success/failure			
			if (layer.type === 'fill')
			{	
				// Remove any existing pattern to avoid conflicts
				map.setPaintProperty(layer.id, 'fill-pattern', undefined);
				
				// Helper function to convert hex to rgba
				const hexToRgba = (hex, alpha) => {
					const r = parseInt(hex.slice(1, 3), 16);
					const g = parseInt(hex.slice(3, 5), 16);
					const b = parseInt(hex.slice(5, 7), 16);
					return `rgba(${r}, ${g}, ${b}, ${alpha})`;
				};
				
				// Set colors using function parameters: red for failed, green for successful
				const backgroundColorExpression = failedDivideIds.length > 0 ? [
					'case',
					['in', ['get', 'divide_id'], ['literal', failedDivideIds]], hexToRgba(failureColor, 0.4), // Failed
					hexToRgba(successColor, 0.3) // Successful
				] : hexToRgba(successColor, 0.3); // If no failures, all green
				
				map.setPaintProperty(layer.id, 'fill-color', backgroundColorExpression);
				map.setPaintProperty(layer.id, 'fill-opacity', 0.7);
				map.setLayoutProperty(layer.id, 'visibility', 'visible');
			}
			else
			if (layer.type === 'line')
			{
				// Keep line styling as colors (crosshatch doesn't work well for lines)
				const colorExpression = failedDivideIds.length > 0 ? [
					'case',
					['in', ['get', 'divide_id'], ['literal', failedDivideIds]], failureColor,	// Failed
					successColor	// Successful
				] : successColor;	// No failures, all successColor
				
				const widthExpression = failedDivideIds.length > 0 ? [
					'case',
					['in', ['get', 'divide_id'], ['literal', failedDivideIds]], 3, // Thicker for failed
					1 	// Normal width for successful
				] : 1;	// If no failures, normal width
				

				map.setPaintProperty(layer.id, 'line-color', colorExpression);
				map.setPaintProperty(layer.id, 'line-width', widthExpression);
			}
		}
	});
}

function mapSetVisualizationMode(map, mode)
{
	if (visualizationViews[mode])
	{
		// Remove all existing click handlers before adding new ones
		map.off('click');
		
		visualizationViews[mode].updateMap(map);
		visualizationViews[mode].updateOnClick(map);
	}
}

$(function() {
	// Set the last run time text (set to current date for now)
	$('#last-run-time-label').text(`Last Run: ${new Date().toLocaleString()}`);

    // Update map when visualization mode changes
    $('input[name="visualization-mode"]').on('change', function() {
        const currentIndex = $('input[name="visualization-mode"]').index(this);
        const selectedLabel = $(this).next('label');

        console.log(currentIndex, selectedLabel.text());
	
        // Update map based on selected visualization mode
        if (visualizationViews[selectedLabel.text()])
		{
            mapSetVisualizationMode(map, selectedLabel.text());
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
    map.on('load', function() {
        // Add handler for missing style images
        handleStyleImageMissing(map);
        
        // Add source data loading handler - optimized for performance
        let lastStyleApplication = 0;
        let pendingStyleUpdate = null;
        
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
                if (visualizationViews[currentMode] && currentMode === 'Last Run')
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

        // Add click functionality
        // map.on('click', function(e) {
        //     // Query all features at click point
        //     const allFeatures = map.queryRenderedFeatures(e.point);
            
        //     if (allFeatures.length > 0)
		// 	{
        //         console.log('All features at click point:', allFeatures);
                
        //         // Organize features by type
        //         const vpuFills = allFeatures.filter(f => f.layer.id.startsWith('vpu-fill-'));
        //         const vpuBoundaries = allFeatures.filter(f => f.layer.id.startsWith('vpu-') && f.layer.type === 'line');
        //         const otherFeatures = allFeatures.filter(f => 
        //             !f.layer.id.startsWith('vpu-') && f.layer.id !== 'vpu-labels'
        //         );
                
        //         console.log('VPU fills (clicked inside):', vpuFills);
        //         console.log('VPU boundaries:', vpuBoundaries);
        //         console.log('Other features:', otherFeatures);
                
        //         // Show info about the top feature
        //         const topFeature = allFeatures[0];
        //         console.log(`Top layer: ${topFeature.layer.id}`);
        //         console.log('Feature properties:', topFeature.properties);
                
        //         // Create popup content based on feature type
        //         let popupContent = `<h6>${e.lngLat}</h6>`;
                
        //         if (vpuFills.length > 0)
		// 		{
        //             const fill = vpuFills[0];
        //             const vpuId = fill.properties.vpuid;
        //             const vpuName = getVPUName(vpuId);

		// 			map.setPaintProperty(`vpu-${vpuId}`, 'line-color', '#eeff00ff');
		// 			map.moveLayer(`vpu-${vpuId}`);

        //             popupContent += `<h3>Inside VPU ${vpuId}</h3>`;
        //             popupContent += `<p><strong>${vpuName}</strong></p>`;
        //             popupContent += `<p><em>Clicked inside polygon area</em></p>`;
        //         }
		// 		else
		// 		if (vpuBoundaries.length > 0)
		// 		{
        //             const boundary = vpuBoundaries[0];
        //             popupContent += `<h3>${boundary.layer.id}</h3>`;
        //             popupContent += `<pre>${JSON.stringify(boundary.properties, null, 2)}</pre>`;
        //         }
		// 		else
		// 		{
        //             popupContent += `<h3>${topFeature.layer.id}</h3>`;
        //             popupContent += `<pre>${JSON.stringify(topFeature.properties, null, 2)}</pre>`;
        //         }
                
        //         // Show popup
        //         new maplibregl.Popup()
        //             .setLngLat(e.lngLat)
        //             .setHTML(popupContent)
        //             .addTo(map);
        //     }
        // });

        // Add hover effects for better UX
        const hoverLayers = ['local-boundary'];
        
        // Add VPU layers to hover list
        for(let i = 0; i < 17; i++)
		{
            let vpuNumber = `0${i + 1}`;
            if (i > 9) vpuNumber = `${i + 1}`;
            hoverLayers.push(`vpu-${vpuNumber}`);
        }

        // Change cursor on hover
        hoverLayers.forEach(layerId => {
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        });
    });
});
