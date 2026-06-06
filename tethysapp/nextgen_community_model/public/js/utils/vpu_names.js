/** Helper function to get the name of a VPU given its ID.
 * @param {string} vpuId - The ID of the VPU.
 * @returns {string} - The name of the VPU or 'Unknown' if not found.
 * @example
 * // Get the name of VPU '03N'
 * const name = getVPUName('03N');
 * console.log(name); // Outputs: South Atlantic-North
 */
export function getVPUName(vpuId)
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