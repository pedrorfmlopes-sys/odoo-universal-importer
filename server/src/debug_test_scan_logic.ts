// @ts-nocheck
import { ceAiService } from './modules/catalogEnricher/services/ceAiService';

async function test() {
    console.log("Testing usage...");
    try {
        const html = `<html><body><a href="/foo">Foo</a><a href="/bar">Bar</a></body></html>`;
        // We mock the DB or config if needed, but scanStructure mainly uses config from store.
        // It might fail on config loading if not mocked, but we'll see the import error first if that's the issue.

        // We might need to mock axios to avoid real AI call or just handle the error.
        // But the first step is Cheerio parsing which happens BEFORE AI call in my change.

        // Mocking config store if possible or just rely on env? 
        // Let's just run it.

        const tree = await ceAiService.scanStructure('example.com', html, false);
        console.log("Tree:", tree);
    } catch (e: any) {
        console.error("Test Error:", e);
        console.error("Stack:", e.stack);
    }
}

test();
