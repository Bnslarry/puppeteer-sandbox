import puppeteer from 'puppeteer';

const RENDER_CACHE = new Map();

async function ssr(url, rootElementTag = '#app') {
    if (RENDER_CACHE.has(url)) {
        return {html: RENDER_CACHE.get(url), ttRenderMs: 0};
    }

    const start = Date.now();

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // 1. Intercept network requests.
    await page.setRequestInterception(true);

    try {
        const stylesheetContents = {};

        page.on('request', req => {
            // 2. Ignore requests for resources that don't produce DOM
            // (images, stylesheets, media).
            const allowlist = ['document', 'script','stylesheet', 'xhr', 'fetch'];
            if (!allowlist.includes(req.resourceType())) {
              return req.abort();
            }
        
            // 3. Pass through all other requests.
            req.continue();
          });

        page.on('response', async resp => {
            const responseUrl = resp.url();
            const sameOrigin = new URL(responseUrl).origin === new URL(url).origin;
            const isStylesheet = resp.request().resourceType() === 'stylesheet';
            if (sameOrigin && isStylesheet) {
                stylesheetContents[responseUrl] = await resp.text();
            }
        });

        // networkidle0 waits for the network to be idle (no requests for 500ms).
        // The page's JS has likely produced markup by this point, but wait longer
        // if your site lazy loads, etc.
        // 当在至少500ms的时间内没有超过0个网络连接时，导航就完成了。
        await page.goto(url, {waitUntil: 'networkidle0'});

        await page.waitForSelector(rootElementTag); // ensure #app exists in the DOM.

        // Replace stylesheets in the page with their equivalent <style>.
        await page.$$eval('link[rel="stylesheet"]', (links, content) => {
            links.forEach(link => {
                const cssText = content[link.href];
                if (cssText) {
                    const style = document.createElement('style');
                    style.textContent = cssText;
                    link.replaceWith(style);
                }
            });
        }, stylesheetContents);
    } catch (err) {
        console.error(err);
        throw new Error('page.goto/waitForSelector timed out.');
    }
    
    const html = await page.content(); // serialized HTML of page DOM.
    await browser.close();
    
    const ttRenderMs = Date.now() - start;
    console.info(`Headless rendered page in: ${ttRenderMs}ms`);
    
    RENDER_CACHE.set(url, html); // cache rendered page.
    
    return {html, ttRenderMs};
}

export {ssr as default};