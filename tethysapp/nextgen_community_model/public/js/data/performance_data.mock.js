/**
 * Generates realistic performance metrics for a VPU
 * @param {number} coeffDeterm - Coefficient of determination (R²) value (0-1)
 * @returns {object} Object containing realistic performance metrics
 */
function generatePerformanceMetrics(coeffDeterm)
{
	return {
		coeffDeterm: coeffDeterm,
		rootMeanSquareError: (Math.random() * 25 + 5).toFixed(1), 					// 5-30 range
		meanAbsoluteError: (Math.random() * 15 + 2).toFixed(1), 					// 2-17 range
		normalizedNashSutcliffeEfficiency: (Math.random() * 0.6 + 0.1).toFixed(2), 	// 0.1-0.7 range
		relativeBias: ((Math.random() - 0.5) * 40).toFixed(1) 						// -20% to +20% range
	};
}

/**
 * Generates VPU performance data for all VPUs with predefined R² values
 * @returns {object} Object containing performance data for all VPUs
 */
function generateVpuPerformanceData()
{
	// Predefined R² values for each VPU
	const rSquaredValues = {
		'01': 0.85, '02': 0.24, '03N': 0.61, '03S': 0.74, '03W': 0.11,
		'04': 0.92, '05': 0.45, '06': 0.33, '07': 0.78, '08': 0.56,
		'09': 0.69, '10L': 0.47, '10U': 0.52, '11': 0.88, '12': 0.75,
		'13': 0.32, '14': 0.13, '15': 0.29, '16': 0.94, '17': 0.66, '18': 0.81
	};
	
	const vpuData = {};
	for (const vpuId in rSquaredValues)
	{
		vpuData[vpuId] = generatePerformanceMetrics(rSquaredValues[vpuId]);
	}
	
	return vpuData;
}

export const performanceData = generateVpuPerformanceData();