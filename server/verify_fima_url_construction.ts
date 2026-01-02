
import axios from 'axios';

async function verifyUrl(url: string, description: string) {
    console.log(`\nTesting: ${url}`);
    console.log(`Scenario: ${description}`);
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            validateStatus: () => true,
            // maxRedirects: 5 // Default
        });

        console.log(`Status: ${res.status}`);
        if (res.headers.location) {
            console.log(`Redirects To: ${res.headers.location}`);
        }
        return res.status;
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
        return 0;
    }
}

async function run() {
    const sku = 'f3051twx8';
    const italianSlug = 'miscelatore-lavabo-a-parete';

    // 1. The "Holy Grail" - SKU Only
    await verifyUrl(
        `https://fimacf.com/prodotto/${sku}/`,
        "1. SKU Only (Does it redirect?)"
    );

    // 2. The "Lazy Slug" - SKU + Garbage
    await verifyUrl(
        `https://fimacf.com/prodotto/${sku}-blahblah/`,
        "2. SKU + Incorrect Slug (Is slug validated?)"
    );

    // 3. The "Correct Italian" - SKU + Italian Slug    // 5. Variant SKU + Correct Base Slug
    // 9. Force Italian Locale
    await verifyUrl(
        `https://fimacf.com/it/prodotto/${sku}/`,
        "9. /it/prodotto/SKU/"
    );

    // 10. Force English Locale
    await verifyUrl(
        `https://fimacf.com/en/product/${sku}/`,
        "10. /en/product/SKU/"
    );

    // 11. Force Italian (No /it/ prefix but header?)
    // Just locale prefix first.

    // 12. Try appending "fima" (Brand name) as slug?
    await verifyUrl(
        `https://fimacf.com/prodotto/${sku}-fima/`,
        "12. SKU + 'fima' slug"
    );
    // 13. Test F6000
    const f6000 = 'f6000';
    await verifyUrl(
        `https://fimacf.com/prodotto/${f6000}-portasalviette-30-cm/`,
        "13. F6000 + Slug"
    );
    // 15. Hyphenated Slash Test
    await verifyUrl(
        `https://fimacf.com/prodotto/f6000-30-portasalviette-30-cm/`,
        "15. F6000-30 (Slash -> Hyphen)"
    );
    await verifyUrl(
        `https://fimacf.com/prodotto/f6000-30cr-portasalviette-30-cm/`,
        "16. F6000-30CR (Slash -> Hyphen)"
    );
    await verifyUrl(
        `https://fimacf.com/prodotto/f6000-30/`,
        "17. F6000-30 (Short)"
    );
    /*
    await verifyUrl(
        `https://fimacf.com/prodotto/${variantSku}-${slug}/`,
        "5. Variant SKU + Correct Base Slug"
    );
    */

    // Test a simpler SKU from previous attempts
    const simple = 'f5603x4';
    await verifyUrl(
        `https://fimacf.com/prodotto/${simple}/`,
        "6. Valid SKU F5603X4 (Short - Expect 301)"
    );
    await verifyUrl(
        `https://fimacf.com/prodotto/${simple}-miscelatore/`,
        "7. Valid SKU F5603X4 + Generic Slug (Expect 404?)"
    );
    // Try without trailing slash
    await verifyUrl(
        `https://fimacf.com/prodotto/${simple}`,
        "8. Valid SKU F5603X4 (No Slash)"
    );
    // 4. Variant Test
    const variantRoot = 'f3051twx8';
    await verifyUrl(
        `https://fimacf.com/prodotto/${variantRoot}-${italianSlug}/`,
        "6. Variant Root + Italian Slug (Reducer Logic Target)"
    );
}

run();
