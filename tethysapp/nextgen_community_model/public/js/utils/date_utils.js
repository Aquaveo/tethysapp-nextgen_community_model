/**
 * Returns the given date as a string in the format used/expected by the app.
 * Format: D MMM YYYY (e.g., 1 Jan 2024)
 * @param {Date} date 
 */
export function dateToAppString(date)
{
    const day   = date.getDate();
    const month = date.toLocaleString('en-GB', { month: 'long' });
    const year  = date.getFullYear();

    return `${day} ${month} ${year}`;
}

/**
 * Returns the given date as a string in the format used/expected by the API controllers.
 * Format: YYYYMMDD (e.g., 20240101)
 * @param {Date} date 
 */
export function dateToApiString(date)
{
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}
