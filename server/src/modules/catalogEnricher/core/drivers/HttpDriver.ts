import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IDriver, DriverResponse } from './IDriver';
import * as https from 'https';

export class HttpDriver implements IDriver {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            validateStatus: () => true, // Don't throw on 404/500
            httpsAgent: new https.Agent({ rejectUnauthorized: false }) // Allow insecure legacy sites
        });
    }

    async validateLink(url: string): Promise<{ status: number; valid: boolean; contentType?: string; error?: string }> {
        try {
            // Strategy 1: HEAD
            console.log(`[HttpDriver] Validating (HEAD): ${url}`);
            let res = await this.client.head(url);

            if (res.status === 405 || res.status === 403 || res.status === 404 || res.status >= 400) {
                // Strategy 2: GET with Range (Lightweight)
                console.log(`[HttpDriver] Fallback (GET Range): ${url} (prev: ${res.status})`);
                try {
                    res = await this.client.get(url, {
                        headers: { 'Range': 'bytes=0-0' },
                        maxContentLength: 1024, // Just the beginning
                        timeout: 5000
                    });
                } catch (err) {
                    // Ignore range error, try normal GET
                }
            }

            // Strategy 3: Normal GET (Short timeout) if still unsure or Range failed
            if (res.status >= 400) {
                console.log(`[HttpDriver] Fallback (Full GET): ${url}`);
                res = await this.client.get(url, {
                    timeout: 8000,
                    maxContentLength: 5 * 1024 * 1024 // 5MB limit check
                });
            }

            const valid = res.status >= 200 && res.status < 300;
            return {
                status: res.status,
                valid,
                contentType: res.headers['content-type']
            };

        } catch (err: any) {
            console.warn(`[HttpDriver] Validation failed for ${url}: ${err.message}`);
            return {
                status: err.response?.status || 0,
                valid: false,
                error: err.message
            };
        }
    }

    async fetchPage(url: string): Promise<DriverResponse> {
        try {
            const res = await this.client.get(url);
            return {
                status: res.status,
                url: url, // Axios might track redirects in res.request.res.responseUrl but it's tricky
                finalUrl: res.request?.res?.responseUrl || url,
                content: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
                headers: res.headers
            };
        } catch (err: any) {
            return {
                status: err.response?.status || 0,
                url: url,
                content: '',
                headers: {},
                finalUrl: url
            };
        }
    }

    async close(): Promise<void> {
        // Nothing to close for Axios
    }
}
