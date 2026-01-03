
import puppeteer, { Browser, Page } from 'puppeteer';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { ceCredentialService } from './ceCredentialService';
import { getCeDatabase } from '../db/ceDatabase';

let browserInstance: Browser | null = null;
let activePage: Page | null = null;
let io: SocketIOServer | null = null;

export const initPuppeteerService = (socketIoFn: SocketIOServer) => {
    io = socketIoFn;
};

// Debug Logger
const fs = require('fs');
const logPath = path.join(process.cwd(), 'data', 'crawler_debug.txt');
const logDebug = (msg: string) => {
    try {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(logPath, line);
    } catch (e) { console.error("Log failed", e); }
};
// Helper to clear log on start
export const clearDebugLog = () => { try { fs.writeFileSync(logPath, ''); } catch (e) { } };

// SHARED CRAWLER BROWSER SINGLETON
let sharedCrawlerBrowser: Browser | null = null;

export const getSharedCrawlerBrowser = async (): Promise<Browser> => {
    if (sharedCrawlerBrowser && sharedCrawlerBrowser.isConnected()) {
        return sharedCrawlerBrowser;
    }
    console.log("ðŸ•·ï¸ Launching Shared Crawler Browser...");
    sharedCrawlerBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    // Auto-cleanup if disconnected
    sharedCrawlerBrowser.on('disconnected', () => {
        console.log("ðŸ•·ï¸ Shared Crawler Browser Disconnected.");
        sharedCrawlerBrowser = null;
    });

    return sharedCrawlerBrowser;
};

export const startTeacherBrowser = async (startUrl: string) => {
    if (browserInstance) {
        await browserInstance.close();
    }

    console.log(`ðŸŽ“ Starting Teacher Browser at ${startUrl}`);

    // Launch visible browser
    browserInstance = await puppeteer.launch({
        headless: false,
        defaultViewport: null, // Full width
        args: ['--start-maximized', '--no-sandbox']
    });

    const pages = await browserInstance.pages();
    activePage = pages[0];

    if (!activePage) throw new Error("No active page found");

    // Setup helper for pages (initial and new tabs)
    const setupPage = async (page: Page) => {
        // Expose the node function to the browser
        // We use a try-catch because re-exposing on the same page object (if reused) might throw, 
        // though typically new pages are clean.
        try {
            await page.exposeFunction('reportClick', (data: any) => {
                console.log("ðŸ–±ï¸ Click intercepted:", data.text);
                io?.emit('teacher:interaction', data);
            });
        } catch (e: any) {
            // Ignore if already bound
        }

        // Enable interaction interception
        // Only goto if it's the initial blank page or specific
        if (page.url() === 'about:blank') {
            await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
        }

        // Inject the "Spy" script
        await injectSpyScript(page);

        // Listen for navigation changes to re-inject script safely
        page.on('framenavigated', async (frame) => {
            try {
                if (frame === page.mainFrame()) {
                    console.log(`Navigation detected to: ${frame.url()}`);
                    await injectSpyScript(page);
                    io?.emit('teacher:navigated', { url: frame.url() });
                }
            } catch (err: any) {
                console.error("âš ï¸ Error handling navigation:", err.message);
            }
        });

        console.log("âœ… Page setup complete for:", page.url());
    };

    await setupPage(activePage);

    // Handle new tabs (target="_blank")
    browserInstance.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage) {
                console.log("âœ¨ New tab detected! Setting up teacher mode...");
                activePage = newPage; // Switch focus context to the new tab
                await setupPage(newPage);
            }
        }
    });

    // Handle closure
    browserInstance.on('disconnected', () => {
        console.log('Browser closed');
        io?.emit('teacher:closed');
        browserInstance = null;
        activePage = null;
    });

    return { success: true, url: startUrl };
};

export const closeTeacherBrowser = async () => {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
        activePage = null;
        console.log("ðŸŽ“ Teacher Browser closed manually.");
    }
};

// Redesigned Passive Spy Script
const injectSpyScript = async (page: Page) => {
    try {
        await page.evaluate(() => {
            if ((window as any).__TEACHER_ACTIVE__) return;
            (window as any).__TEACHER_ACTIVE__ = true;

            console.log("ðŸ•µï¸ Teacher Spy Active (Passive Mode)");

            document.addEventListener('click', (e) => {
                // If special flag is set by backend to perform a clean click, ignore logic
                if ((window as any).__TEACHER_IGNORE_NEXT__) {
                    (window as any).__TEACHER_IGNORE_NEXT__ = false;
                    return;
                }

                // CHECK FOR INSPECTION MODE (Alt Key or Shift Key)
                // If Alt/Shift is held, we BLOCK the click and treat it as an Extraction intent.
                // Otherwise, we let it pass naturally but log it.
                const isInspection = e.altKey || e.shiftKey;

                if (isInspection) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                // Else: Do NOT prevent default. Let the menu open/navigate.

                // Visual Feedback for click
                const ripple = document.createElement('div');
                ripple.style.position = 'fixed';
                ripple.style.left = `${e.clientX}px`;
                ripple.style.top = `${e.clientY}px`;
                ripple.style.transform = 'translate(-50%, -50%)';
                ripple.style.width = '20px';
                ripple.style.height = '20px';
                ripple.style.background = isInspection ? 'rgba(50, 255, 50, 0.6)' : 'rgba(255, 0, 0, 0.4)'; // Green for extract, Red for click
                ripple.style.borderRadius = '50%';
                ripple.style.zIndex = '1000000';
                ripple.style.pointerEvents = 'none';
                document.body.appendChild(ripple);
                setTimeout(() => ripple.remove(), 800);

                // Selector Logic (Same as improved before)
                // Improved Selector Logic in Spy
                const getSelector = (el: HTMLElement): string => {
                    // 1. ID is king (Handle numeric IDs via attribute selector)
                    if (el.id) return `[id="${el.id}"]`;

                    // 2. Unique Tags (H1, MAIN, HEADER, FOOTER)
                    const uniqueTags = ['H1', 'MAIN', 'HEADER', 'FOOTER', 'NAV'];
                    if (uniqueTags.includes(el.tagName)) {
                        if (document.getElementsByTagName(el.tagName).length === 1) {
                            return el.tagName.toLowerCase();
                        }
                    }

                    // 3. Data attributes
                    if (el.hasAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
                    if (el.hasAttribute('data-test')) return `[data-test="${el.getAttribute('data-test')}"]`;

                    // 4. Smart Path (Stop at ID)
                    const path: string[] = [];
                    let current: HTMLElement | null = el;

                    while (current && current.tagName !== 'HTML') {
                        if (current.id) {
                            path.unshift(`[id="${current.id}"]`);
                            break; // Stop at closest ID
                        }

                        let selector = current.tagName.toLowerCase();
                        let sibling = current;
                        let nth = 1;

                        // Count previous siblings of same type to calculate nth-of-type
                        while (sibling.previousElementSibling) {
                            sibling = sibling.previousElementSibling as HTMLElement;
                            if (sibling.tagName.toLowerCase() === selector) nth++;
                        }

                        if (nth > 1) selector += `:nth-of-type(${nth})`;

                        path.unshift(selector);
                        current = current.parentElement;
                    }
                    return path.join(' > ');
                };

                let target = e.target as HTMLElement;
                const selector = getSelector(target);

                (window as any).reportClick({
                    tag: target.tagName,
                    text: target.innerText?.substring(0, 50),
                    href: (target as HTMLAnchorElement).href || (target.closest('a') ? (target.closest('a') as HTMLAnchorElement).href : null),
                    src: (target as HTMLImageElement).src || (target.querySelector('img') ? (target.querySelector('img') as HTMLImageElement).src : null),
                    selector: selector,
                    x: e.clientX,
                    y: e.clientY,
                    isInspection: isInspection
                });
            }, true);

            // Verify binding exists immediately
            if (typeof (window as any).reportClick !== 'function') {
                console.warn("âš ï¸ reportClick binding is missing! Recording might fail.");
            } else {
                console.log("âœ… Teacher Spy Connected.");
            }

            // Visual overlay
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '8px 12px',
                zIndex: '9999999',
                borderRadius: '8px',
                pointerEvents: 'none',
                fontFamily: 'sans-serif',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            });
            overlay.innerHTML = 'ðŸ”´ <b>Rec</b><br/><span style="opacity:0.7">Click to Interact<br/>Alt+Click to Extract</span>';
            document.body.appendChild(overlay);
        });
    } catch (err: any) {
        console.error("âš ï¸ Failed to inject spy script:", err.message);
    }
};

export const executeTeacherAction = async (action: 'RESUME_CLICK' | 'PERFORM_CLICK', data: any) => {
    if (!activePage) return;

    if (action === 'RESUME_CLICK' && data.href) {
        console.log("Resuming navigation to:", data.href);
        await activePage.goto(data.href, { waitUntil: 'domcontentloaded' });
    }

    if (action === 'PERFORM_CLICK') {
        const { selector, x, y } = data.originalData || data;
        console.log(`ðŸ¤– Action: Clicking (Selector: ${selector})`);

        try {
            // Priority 1: Selector click (Handles Scrolling automatically)
            if (selector) {
                await activePage.evaluate((sel) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) {
                        (window as any).__TEACHER_IGNORE_NEXT__ = true;
                        el.click();
                    } else {
                        console.error("âŒ Element not found for selector:", sel);
                    }
                }, selector);
                console.log("âœ… Selector click executed.");
                return;
            }

            // Fallback: Coordinates click (if no selector or selector failed)
            if (x && y) {
                console.log(`âš ï¸ No selector, using coordinates fallback at [${x}, ${y}]`);
                // Visual Debug: Show where we are clicking
                await activePage.evaluate((px, py) => {
                    const marker = document.createElement('div');
                    marker.style.position = 'fixed';
                    marker.style.left = px + 'px';
                    marker.style.top = py + 'px';
                    marker.style.width = '10px';
                    marker.style.height = '10px';
                    marker.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                    marker.style.borderRadius = '50%';
                    marker.style.zIndex = '1000000';
                    marker.style.pointerEvents = 'none';
                    marker.style.transform = 'translate(-50%, -50%)';
                    marker.style.boxShadow = '0 0 10px rgba(255,0,0,1)';
                    document.body.appendChild(marker);
                    setTimeout(() => marker.remove(), 1000);

                    // Ensure we ignore the next click from our own script
                    (window as any).__TEACHER_IGNORE_NEXT__ = true;
                }, x, y);

                // Safe Human Click Sequence
                await activePage.mouse.move(x, y);
                await new Promise(r => setTimeout(r, 50)); // Hover effect
                await activePage.mouse.down();
                await new Promise(r => setTimeout(r, 50)); // Press duration
                await activePage.mouse.up();

                console.log("âœ… Mouse click executed.");
                return;
            }

            console.warn("âš ï¸ No selector or coordinates available for click action.");

        } catch (e: any) {
            console.error("ðŸ’¥ Click failed:", e.message);
        }
    }
};

export const replayRecipe = async (steps: any[], startUrl?: string) => {
    if (!browserInstance) {
        // Auto-start if closed. Use startUrl or blank.
        await startTeacherBrowser(startUrl || 'about:blank');
    } else if (activePage && startUrl) {
        // If already open, goto startUrl first
        console.log(`Navigating to start URL: ${startUrl}`);
        await activePage.goto(startUrl, { waitUntil: 'domcontentloaded' });
    }

    if (!activePage) throw new Error("No Page");

    const results: any[] = [];
    const currentProduct: any = {}; // Accumulator for distributed extraction

    console.log(`ðŸŽ¬ Replaying ${steps.length} steps...`);

    for (const step of steps) {
        console.log(`â–¶ Step ${step.id}: ${step.type} ${step.field ? '(' + step.field + ')' : ''}`);

        // Wait a bit
        await new Promise(r => setTimeout(r, 500));

        if (step.type === 'NAVIGATE' || step.type === 'PERFORM_CLICK' || step.type === 'VARIANT') {
            // PRIORITY: SELECTOR FIRST (Robust against scroll)
            if (step.selector) {
                try {
                    console.log(`â³ Waiting for selector: ${step.selector}`);
                    const el = await activePage.waitForSelector(step.selector, { timeout: 3000 });
                    if (el) {
                        await activePage.evaluate(() => { (window as any).__TEACHER_IGNORE_NEXT__ = true; });
                        await el.click();
                        console.log(`âœ… Selector click successful: ${step.selector}`);
                    }
                } catch (e) {
                    // FALLBACK: Text or Coordinates
                    console.warn(`âš ï¸ Selector failed: ${step.selector}. Attempting fallback...`);

                    let fallbackSuccess = false;

                    // Fallback A: Text Self-Healing
                    if (step.text) {
                        try {
                            // Text-based fallback (Self-Healing)
                            // XPath to find element containing text, ignoring whitespace
                            const text = step.text.trim();
                            if (text.length > 2) { // Only if text is meaningful
                                console.log(`ðŸ©¹ Self-Healing: Looking for element with text "${text}"`);
                                // Use 'as any' because $x might be missing from Page type defs in some versions
                                const elements = await (activePage as any).$x(`//*[contains(text(), '${text}')]`);

                                // Find the most specific element (interaction target) - usually the last one in tree or one that is visible
                                let clicked = false;
                                for (const handle of elements) {
                                    if (await handle.evaluate((node: Element) => {
                                        const style = window.getComputedStyle(node);
                                        return style && style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0;
                                    })) {
                                        await activePage.evaluate(() => { (window as any).__TEACHER_IGNORE_NEXT__ = true; });
                                        await (handle as any).click();
                                        console.log(`âœ… Text fallback successful on text: "${text}"`);
                                        clicked = true;
                                        fallbackSuccess = true;
                                        break;
                                    }
                                }

                                if (!clicked) {
                                    console.error("âŒ Text fallback failed: Element found but not clickable/visible.");
                                }
                            } else {
                                console.warn("âš ï¸ Text too short for fallback.");
                            }
                        } catch (textErr) {
                            console.error("âŒ Text fallback error:", textErr);
                        }
                    }

                    // Fallback B: Coordinates (Only if text failed)
                    if (!fallbackSuccess && step.coordinates && step.coordinates.x) {
                        console.log("ðŸ“ Using Coordinate Fallback...");
                        await activePage.evaluate(() => { (window as any).__TEACHER_IGNORE_NEXT__ = true; });
                        await activePage.mouse.click(step.coordinates.x, step.coordinates.y);
                        fallbackSuccess = true;
                    }
                }
            } else if (step.coordinates && step.coordinates.x) {
                // If no selector at all, use coords
                await activePage.evaluate(() => { (window as any).__TEACHER_IGNORE_NEXT__ = true; });
                await activePage.mouse.click(step.coordinates.x, step.coordinates.y);
            } else if (step.href) {
                await activePage.goto(step.href, { waitUntil: 'networkidle2' });
            }
        }

        if (step.type === 'WAIT') {
            console.log(`â±ï¸ Waiting ${step.duration || 1000}ms...`);
            await new Promise(r => setTimeout(r, step.duration || 1000));
        }

        if (step.type === 'EXTRACT_FIELD' && step.selector && step.field) {
            // Granular Extraction
            try {
                console.log(`â³ Waiting for extraction selector: ${step.selector}`);
                await activePage.waitForSelector(step.selector, { timeout: 5000 }); // Wait for element to exist

                const value = await activePage.evaluate((sel, field) => {
                    const el = document.querySelector(sel);
                    if (!el) return null;

                    if (field === 'image') {
                        // Priority 1: Direct Image Tag
                        if (el.tagName === 'IMG') return (el as HTMLImageElement).src;

                        // Priority 2: Child Image
                        const childImg = el.querySelector('img');
                        if (childImg) return (childImg as HTMLImageElement).src;

                        // Priority 3: Parent Image (sometimes we click a span inside an A inside a DIV)
                        const parentLink = el.closest('a');
                        if (parentLink && /\.(jpg|jpeg|png|webp|gif)/i.test((parentLink as HTMLAnchorElement).href)) return (parentLink as HTMLAnchorElement).href;

                        // Priority 4: Background Image
                        const style = window.getComputedStyle(el);
                        if (style.backgroundImage && style.backgroundImage !== 'none') {
                            return style.backgroundImage.slice(5, -2).replace(/['"]/g, "");
                        }

                        // Fallback: HREF if it looks like an image
                        if ((el as HTMLAnchorElement).href && /\.(jpg|jpeg|png|webp|gif)/i.test((el as HTMLAnchorElement).href)) return (el as HTMLAnchorElement).href;
                    }

                    if (field === 'file') {
                        // Priority 1: Direct Link with PDF
                        if ((el as HTMLAnchorElement).href && /\.(pdf|zip|dwg|dxf)/i.test((el as HTMLAnchorElement).href)) return (el as HTMLAnchorElement).href;

                        // Priority 2: Child Link with PDF
                        const childLink = el.querySelector('a[href$=".pdf"], a[href$=".PDF"]');
                        if (childLink) return (childLink as HTMLAnchorElement).href;

                        // Priority 3: Parent Link with PDF
                        const parentLink = el.closest('a');
                        if (parentLink && /\.(pdf|zip|dwg|dxf)/i.test((parentLink as HTMLAnchorElement).href)) return (parentLink as HTMLAnchorElement).href;

                        // Priority 4: Any Link (Fallback)
                        if ((el as HTMLAnchorElement).href) return (el as HTMLAnchorElement).href;
                    }

                    return el.textContent?.trim();
                }, step.selector, step.field);

                if (value) {
                    // Validation for Images
                    if (step.field === 'image' && (value.startsWith('#') || value.startsWith('javascript:'))) {
                        console.warn(`âš ï¸ Ignored invalid image value: ${value}`);
                        return;
                    }

                    console.log(`ðŸ“¦ Extracted [${step.field}]:`, value);
                    // Append to list if it's a file/image, or overwrite if single
                    if (step.field === 'image' || step.field === 'file') {
                        if (!currentProduct[step.field + 's']) currentProduct[step.field + 's'] = [];
                        currentProduct[step.field + 's'].push(value);
                    } else {
                        currentProduct[step.field] = value;
                    }
                } else {
                    console.warn(`âš ï¸ Extraction returned NULL for selector: ${step.selector}`);
                    // Take debug screenshot
                    await activePage.screenshot({ path: `debug_fail_step_${step.id}.png` });
                }
            } catch (e) {
                console.error("Extraction failed for step:", step.id, e);
                await activePage.screenshot({ path: `debug_crash_step_${step.id}.png` });
            }
        }

        if (step.type === 'EXTRACT_PRODUCT' || step.type === 'VARIANT') {
            // Legacy/Generic Extraction (keep for backward compat or bulk dump)
            const data = await activePage.evaluate(() => {
                const getTxt = (sel: string) => document.querySelector(sel)?.textContent?.trim() || '';
                return { name: getTxt('h1'), url: window.location.href };
            });
            Object.assign(currentProduct, data);
        }
    }

    // Push the final accumulated product
    if (Object.keys(currentProduct).length > 0) {
        results.push(currentProduct);
    }

    console.log("ðŸ Replay Finished. Result:", currentProduct);
    return results;
};

export const fetchPageContent = async (url: string): Promise<string> => {
    let browser = browserInstance;
    let ownBrowser = false;
    let content = '';

    console.log(`ðŸ“¡ Fetching page content for: ${url}`);

    if (!browser) {
        console.log("Creating temporary headless browser for scan...");
        browser = await puppeteer.launch({
            headless: true, // Headless for scan
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        ownBrowser = true;
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Timeout 45s, wait for network idle to ensure menus load
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

        content = await page.content();

        if (!ownBrowser) await page.close(); // Don't close the shared browser, just the page
    } catch (e: any) {
        console.error("âŒ Fetch Page Content Failed:", e.message);
        throw e;
    } finally {
        if (ownBrowser && browser) {
            await browser.close();
            console.log("Temporary browser closed.");
        }
    }
    return content;
};
// ... existing code ...

import { PageAnalysisResult, PageKind } from '../types/ceTypes';

// V2: Smart Harvester + Page Analysis
export const analyzePage = async (url: string, jobId?: string, options: { downloadAssets?: boolean, existingPage?: Page, noInteractions?: boolean, signal?: AbortSignal, credentialId?: string } = {}): Promise<{ html: string; metadata: PageAnalysisResult }> => {
    let browser: Browser | null = null;
    let page: Page;
    let ownBrowser = true;
    let credentialId: string | undefined = undefined;
    let variants: any[] = [];
    let associated: any[] = [];
    let html = ''; // Initialize html variable

    // Helper to check for abort
    const checkAbort = () => {
        if (options.signal?.aborted) throw new Error('AbortError');
    };

    // 1. Use existing page if provided
    if (options.existingPage) {
        page = options.existingPage;
        ownBrowser = false;
    } else {
        // 2. Check Auth Requirement
        if (options.credentialId) {
            credentialId = options.credentialId;
        } else if (jobId) {
            try {
                const db = getCeDatabase();
                const job = db.prepare('SELECT profile_id FROM ce_jobs WHERE id = ?').get(jobId) as { profile_id: string };
                if (job && job.profile_id) {
                    const profile = db.prepare('SELECT auth_required, credential_id FROM ce_brand_profiles WHERE id = ?').get(job.profile_id) as any;
                    if (profile && profile.auth_required) {
                        credentialId = profile.credential_id;
                    }
                }
            } catch (e) { console.warn("DB Check failed in analyzePage", e); }
        }

        if (credentialId) {
            console.log(`ðŸ” [Smart Harvester] Using Authenticated Session for: ${url} (Cred: ${credentialId})`);
            page = await getEnrichmentPage(credentialId); // This already reuses connected browser
            ownBrowser = false;
        } else {
            // PERFORMANCE FIX: Reuse a shared background browser
            browser = await getSharedCrawlerBrowser();
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            ownBrowser = false; // We own the PAGE, but not the BROWSER. So don't close browser.
        }
    }

    // Helper for unified progress reporting
    const emitStatus = (message: string) => {
        if (!jobId || !io) return;
        if (jobId.startsWith('scan_')) {
            io.emit('scan-status', { scanJobId: jobId, message });
        } else {
            // Real job progress
            io.emit('job-progress', { jobId, status: 'running', message, progress: 0 });
        }
    };

    console.log(`ðŸ§  [Smart Harvester] Analyzing: ${url}`);
    logDebug(`START_ANALYSIS: ${url} | Credential: ${credentialId || 'None'} | OwnBrowser: ${ownBrowser}`);
    emitStatus(`Explorando: A ler produtos...`);

    try {
        if (ownBrowser) {
            // Robust Navigation
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        } else {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        }

        // ENABLE CONSOLE LOGS FROM BROWSER
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        emitStatus(`Explorando: A analisar grelha...`);

        if (!options.noInteractions) {

            checkAbort();
            // 0. General Cleanup (Cookies)
            await handleCookieConsent(page);

            // 0.1 VALIDATE PRODUCT PAGE (Ritmonio Specific)
            // Validar que a página é PRODUTO: esperar por um seletor “de produto”
            const productSelectors = ['h1', '.product-details', '.scheda-prodotto', '.nav-tabs'];
            try {
                // Quick check for at least ONE product indicator before spending time
                await page.waitForFunction((selectors) => {
                    return selectors.some(s => document.querySelector(s));
                }, { timeout: 10000 }, productSelectors);
                console.log("✅ [Validation] Product page confirmed.");
            } catch (e) {
                console.warn("⚠️ [Validation] Could not confirm product page (timeout). Dumping context...");
                await page.screenshot({ path: path.join(process.cwd(), 'data', 'ritmonio_blocked.png') });
                // We do not abort, but warn.
            }

            emitStatus(`ðŸ” Explorando botÃµes...`);
            checkAbort();

            // PRE-INTERACTION: Click Content Tabs (Safe & Fast Mode)
            await performHeuristicInteractions(page, options.signal);

            emitStatus(`ðŸ“œ Carregando lista completa...`);
            checkAbort();

            // PAGINATION & INFINITE SCROLL (Universal)
            // DISABLED V2: User confirms PDPs have all data loaded. Avoid hang.
            // await handleInfiniteScroll(page, jobId);

            checkAbort();

            // HEURISTIC: Navigation Drift Detection (Crucial before specific scrapers)
            const midUrl = page.url().toLowerCase();
            const originalPath = url.toLowerCase().split('?')[0].replace(/\/$/, '');
            if (!midUrl.includes(originalPath)) {
                console.log(`âš ï¸ [Smart Harvester] Pre-Discovery Drift detected (at ${midUrl}). Restoring ${url}...`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // SAFETY: Capture HTML NOW before risky extractions (Variants/Associated) might destroy context
            html = await page.content();

            // MOVED: Risky extractions (Variants/Associated) moved to after main evaluation to prevent context destruction data loss.

            // POST-INTERACTION: Check for Login Prompt (Interactive Auth)
            if (credentialId) {
                const currentUrl = page.url().toLowerCase();
                // Check if redirected to login page OR if password input is present (e.g. modal)
                // Use robust evaluate to avoid race conditions
                const hasLoginField = await page.evaluate(() => !!document.querySelector('input[type="password"]'));

                if (currentUrl.includes('login') || currentUrl.includes('auth') || hasLoginField) {
                    console.log("ðŸ” [Smart Harvester] Detected Login Prompt mid-crawl (Interactive). Performing Login...");

                    // Perform interactive login (skipping navigation)
                    // This handles filling the form found on the CURRENT page
                    await performLogin(page, credentialId, { skipNavigation: true });

                    // After login, we expect a redirect or UI update.
                    // Re-Run Interactions (Round 2) to open tabs that might have been behind the login wall
                    console.log("ðŸ–±ï¸ [Smart Harvester] Re-running interactions after login...");
                    await performHeuristicInteractions(page);
                }
            }

            // NAVIGATION DRIFT GUARD
            // If interactions caused navigation (e.g. clicking a 'Related Product' link mistaking it for a tab),
            // we must return to the original product page to extract the CORRECT data.
            const currentAfterInteraction = page.url();
            if (currentAfterInteraction !== url && currentAfterInteraction.split('?')[0] !== url.split('?')[0]) {
                console.warn(`âš ï¸ [Smart Harvester] Navigation Drift detected! Moved to ${currentAfterInteraction}. Restoring...`);
                try {
                    await page.goto(url, { waitUntil: 'networkidle2' });
                } catch (e) { console.error("âŒ Failed to restore page after drift:", e); }
            }
        }

        const harvesterData = await page.evaluate(() => {
            try {
                const currentUrl = window.location.href;
                console.log("Evaluation started for: " + currentUrl);
                const currentPath = window.location.pathname.toLowerCase();
                const productPatterns = ['/product/', '/producto/', '/produto/', '/prodotto/', '/item/', '/p/', '/article/'];
                const categoryPatterns = ['/products/', '/productos/', '/produtos/', '/category/', '/categoria/', '/collection/', '/coleccion/', '/collezioni/', '/collezione/', '/series/', '/serie/', '/tipologia/', '/tipology/', '/ambiente/', '/ambiente-', '/doccia/', '/wellness/', '/lineas-de-diseno/', '/linea/'];
                const disallowPatterns = ['/login', '/account', '/carrito', '/cart', '/checkout', '/blog', '/news', '/press', '/jobs', '/privacy', '/terms', '/imprint', '/contact', 'javascript:', 'mailto:', 'tel:'];

                // cleanName INLINED logic uses simple replace for safety

                // cleanName INLINED logic uses new RegExp below

                // 0. HELPER: Ignore Navigation Elements

                // 0. HELPER: Ignore Navigation Elements
                // Definitions removed

                let anchorsToUse: HTMLAnchorElement[] = [];
                const scopedAnchors: HTMLAnchorElement[] = []; // getScopedLinks();
                let productsFound: string[] = [];
                let debugInfo = null;

                if (scopedAnchors && scopedAnchors.length > 0) {
                    anchorsToUse = scopedAnchors;
                    // productsFound = extractProducts(scopedAnchors); // Calculate later
                } else {
                    // Strategy 2: Global
                    anchorsToUse = Array.from(document.querySelectorAll('a'));
                    // Strategy 3: Density (Simplified logic)
                    // If we have many links, filters apply later.
                }

                // Heuristic: Locale Preference
                const localeMatch = currentPath.match(/^\/([a-z]{2})(\/|$)/);
                const localePrefix = localeMatch ? `/${localeMatch[1]}/` : null;

                // 3. Classification Buckets
                const subcats: string[] = [];
                const products: string[] = [];
                const productRefs: { url: string, name: string }[] = [];
                const pdfs: string[] = [];
                const images: string[] = [];

                anchorsToUse.forEach(a => {
                    const href = a.getAttribute('href');
                    if (!href) return;
                    // if (isIgnored(a)) return; // Commented out for debugging

                    let link = '';
                    try {
                        const absolute = new URL(href, currentUrl);
                        if (!absolute.protocol.startsWith('http')) return;
                        absolute.hash = '';
                        link = absolute.href.trim();
                    } catch (e) { return; }

                    const u = new URL(link);
                    if (u.hostname !== new URL(currentUrl).hostname) return;
                    const path = u.pathname.toLowerCase();

                    const isProduct = productPatterns.some(p => path.includes(p));
                    const isCategory = categoryPatterns.some(p => path.includes(p));
                    const isCatalogLink = isProduct || isCategory;

                    if (localePrefix && !path.startsWith(localePrefix) && !isCatalogLink) return;

                    if (disallowPatterns.some(p => path.includes(p))) return;

                    // Asset Checks
                    // Asset Checks
                    if (path.endsWith('.pdf') || path.endsWith('.zip') || path.endsWith('.dwg') || path.endsWith('.step')) {
                        pdfs.push(link);
                        return;
                    }
                    // Ritmonio Special
                    if (path.includes('/download/') && link.includes('code=')) {
                        const text = (a.textContent || '').toLowerCase();
                        if (text.includes('3d') || text.includes('model')) {
                            pdfs.push(link + '#force_type=3d');
                            return;
                        }
                        if (text.includes('sheet') || text.includes('instructions') || text.includes('scheda')) {
                            pdfs.push(link + '#force_type=pdf');
                            return;
                        }
                    }
                    if (/\.(jpg|jpeg|png|webp)$/i.test(path)) {
                        images.push(link);
                        return;
                    }

                    if (isProduct) {
                        products.push(link);
                        let name = (a.textContent || '').replace(/\s+/g, ' ').trim();
                        if (!name) name = a.getAttribute('title') || '';
                        if (name && name.length > 2) {
                            const existing = productRefs.find(r => r.url === link);
                            if (existing) {
                                if (name.length > existing.name.length) existing.name = name;
                            } else {
                                productRefs.push({ url: link, name: name });
                            }
                        }
                    } else if (isCategory) {
                        // Filter out short paths (Root/Home)
                        if (path.length > (localePrefix?.length || 1) + 2) subcats.push(link);
                    }
                });

                // FALLBACK: Regex Scan for hidden files (JS/Scripts/Relative)
                try {
                    const html = document.body.innerHTML;
                    // Match absolute or relative paths ending in extension
                    const fileRegex = /(?:href=["']|src=["']|url\()([^\s"']+\.(?:zip|pdf|dwg|step))/gi;
                    let match;
                    while ((match = fileRegex.exec(html)) !== null) {
                        let url = match[1];
                        if (url) {
                            // Resolve relative
                            if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:')) {
                                try { url = new URL(url, currentUrl).href; } catch (e) { }
                            }
                            if (!pdfs.includes(url) && !images.includes(url)) {
                                pdfs.push(url);
                                console.log("Regex found file:", url);
                            }
                        }
                    }
                } catch (rxErr) { console.warn("Regex scan failed", rxErr); }

                return {
                    url: currentUrl,
                    page_kind: products.length > 0 ? 'category' : 'unknown',
                    subcategory_urls_found: [...new Set(subcats)],
                    product_family_urls_found: [...new Set(products)],
                    debug_counts: { links_total: anchorsToUse.length, subcats_found: subcats.length, products_found: products.length },
                    extracted_data: {
                        productRefs: productRefs,
                        files: [...new Set(pdfs)].map(f => {
                            let type = 'pdf';
                            let url = f;
                            if (f.includes('#force_type=3d')) { type = '3d'; url = f.split('#')[0]; }
                            else if (f.includes('#force_type=pdf')) { type = 'pdf'; url = f.split('#')[0]; }
                            else if (f.endsWith('.zip')) type = '3d';
                            else if (f.endsWith('.dwg')) type = 'cad';
                            return { url: url, type: type, name: type === '3d' ? '3D Model' : 'Asset' };
                        }),
                        gallery: [...new Set(images)] // Capture images if found in links
                    }
                };
            } catch (e: any) {
                console.log("CRITICAL EVAL ERROR name=" + e.name + " msg=" + e.message + " stack=" + e.stack);
                throw e;
            }
        });
        // PHYSICAL DOWNLOAD (3D Assets)
        // Satisfies Requirement: "Where are the files?"
        const extractedData = harvesterData.extracted_data;
        if (extractedData && extractedData.files && extractedData.files.length > 0) {
            // Determine Brand Subfolder
            let brandSubfolder = 'general';
            if (url.includes('fimacf.com')) brandSubfolder = 'fima';
            else if (url.includes('ritmonio.it')) brandSubfolder = 'ritmonio';
            else if (url.includes('my-bette.com')) brandSubfolder = 'bette';

            const assetsDir = path.join(process.cwd(), 'data', 'catalog-enricher', 'assets', brandSubfolder);
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

            for (const file of extractedData.files) {
                logDebug(`CHECK_FILE: Name=${file.name} Type=${file.type || 'N/A'} URL=${file.url}`);
                if (file.type === '3d' || file.type === 'pdf' || file.type === 'cad') { // Allow PDF download too if requested
                    // Decoupled Logic: Only physical download if requested
                    if (options.downloadAssets) {
                        try {
                            console.log(`â¬‡ï¸ [Smart Harvester] Downloading ${file.type.toUpperCase()}: ${file.url}`);
                            const cookies = await page.cookies();
                            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                            const axios = (await import('axios')).default;
                            const response = await axios({
                                method: 'GET',
                                url: file.url,
                                responseType: 'stream',
                                headers: {
                                    'Cookie': cookieString,
                                    'User-Agent': await page.browser().userAgent()
                                },
                                timeout: 60000,
                                validateStatus: (status) => status < 500 // Allow handling 403 manually
                            });

                            // 4) Validar login obrigatório (Recover on 403)
                            if ((response.status === 403 || response.status === 302 || response.status === 401) && credentialId) {
                                console.log(`🔒 [Smart Harvester] Access Denied (${response.status}) for ${file.url}. Attempting Lazy Login...`);

                                await performLogin(page, credentialId, { skipNavigation: true }); // Try in-place/interactive first or standard?
                                // If the file is on a different domain or requires a full navigation login, this might be tricky.
                                // But typically performLogin handles the flow.

                                // Refresh cookies
                                const newCookies = await page.cookies();
                                const newCookieString = newCookies.map(c => `${c.name}=${c.value}`).join('; ');

                                console.log(`🔄 [Smart Harvester] Retrying Download...`);
                                const retryResponse = await axios({
                                    method: 'GET',
                                    url: file.url,
                                    responseType: 'stream',
                                    headers: {
                                        'Cookie': newCookieString,
                                        'User-Agent': await page.browser().userAgent()
                                    },
                                    timeout: 60000
                                });

                                if (retryResponse.status === 200) {
                                    console.log(`✅ [Smart Harvester] Access Restored! Downloading...`);
                                    response.data = retryResponse.data;
                                    response.headers = retryResponse.headers;
                                } else {
                                    throw new Error(`Login attempt failed to restore access (Status: ${retryResponse.status})`);
                                }
                            } else if (response.status !== 200) {
                                throw new Error(`Download failed with status ${response.status}`);
                            }

                            // Determine Filename
                            let filename = path.basename(file.url).split('?')[0];
                            if (filename === 'download' || !filename.includes('.')) {
                                const cd = response.headers['content-disposition'];
                                if (cd) {
                                    const match = cd.match(/filename="?([^"]+)"?/);
                                    if (match && match[1]) filename = match[1];
                                }
                            }
                            if (!filename.includes('.')) filename = `${file.type}_${Date.now()}.${file.type === '3d' ? 'zip' : 'pdf'}`;

                            // Save File
                            const savePath = path.join(assetsDir, filename);
                            const writer = fs.createWriteStream(savePath);
                            response.data.pipe(writer);

                            await new Promise((resolve, reject) => {
                                writer.on('finish', () => resolve(true));
                                writer.on('error', reject);
                            });

                            console.log(`âœ… [Smart Harvester] Saved 3D Asset to: ${savePath}`);
                            logDebug(`DOWNLOAD_SUCCESS: Saved to ${savePath}`);
                            (file as any).local_path = savePath;

                        } catch (e: any) {
                            console.error(`âŒ [Smart Harvester] Download failed for ${file.url}:`, e.message);
                            logDebug(`DOWNLOAD_FAILED: ${file.url} | Error: ${e.message}`);
                            (file as any).error = e.message;
                        }
                    }
                }
            }
        }

        // Get HTML separately
        html = await page.content();

        // Premature close REMOVED
        // if (ownBrowser && browser) await browser.close();
        // else await page.close();

        // SPECIAL: Variants & Finishes (Moved here)
        try {
            variants = await handleProductVariants(page);
        } catch (err: any) {
            console.error("⚠️ [Smart Harvester] Variants Extraction Failed (Ignored):", err.message);
            variants = [];
        }

        // SPECIAL: Associated / Necessary Products (Moved here)
        try {
            associated = await handleAssociatedProducts(page);
        } catch (err: any) {
            console.error("⚠️ [Smart Harvester] Associated Products Extraction Failed (Ignored):", err.message);
            associated = [];
        }

        if (ownBrowser && browser) await browser.close();
        else await page.close();

        // Merge V3 Data (Variants & Associated)
        if (variants && variants.length > 0) {
            if (!harvesterData.extracted_data) (harvesterData.extracted_data as any) = {};
            (harvesterData.extracted_data as any).variants = variants;
        }
        if (associated && associated.length > 0) {
            if (!harvesterData.extracted_data) (harvesterData.extracted_data as any) = {};
            (harvesterData.extracted_data as any).associated_products = associated;
        }

        return {
            html,
            metadata: harvesterData as PageAnalysisResult
        };

    } catch (e: any) {
        console.error("âŒ Analyze Page Failed:", e.message);
        if (ownBrowser && browser) await browser.close();
        else if (page) await page.close();

        // Return fallback
        return {
            html: html || '',
            metadata: {
                url,
                page_kind: 'unknown',
                subcategory_urls_found: [],
                product_family_urls_found: [],
                debug_counts: { links_total: 0, subcats_found: 0, products_found: 0 }
            }
        };
    }
};

export const testRecipe = async (url: string, recipe: any) => {
    console.log(`ðŸ§ª Testing Recipe on ${url}`);
    const browser = await puppeteer.launch({ headless: true }); // Always headless for test
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Execute Selectors in Page Context
        const result = await page.evaluate((steps: any[]) => {
            const data: any = {};
            steps.forEach(step => {
                const els = document.querySelectorAll(step.selector);
                if (!els.length) {
                    data[step.field] = null;
                    return;
                }
                const el = els[0]; // Take first match

                if (step.type === 'attribute' && step.attribute) {
                    data[step.field] = el.getAttribute(step.attribute);
                } else if (step.type === 'html') {
                    data[step.field] = el.innerHTML;
                } else {
                    // Default text
                    data[step.field] = (el as HTMLElement).innerText?.trim();
                }

                // Handle Image absolute URLs
                if (step.field.includes('image') && data[step.field] && !data[step.field].startsWith('http')) {
                    // Simple relative fix (approximation inside evaluate)
                    // We'll leave it raw for now or fix in post-process
                }
            });
            return data;
        }, recipe.steps);

        await browser.close();
        return result;

    } catch (e: any) {
        await browser.close();
        throw new Error(`Test Failed: ${e.message}`);
    }
};

// -----------------------------------------------------------------------------
// ENRICHMENT & AUTHENTICATION
// -----------------------------------------------------------------------------

let enrichmentBrowser: Browser | null = null;
const authenticatedSessions = new Set<string>();

export const getEnrichmentPage = async (credentialId?: string): Promise<Page> => {
    // 1. Ensure Persistent Browser
    if (!enrichmentBrowser) {
        console.log("ðŸ” [Enrichment] Launching Persistent Headless Browser...");
        enrichmentBrowser = await puppeteer.launch({
            headless: true, // Always headless for backend jobs
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        authenticatedSessions.clear(); // Reset on new browser
    }

    const page = await enrichmentBrowser.newPage();
    // Use a standard desktop User-Agent to avoid mobile layouts or anti-bot blocks
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 2. Perform Login if needed (OPTIMIZED: "Login First, Stay Logged In")
    if (credentialId) {
        if (authenticatedSessions.has(credentialId)) {
            console.log(`ðŸ” [Auth] Session active for ${credentialId}. Skipping Pre-Login navigation.`);
        } else {
            console.log(`ðŸ” [Auth] No active session for ${credentialId}. Performing Pre-Login...`);
            await performLogin(page, credentialId);
            // Assume success if no error thrown
            authenticatedSessions.add(credentialId);
        }
    }

    return page;
};

export const closeEnrichmentBrowser = async () => {
    if (enrichmentBrowser) {
        await enrichmentBrowser.close();
        enrichmentBrowser = null;
        authenticatedSessions.clear();
        console.log("ðŸ” [Enrichment] Browser closed.");
    }
};

export const performLogin = async (page: Page, credentialId: string, options: { skipNavigation?: boolean } = {}) => {
    try {
        const cred = ceCredentialService.getDecrypted(credentialId);

        if (!cred || !cred.username || !cred.password) {
            console.warn(`âš ï¸ [Auth] Missing or invalid credentials for ID: ${credentialId}`);
            return;
        }

        if (!options.skipNavigation) {
            if (!cred.service_url) {
                console.warn("âš ï¸ [Auth] No service_url for pre-login, skipping navigation.");
            } else {
                console.log(`ðŸ” [Auth] Navigating to Login URL: ${cred.service_url}`);
                await page.goto(cred.service_url, { waitUntil: 'networkidle2', timeout: 60000 });
                // Handle Cookies on Login Page
                await handleCookieConsent(page);
            }
        } else {
            console.log("ðŸ” [Auth] Performing Interactive Login (Skipping Navigation)...");
        }

        // HEURISTIC MATCHING
        // 1. Look for User Input
        const userSelectors = ['input[type="text"]', 'input[type="email"]', 'input[name*="user"]', 'input[name*="login"]', 'input[name="id"]', '#username', '#email'];
        let userInp = null;
        for (const sel of userSelectors) {
            userInp = await page.$(sel);
            if (userInp) {
                // Check visibility
                const vis = await userInp.boundingBox();
                if (vis) break; // It's visible
                userInp = null;
            }
        }

        if (userInp) {
            console.log(`ðŸ” [Auth] Found Username Input. Typing...`);
            await userInp.type(cred.username, { delay: 50 });
        } else {
            // Check if maybe we are already logged in?
            const logoutLink = await page.$('a[href*="logout"], a[href*="sair"], button[name*="logout"]');
            if (logoutLink) {
                console.log("âœ… [Auth] Already logged in (Logout link detected).");
                return;
            }

            // If handling interactive, we might be on a page where the modal isn't open yet?
            // But we only call this if we detected login fields or URL.
            console.warn("âš ï¸ [Auth] Could not find Username input.");
            // Try explicit password only flow?
        }

        // 2. Look for Password Input
        const passInp = await page.$('input[type="password"]');
        if (passInp) {
            console.log(`ðŸ” [Auth] Found Password Input. Typing...`);
            await passInp.type(cred.password, { delay: 50 });
        } else {
            console.warn("âš ï¸ [Auth] Could not find Password input.");
            // If user input was found but password not, maybe 2-step? 
            // MVP: Return
            if (!userInp) return;
        }

        // 3. Look for Submit
        const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button[name*="login"]', '.login-btn', '.btn-primary', '#login-button'];
        let submitBtn = null;
        for (const sel of submitSelectors) {
            submitBtn = await page.$(sel);
            if (submitBtn) break;
        }

        if (submitBtn) {
            console.log(`ðŸ” [Auth] Submitting Login Form...`);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => console.log('Nav timeout (ignorable)')),
                submitBtn.click()
            ]);
            console.log("âœ… [Auth] Login navigation complete.");

            // Wait extra time for redirects
            await new Promise(r => setTimeout(r, 2000));
        } else {
            // Try 'Enter' key
            if (passInp) {
                await passInp.press('Enter');
                await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { });
            }
        }

    } catch (e: any) {
        console.error(`âŒ [Auth] Login Failed: ${e.message}`);
        // Do not throw, allow public scraping attempt
    }
};

// Pagination Helper
export const handleInfiniteScroll = async (page: Page, jobId?: string) => {
    console.log("ðŸ“œ [Pagination] Starting Infinite Scroll & Load More sequence...");
    let previousHeight = 0;
    let noChangeCount = 0;
    const MAX_SCROLLS = 30; // Safety limit

    // Keywords for "Load More" buttons
    const loadMoreKeywords = ['load more', 'show more', 'view more', 'see more', 'altro', 'ver mais', 'mostrar mÃ¡s', 'afficher plus', 'mehr anzeigen', 'loading'];

    const emitStatus = (msg: string) => {
        if (!jobId || !io) return;
        if (jobId.startsWith('scan_')) {
            io.emit('scan-status', { scanJobId: jobId, message: msg });
        } else {
            io.emit('job-progress', { jobId, status: 'running', message: msg, progress: 0 });
        }
    };

    for (let i = 0; i < MAX_SCROLLS; i++) {
        // Frequency abort check
        if (page.isClosed()) throw new Error("Page closed during scroll");

        // CHECK TOKEN/SIGNAL (Assuming jobId is passed, check global tokens or signal)
        // Since we don't pass signal here yet, we rely on page.isClosed() which stopJob calls.
        // But let's limit MAX_SCROLLS significantly for PDPs if possible.
        // For now, just ensure we don't hang on 'Waiting for growth' forever.


        previousHeight = await page.evaluate('document.body.scrollHeight') as number;
        emitStatus(`ðŸ“œ Carregando conteÃºdo (${i + 1}/${MAX_SCROLLS})...`);

        // 1. Scroll to bottom
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 1000)); // Wait for lazy load

        // 2. Look for "Load More" buttons and Click
        const clicked = await page.evaluate((keywords) => {
            // Priority 1: Specific Selectors known to be used (Fima uses .js-show-more)
            const specificSelectors = ['.js-show-more', '.lmp_button', '.load-more', '.btn-load-more', '.show-more-button', '.wp-block-button__link'];
            for (const sel of specificSelectors) {
                const el = document.querySelector(sel) as HTMLElement;
                if (el && el.offsetParent !== null) {
                    // Safety check: text should be reasonable for a button
                    const text = el.innerText.toLowerCase().trim();
                    if (text.length > 0 && text.length < 50) {
                        el.click();
                        return { type: 'selector', text, sel };
                    }
                }
            }

            // Priority 2: Keyword-based discovery
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
            const target = buttons.find(el => {
                const text = (el.textContent || '').toLowerCase().trim();
                const isVisible = (el as HTMLElement).offsetParent !== null;
                if (el.tagName === 'A') {
                    const href = el.getAttribute('href');
                    // Avoid standard links that lead away, but allow # or javascript anchors
                    if (href && href.startsWith('http') && !href.includes('#')) return false;
                }
                return isVisible && keywords.some(k => text.includes(k) && text.length < 25);
            });

            if (target) {
                (target as HTMLElement).click();
                return { type: 'keyword', text: target.textContent?.trim() };
            }
            return null;
        }, loadMoreKeywords);

        if (clicked) {
            console.log(`ðŸ“œ [Pagination] Clicked '${clicked.text}' button (${clicked.type}). Waiting for growth...`);
            await new Promise(r => setTimeout(r, 3000)); // Slightly longer for Fima

            // IMMEDIATE GROWTH CHECK after click
            const growthHeight = await page.evaluate('document.body.scrollHeight') as number;

            // For AJAX loads, sometimes scrollHeight doesn't change immediately but DOM does.
            // However, for Fima it usually does grow as new items are added to the list.
            if (growthHeight <= previousHeight) {
                // Try a small scroll to trigger any lazy-load observers that might have been waiting
                await page.evaluate('window.scrollBy(0, 50)');
                await new Promise(r => setTimeout(r, 500));
                const secondGrowthCheck = await page.evaluate('document.body.scrollHeight') as number;

                if (secondGrowthCheck <= previousHeight) {
                    console.log("ðŸ“œ [Pagination] Clicked but no growth detected after fallback. Stopping.");
                    break;
                }
            }
        }

        // 3. Scroll up a bit (trigger IntersectionObserver)
        await page.evaluate('window.scrollBy(0, -300)');
        await new Promise(r => setTimeout(r, 800));

        // 4. Final height check for this iteration
        const newHeight = await page.evaluate('document.body.scrollHeight') as number;

        if (newHeight <= previousHeight) {
            noChangeCount++;
            if (noChangeCount >= 2) break;
        } else {
            noChangeCount = 0;
            console.log(`ðŸ“œ [Pagination] Content grew: ${previousHeight} -> ${newHeight}`);
        }

        // Safety: If height is getting insane, stop
        if (newHeight > 60000) break;
    }
    console.log("ðŸ“œ [Pagination] Finished sequence.");
};

// Start Helper for Interaction
export const performHeuristicInteractions = async (page: Page, signal?: AbortSignal) => {
    try {
        const keywords = ["3D", "Tech", "Sheet", "Model", "DESCRIZIONE", "CARATTERISTICHE", "CERTIFICAZIONI", "RICAMBI", "AWARDS", "FINITURE", "MANIGLIE", "DOWNLOAD", "SCARICA"];
        console.log("🖱️ [Heuristic] Scanning for interaction candidates...");

        for (const kw of keywords) {
            if (signal?.aborted) throw new Error('AbortError');
            // Find candidates count first
            const candidateCount = await page.evaluate((k: string) => {
                const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                return result.snapshotLength;
            }, kw);

            const limit = Math.min(candidateCount as number, 3);

            for (let i = 0; i < limit; i++) {
                if (signal?.aborted) throw new Error('AbortError');
                try {
                    const clicked = await page.evaluate((k: string, idx: number) => {
                        const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        const el = result.snapshotItem(idx) as HTMLElement;

                        if (el && el.offsetParent) { // simple visibility check
                            // Safety: Do not click navigation links
                            if (el.tagName === 'A') {
                                const href = el.getAttribute('href');
                                if (href && href.length > 2 && !href.startsWith('#') && !href.startsWith('javascript:')) return false;
                            }

                            const cls = (el.className || '').toString().toLowerCase();
                            // Avoid clicking login/cart links
                            if (!cls.includes('login') && !cls.includes('cart') && !cls.includes('nav')) {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    }, kw, i);

                    if (clicked) {
                        console.log(`ðŸ–±ï¸ [Heuristic] Clicked candidate "${kw}" index ${i}`);
                        await new Promise(r => setTimeout(r, 800)); // Wait for reaction
                    }
                } catch (e) { }
            }
        }
    } catch (e) { /* Ignore interaction errors */ }
};

export const handleCookieConsent = async (page: Page) => {
    try {
        console.log("🍪 [Cookies] Checking for consent dialogs...");
        // 1. Ritmonio / Cookiebot (Priority)
        try {
            // Detect modal #CybotCookiebotDialog
            const cookiebotDialog = await page.$('#CybotCookiebotDialog');
            if (cookiebotDialog) {
                console.log("🍪 [Cookies] Cookiebot detected.");
                // Click 'Allow All' - try multiple ID variations
                const allowIds = [
                    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
                    '#CybotCookiebotDialogBodyButtonAccept',
                    '#CybotCookiebotDialogBodyButtonDecline', // Beware mechanism
                    '.CybotCookiebotDialogBodyButton'
                ];

                let clicked = false;
                for (const id of allowIds) {
                    const btn = await page.$(id);
                    if (btn) {
                        const text = await page.evaluate(el => (el as HTMLElement).innerText, btn);
                        if (text && (text.toLowerCase().includes('allow') || text.toLowerCase().includes('accept') || text.toLowerCase().includes('accetta'))) {
                            console.log(`🍪 [Cookies] Clicking Cookiebot Accept: ${id} (${text})`);
                            await btn.click();
                            clicked = true;
                            break;
                        }
                        if (id.includes('AllowAll') || id.includes('Accept')) {
                            console.log(`🍪 [Cookies] Clicking Cookiebot Accept: ${id}`);
                            await btn.click();
                            clicked = true;
                            break;
                        }
                    }
                }

                if (!clicked) {
                    clicked = await page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('button, a'));
                        const target = btns.find(b => {
                            const t = (b as HTMLElement).innerText || '';
                            return t.toLowerCase().includes('allow all') || t.toLowerCase().includes('accetta tutti');
                        });
                        if (target) {
                            (target as HTMLElement).click();
                            return true;
                        }
                        return false;
                    });
                    if (clicked) console.log(`🍪 [Cookies] Clicked 'Allow/Accept' via text fallback.`);
                }

                if (clicked) {
                    await page.waitForFunction(() => !document.querySelector('#CybotCookiebotDialog'), { timeout: 5000 }).catch(() => { });
                    console.log("🍪 [Cookies] Cookiebot cleared.");
                    return;
                }
            }
        } catch (botErr) {
            console.warn("⚠️ Cookiebot specific verify failed", botErr);
        }

        // Generic & Specific Selectors for Cookie Consent
        const cookieSelectors = [
            '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // Cookiebot
            'button[id*="cookie"][id*="accept"]',
            'button[class*="cookie"][class*="accept"]',
            'button[id*="consent"][id*="accept"]',
            'a[id*="cookie"][id*="accept"]'
        ];

        for (const sel of cookieSelectors) {
            try {
                const btn = await page.$(sel);
                if (btn) {
                    const vis = await btn.boundingBox();
                    if (vis) {
                        console.log(`ðŸª [Cookies] Found and clicking consent button: ${sel}`);
                        await btn.click();
                        console.log("ðŸ ª [Cookies] Clicked. Waiting 5s for settling...");
                        await new Promise(r => setTimeout(r, 5000)); // Increased wait for dismissal/reload
                        return; // Found one, assume done
                    }
                }
            } catch (e) { }
        }
    } catch (e) {
        console.warn("âš ï¸ Cookie handling error:", e);
    }
};
// --- COMPLEX EXTRACTION: VARIANTS & ASSOCIATED PRODUCTS ---

/**
 * Detects and extracts product variants (finishes/colors).
 * Specific logic for Fima (iframe 3D) and generic fallback for swatches.
 */
export const handleProductVariants = async (page: Page): Promise<any[]> => {
    const variants: any[] = [];
    try {
        const url = page.url();
        console.log(`ðŸŽ¨ [Variants] Checking variants for: ${url}`);

        // 1. FIMA CONFIGURATOR (Iframe Canvas)
        const fimaIframe = await page.$('iframe#iframe[src*="config.fimacf.com"]');
        if (fimaIframe) {
            console.log("ðŸŽ¨ [Variants] Detected Fima 3D Configurator. Switching to iframe...");
            const frame = await fimaIframe.contentFrame();
            if (frame) {
                try {
                    await frame.waitForSelector('.item', { timeout: 10000 });
                    // SIMPLIFICATION: extract only the code/metadata, DO NOT capture heavy images for variants as requested.
                    console.log("ðŸŽ¨ [Variants] Fima: Skipping image extraction to keep it lightweight.");
                    await new Promise(r => setTimeout(r, 800));

                    // Skip heavy canvas snapshot for Fima as requested by user
                    const canvasImage = null;

                    // Try to get SKU from iframe
                    let sku = 'DEFAULT';
                    const dynamicSku = await frame.evaluate(() => {
                        const el = document.querySelector('.code, .sku, .ref, .product-code');
                        return el ? el.textContent?.trim() : null;
                    });
                    if (dynamicSku && dynamicSku.length > 3) sku = dynamicSku;

                    if (sku) {
                        variants.push({ name: 'Chrome', image: null, code: sku, isDefault: true });
                    }
                } catch (e: any) {
                    console.error("ðŸŽ¨ [Variants] Fima Iframe Error:", e.message);
                }
            }
            return variants;
        }

        // 2. GENERIC SWATCH DETECTION (WooCommerce, etc.)
        const swatches = await page.evaluate(() => {
            const selectors = ['.swatch', '.variable-item', '.tmcp-field-wrap', '.finiture-item'];
            const found: any[] = [];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    const name = el.getAttribute('data-value') || el.getAttribute('title') || el.textContent?.trim();
                    if (name) found.push({ name, selector: sel });
                });
            });
            return found;
        });

        if (swatches.length > 0) {
            console.log(`ðŸŽ¨ [Variants] Found ${swatches.length} generic swatches.`);
            // Implement generic click-and-wait-for-image-update logic here if needed
        }

    } catch (e: any) {
        console.error("ðŸŽ¨ [Variants] Discovery failed:", e.message);
    }
    return variants;
};

/**
 * Detects necessary associated products (e.g., interior parts, corpo incasso).
 */
export const handleAssociatedProducts = async (page: Page): Promise<any[]> => {
    const associated: any[] = [];
    try {
        console.log(`ðŸ”— [Associated] Checking for required components...`);

        const links = await page.evaluate(() => {
            const results: any[] = [];
            // Keywords for "Required" or "Order separately"
            const keywords = ['PRODOTTI DA ORDINARE SEPARATAMENTE', 'PRODOTTI NECESSARI', 'ordinare separatamente', 'order separately', 'necessario', 'required', 'corpo incasso'];

            // Strategy A: Find sections by Strict Headers (ONLY if very explicit)
            const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, strong, .title'));
            const requiredSections = allElements.filter(el => {
                const txt = el.textContent?.trim() || '';
                return txt.length < 80 && keywords.some(k => txt.toUpperCase().includes(k.toUpperCase()))
                    && !txt.toUpperCase().includes('CORRELATI') // Skip "Related"
                    && !txt.toUpperCase().includes('CONSIGLIATI'); // Skip "Recommended"
            });

            requiredSections.forEach(section => {
                // Find links within or near this section (specifically for Fima Recessed parts)
                // Look for links that usually contain 'prodotto' or 'product'
                // Often in Fima: <a>Name <br> Ref</a>
                const anchors = Array.from(section.querySelectorAll('a[href]'));
                anchors.forEach(a => {
                    const href = (a as HTMLAnchorElement).href;
                    if (href.includes('/prodotto/') || href.includes('/product/')) {
                        results.push({
                            name: a.textContent?.trim().replace(/\s+/g, ' ') || 'Associated Part',
                            url: href,
                            ref: a.textContent?.match(/F\d+[A-Z0-9]+/)?.[0] || '', // Heuristic for Fima Ref
                            type: 'REQUIRED', // Explicitly mark as required
                            is_required: true
                        });
                    }
                });
            });

            // Strategy B: Specific Fima ".popup-side" or generic associated product containers
            document.querySelectorAll('.popup-side, .associated-products, .related-products').forEach(container => {
                container.querySelectorAll('a[href]').forEach(a => {
                    if (!results.find(r => r.url === (a as HTMLAnchorElement).href)) {
                        results.push({
                            name: a.textContent?.trim() || 'Associated Part',
                            url: (a as HTMLAnchorElement).href,
                            is_required: true
                        });
                    }
                });
            });

            return results;
        });

        if (links.length > 0) {
            console.log(`ðŸ”— [Associated] Found ${links.length} potential components.`);
            associated.push(...links);
        }

    } catch (e: any) {
        console.error("ðŸ”— [Associated] Discovery failed:", e.message);
    }
    return associated;
};

/**
 * Resolves a SKU code to a product detail URL by using the brand's search page.
 * @param options Resolution options (names, barcode, etc.)
 */
export const resolveSkuToUrl = async (brandProfileId: string, sku: string, options: { names?: string[], barcode?: string } = {}): Promise<string | null> => {
    let browser: Browser | null = null;
    let ownBrowser = false;
    let page: Page | null = null; // Fix: Initialize properly

    // Clean SKU
    let cleanSku = sku.replace(/\//g, '').replace(/\./g, '').trim().toUpperCase();
    console.log(`ðŸ”Ž Resolving SKU: ${cleanSku}`);

    // Determine Brand Domain
    const db = getCeDatabase();
    const profile = db.prepare('SELECT domain_root FROM ce_brand_profiles WHERE id = ?').get(brandProfileId) as any;
    if (!profile) throw new Error("Profile not found");
    // Ensure protocol for URL parsing if missing
    const root = profile.domain_root.startsWith('http') ? profile.domain_root : `https://${profile.domain_root}`;
    const domain = new URL(root).host;
    const isFima = domain.includes('fimacf') || domain.includes('fima');
    console.log(`[Resolve] Domain: ${domain}, isFima: ${isFima}`);

    // STRATEGY: FIMA DIRECT URL + REDUCER (Bypasses broken Search)
    if (isFima) {
        console.log(`ðŸ”  [Fima Strategy] Using Direct URL Construction for "${cleanSku}"`);
        try {
            const axios = (await import('axios')).default;
            // FIX: Use RAW 'sku' to preserve slashes, then clean.
            // F6000/30 -> f6000-30
            let currentSku = sku.trim().replace(/[\/\.]/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            const history = new Set<string>();

            // Generate Slug Candidates
            const slugs: string[] = [];
            const slugify = (text: string) => text.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                .trim()
                .replace(/\s+/g, '-');

            if (options.names?.length) {
                options.names.forEach(n => {
                    if (!n) return;
                    const s = slugify(n);
                    if (s) slugs.push(s);
                    const first = s.split('-')[0];
                    if (first && first.length > 2) slugs.push(first);
                });
            }
            // Fallbacks
            slugs.push('miscelatore');
            slugs.push('rubinetto');
            slugs.push('set');
            const uniqueSlugs = [...new Set(slugs)]; // Deduplicate

            console.log(`ðŸ”  [Fima Strategy] Candidates Slugs: ${uniqueSlugs.join(', ')}`);

            // Loop: Check URL -> Fail -> Reduce SKU -> Repeat
            while (currentSku.length >= 3) {
                if (history.has(currentSku)) break;
                history.add(currentSku);

                // Inner Loop: Try all slugs for this SKU
                // Optimization: Try "SKU + Generic" first? No, try Specific first.
                for (const slug of uniqueSlugs) {
                    const targetUrl = `https://fimacf.com/prodotto/${currentSku.toLowerCase()}-${slug}/`;
                    // console.log(`ðŸŒ  [Fima Check] GET ${targetUrl}`);

                    try {
                        const res = await axios.get(targetUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            timeout: 8000, // Faster timeout
                            validateStatus: (status) => status === 200
                        });

                        if (res.status === 200) {
                            const finalUrl = res.request?.res?.responseUrl || res.config.url;
                            console.log(`âœ… [Fima Success] Found Match: ${finalUrl}`);
                            return finalUrl;
                        }
                    } catch (e: any) {
                        // 404 or other error -> Continue
                    }
                }

                // Reduce SKU (Remove last char)
                currentSku = currentSku.slice(0, -1);
            }

            console.warn(`âš ï¸  [Fima Strategy] Exhausted all variations for ${cleanSku}`);
            return null;

        } catch (e: any) {
            console.error(`â Œ [Fima Strategy] Critical Error: ${e.message}`);
            return null;
        }
    }

    // GENERAL STRATEGY (Non-Fima Brands)
    try {
        // Use Fresh Browser for Resolution (Safety against zombies)
        // browser = await getSharedCrawlerBrowser();
        browser = await puppeteer.launch({
            headless: 'new' as any,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        ownBrowser = true; // We own the BROWSER now

        // Initial Query: Try Clean SKU first (Non-Fima Default)
        let searchUrl = `https://${domain.replace(/^https?:\/\//, '')}/?s=${encodeURIComponent(cleanSku)}&post_type=product`;

        // Custom Search Paths per brand
        if (domain.includes('ritmonio')) {
            searchUrl = `https://www.ritmonio.it/en/search?q=${encodeURIComponent(cleanSku)}`;
        }

        console.log(`ðŸ”Ž Navigating to Search: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // 1. Check for Direct Redirect (some sites redirect to product if 1 match)
        // Check URL pattern
        const currentUrl = page.url();
        if (currentUrl.includes('/product/') || currentUrl.includes('/prodotto/') || currentUrl.includes('/item/')) {
            console.log(`âœ… Direct Redirect detected to: ${currentUrl}`);
            return currentUrl;
        }

        // 2. Check for Search Results List
        // Selectors for product links in grid
        const resultSelectors = [
            '.product-title a', '.woocommerce-loop-product__title a', // Woo
            '.product-name a', '.product-item-link', // Magento
            '.grid-view-item__link', // Shopify
            '.search-result-item a', '.item a' // Generic
        ];

        // Evaluate in page
        const foundUrl = await page.evaluate((selectors, skuTarget) => {
            // Helper: Normalized text check
            const norm = (t: string) => t.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const target = norm(skuTarget);

            // A. Exact Match in List
            for (const sel of selectors) {
                const links = document.querySelectorAll(sel);
                for (let i = 0; i < links.length; i++) {
                    const l = links[i] as HTMLAnchorElement;
                    const txt = norm(l.textContent || '');
                    if (txt === target || txt.includes(target)) {
                        return l.href;
                    }
                }
            }

            // B. First Result Fallback (if list exists but no exact text match - risky but often correct)
            // Only if we are sure it's a search result page
            if (document.querySelector('.products') || document.querySelector('.search-results')) {
                const first = document.querySelector('.product a, .item a');
                if (first) return (first as HTMLAnchorElement).href;
            }

            return null;
        }, resultSelectors, cleanSku);

        if (foundUrl) {
            console.log(`âœ… Found Match in List: ${foundUrl}`);
            return foundUrl;
        }

        return null;

    } catch (e: any) {
        console.error(`âŒ Sku Resolution Failed: ${e.message}`);
        return null;
    } finally {
        if (page && !page.isClosed()) await page.close();
        if (ownBrowser && browser) {
            await browser.close();
            console.log("ðŸ§¹ Temporary Resolution Browser Closed.");
        }
        // Do NOT close browser if shared
    }
};
