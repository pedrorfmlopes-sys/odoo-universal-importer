
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProbeResult } from '../types/ceTypes';

export const ceProbeService = {
    async probeUrl(url: string): Promise<ProbeResult> {
        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            const start = Date.now();
            const response = await axios.get(targetUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                validateStatus: (status) => status < 500 // Accept anything not server error to analyze
            });
            const duration = Date.now() - start;

            const contentType = response.headers['content-type'] || '';
            const html = typeof response.data === 'string' ? response.data : '';

            // Basic JS detection heuristics
            // If HTML is very short or contains typical "You need to enable JavaScript" messages
            const isTooShort = html.length < 500;
            const hasJsMessage = html.toLowerCase().includes('enable javascript') || html.toLowerCase().includes('javascript is required');
            const requiresJs = isTooShort || hasJsMessage;

            let title = '';
            if (html && contentType.includes('text/html')) {
                const $ = cheerio.load(html);
                title = $('title').text().trim();
            }

            return {
                url: targetUrl,
                accessible: response.status >= 200 && response.status < 400,
                statusCode: response.status,
                contentType,
                title,
                server: response.headers['server'],
                requiresJs
            };

        } catch (err: any) {
            return {
                url: targetUrl,
                accessible: false,
                statusCode: err.response?.status || 0,
                requiresJs: false,
                title: err.message
            };
        }
    },
    async checkAsset(url: string): Promise<{ accessible: boolean, contentType: string, size: number }> {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                validateStatus: (status) => status < 400
            });
            return {
                accessible: true,
                contentType: response.headers['content-type'] || '',
                size: Number(response.headers['content-length'] || 0)
            };
        } catch (err: any) {
            return { accessible: false, contentType: '', size: 0 };
        }
    }
};
