
import { IDriver, DriverResponse } from './IDriver';
import { getEnrichmentPage, closeEnrichmentBrowser } from '../../services/cePuppeteerService';

export class PuppeteerDriver implements IDriver {
    private credentialId?: string;

    constructor(credentialId?: string) {
        this.credentialId = credentialId;
    }

    // Checking links with Puppeteer handles redirects and JS verification better,
    // although simpler HEAD/GET is faster for mass checking.
    // For now, we reuse the HttpDriver logic or keep it simple?
    // Let's implement basic validation via Puppeteer for robustness in auth context.
    async validateLink(url: string): Promise<{ status: number; valid: boolean; contentType?: string; error?: string }> {
        let page;
        try {
            page = await getEnrichmentPage(this.credentialId);
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            if (!response) {
                throw new Error("No response");
            }

            const status = response.status();
            const valid = status >= 200 && status < 400; // Allow 3xx
            const headers = response.headers();

            return {
                status,
                valid,
                contentType: headers['content-type']
            };
        } catch (err: any) {
            return {
                status: 0,
                valid: false,
                error: err.message
            };
        } finally {
            if (page) await page.close(); // Close tab, keep browser
        }
    }

    async fetchPage(url: string): Promise<DriverResponse> {
        let page;
        try {
            page = await getEnrichmentPage(this.credentialId);

            console.log(`[PuppeteerDriver] Fetching ${url}`);
            const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            let status = 0;
            let finalUrl = page.url();
            let headers: any = {};

            if (response) {
                status = response.status();
                headers = response.headers();
            }

            // Extract content
            const content = await page.content();

            return {
                status,
                url: url,
                finalUrl,
                content: content,
                headers
            };

        } catch (err: any) {
            console.error(`[PuppeteerDriver] Fetch Failed: ${err.message}`);
            return {
                status: 0,
                url: url,
                finalUrl: url,
                content: '',
                headers: {}
            };
        } finally {
            if (page) await page.close();
        }
    }

    async close(): Promise<void> {
        // We do not strictly close the EnrichmentBrowser here because it is a singleton managed by the service.
        // Or we might want to close it if the job is truly done. 
        // For now, `ceJobService` calls close() at the end.
        await closeEnrichmentBrowser();
    }
}
