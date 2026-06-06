/**
 * Utility functions for managing catchment layer styles on the map
 * These functions allow for dynamic styling of catchment layers based on application state,
 * such as highlighting specific catchments, showing success/failure status, or resetting to original styles.
 * 
 * The styles are applied by modifying the paint properties of the relevant layers, which are identified
 * by their source and source-layer attributes. The initial styles of these layers are saved upon first load
 * to allow for resetting later.
 */

// Store initial catchment layer styles
const initialCatchmentStyles = {};


/**
 * Captures the initial styles of catchment layers for later restoration
 * @param {object} map - The maplibre map object
 */
export function saveInitialCatchmentStyles(map)
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
export function updateCatchmentColor(map, highlightColor = '#00FF00', specificDivideIds = [])
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
 * Updates catchment styling with comprehensive success/failure coloring
 * @param {object} map - The maplibre map object
 * @param {string} successColor - Color for successful catchments (default green)
 * @param {string} failureColor - Color for failed catchments (default red)
 * @param {Array<string>} failedDivideIds - Array of divide_id values that failed
 */
export function updateCatchmentColorComprehensive(map, successColor = '#00FF00', failureColor = '#FF0000', failedDivideIds = [])
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


/**
 * Updates catchment styling with random coloring from a color given map
 * @param {object} map - The maplibre map object
 * @param {function} colorMap - A D3 interpolator function.
 */
export function updateCatchmentColorRandom(map, colorMap = d3.interpolateViridis)
{
	// Get all layers in the map style
	const layers = map.getStyle().layers;
	
	// Iterate through layers to find catchment layers
	layers.forEach(layer => {
		// Catchment layer found
		if (layer.source === 'hydrofabric' && layer['source-layer'] === 'conus_divides')
		{		
			if (layer.type === 'fill')
			{	
				// Remove any existing pattern to avoid conflicts
				map.setPaintProperty(layer.id, 'fill-pattern', undefined);
				
				// Create an expression that generates a random color for each feature based on divide_id
				// This uses the divide_id as a seed for consistent colors per catchment
				const colorExpression = [
					'interpolate',
					['linear'],
					// Use modulo of divide_id hash to get a value between 0 and 1
					['%', 
						['abs', 
							['to-number', 
								['slice', ['get', 'divide_id'], 4] // Remove 'cat-' prefix and convert to number
							]
						], 
						1000
					], // Modulo 1000 to get variety
					0, colorMap(0),
					250, colorMap(0.25),
					500, colorMap(0.5),
					750, colorMap(0.75),
					999, colorMap(1)
				];
				
				// Set fill color and opacity
				map.setPaintProperty(layer.id, 'fill-color', colorExpression);
				map.setPaintProperty(layer.id, 'fill-opacity', 0.6);
				map.setLayoutProperty(layer.id, 'visibility', 'visible');
			}
			else
			if (layer.type === 'line')
			{
				// Same expression for line colors
				const colorExpression = [
					'interpolate',
					['linear'],
					['%', 
						['abs', 
							['to-number', 
								['slice', ['get', 'divide_id'], 4]
							]
						], 
						1000
					],
					0, colorMap(0),
					250, colorMap(0.25),
					500, colorMap(0.5),
					750, colorMap(0.75),
					999, colorMap(1)
				];
				
				// Set line color and width
				map.setPaintProperty(layer.id, 'line-color', colorExpression);
				map.setPaintProperty(layer.id, 'line-width', 1);
			}
		}
	});
}


/**
 * Resets catchment layers to their original saved styles
 * @param {object} map - The maplibre map object
 */
export function resetCatchmentToOriginalStyles(map)
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
