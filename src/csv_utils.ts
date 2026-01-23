/**
 * Utility: Generate CSV content
 * Escapes fields that contain commas, newlines, or quotes.
 */
export function generateCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(row => 
        headers.map(fieldName => {
            const val = row[fieldName] || '';
            // Escape quotes and wrap in quotes if contains comma or newline
            // If val is not a string, convert it to string
            const stringVal = String(val).replace(/"/g, '""');
            return /[,\n"]/.test(stringVal) ? `"${stringVal}"` : stringVal;
        }).join(',')
    );
    return [headerRow, ...rows].join('\n');
}

/**
 * Utility: Download CSV file
 * Creates a temporary link element to trigger the download.
 */
export function downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
