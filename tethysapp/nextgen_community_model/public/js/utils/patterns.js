/**
 * Utility functions for creating and managing crosshatch patterns on the map
 */

/**
 * Creates a crosshatch pattern with a custom color and adds it to the map as an image
 * @param {object} map - The maplibre map object
 * @param {string} patternId - Unique identifier for this pattern
 * @param {string} color - Color string (e.g., '#ff0000' or 'rgb(255,0,0)')
 */
export function addColoredCrosshatchPattern(map, patternId, color)
{
	// Skip if pattern already exists
	if (map.hasImage(patternId))
	{
		return;
	}
	
	// Convert color string to RGB values
	let r, g, b;
	if (color.startsWith('#'))
	{
		// Hex color
		r = parseInt(color.slice(1, 3), 16);
		g = parseInt(color.slice(3, 5), 16);
		b = parseInt(color.slice(5, 7), 16);
	}
	else
	if (color.startsWith('rgb'))
	{
		// RGB color - extract numbers
		const matches = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (matches)
		{
			r = parseInt(matches[1]);
			g = parseInt(matches[2]);
			b = parseInt(matches[3]);
		}
		else
		{
			// Default to black if parsing fails
			r = g = b = 0;
		}
	}
	else
	{
		// Default to black for unknown color formats
		r = g = b = 0;
	}
	
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
				data[index] = r;       // R
				data[index + 1] = g;   // G
				data[index + 2] = b;   // B
				data[index + 3] = 255; // A (opaque)
			}
		}
	}
	
	// Add the pattern as an image to the map
	map.addImage(patternId, {
		width: size,
		height: size,
		data: data
	});
}


/**
 * Creates a crosshatch pattern and adds it to the map as an image
 * @param {object} map - The maplibre map object
 * @param {boolean} successPattern - If true, add the success pattern
 * @param {boolean} failPattern - If true, add the fail pattern
 */
export function addCrosshatchPatterns(map, successPattern=true, failPattern=true)
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
