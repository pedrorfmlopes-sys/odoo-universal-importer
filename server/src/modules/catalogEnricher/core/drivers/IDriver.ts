export interface DriverResponse {
    status: number;
    url: string;
    content?: string; // HTML content
    headers?: any;
    finalUrl?: string; // To handle redirects
}

export interface IDriver {
    /**
     * Checks if a link is alive (200 OK) without downloading the full body if possible.
     * Should handle HEAD -> GET fallback strategies.
     */
    validateLink(url: string): Promise<{ status: number, valid: boolean, contentType?: string, error?: string }>;

    /**
     * Fetches the full page content (HTML) for parsing.
     */
    fetchPage(url: string): Promise<DriverResponse>;

    /**
     * Cleanup resources (browser context, etc)
     */
    close(): Promise<void>;
}
