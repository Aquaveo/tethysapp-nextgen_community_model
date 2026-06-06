/**
 * Utility functions for managing VPU layers on the map
 * These functions handle the addition of VPU outline and fill layers, as well as text labels.
 * The layers are added with specific IDs that include the VPU ID, allowing for dynamic styling and interaction.
 */

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
export function addVpuOutlines(map, vpuIds, vpuColors)
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
export function addVpuTextLabels(map)
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