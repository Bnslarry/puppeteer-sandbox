import puppeteer from 'puppeteer';

const RENDER_CACHE = new Map();
let browserWSEndpoint = null;

async function ssr(url, rootElementTag = '#app') {
    if (RENDER_CACHE.has(url)) {
        return {html: RENDER_CACHE.get(url), ttRenderMs: 0};
    }

    const start = Date.now();

    let html = null
    if (!browserWSEndpoint) {
        const browser = await puppeteer.launch();
        browserWSEndpoint = await browser.wsEndpoint();
        const page = await browser.newPage();
        html = await puppetSSR(page, url, rootElementTag)
    }
    else {
        console.info('Connecting to existing Chrome instance.');
        const browser = await puppeteer.connect({browserWSEndpoint});
        const page = await browser.newPage();
        html = await puppetSSR(page, url, rootElementTag)
    }
    
    const ttRenderMs = Date.now() - start;
    console.info(`Headless rendered page in: ${ttRenderMs}ms`);
    
    RENDER_CACHE.set(url, html); // cache rendered page.
    
    return {html, ttRenderMs};
}

async function puppetSSR(page, url, rootElementTag) {
    await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36'
     );

    //const WHITE_LIST_RESOURE_TYPE = ['document', 'xhr', 'fetch', 'script', 'text/html', 'preflight'];
    // 谷歌百度统计相关请求屏蔽
    const BLACK_LIST_REQUEST_URL = [
        'www.google-analytics.com',
        '/gtag/js',
        'ga.js',
        'analytics.js',
        'hm.baidu.com',
        'hm.js',
    ];

    try {
        // 开启请求拦截器功能
        await page.setRequestInterception(true);
        page.on('request', req => {
            /* 非白名单资源请求直接抛弃 */
            // if (!WHITE_LIST_RESOURE_TYPE.includes(req.resourceType())) {
            //   return req.abort();
            // }
            /* 黑名单请求，例如统计代码抛弃 */
            if (BLACK_LIST_REQUEST_URL.some(url => req.url().includes(url))) {
              return req.abort();
            }
            /* 其他请求正常运行 */
            req.continue();
          });

        // const stylesheetContents = {};

        // page.on('request', req => {
        //     // 2. Ignore requests for resources that don't produce DOM
        //     // (images, stylesheets, media).
        //     const allowlist = ['document', 'script','stylesheet', 'xhr', 'fetch'];
        //     if (!allowlist.includes(req.resourceType())) {
        //       return req.abort();
        //     }
        
        //     // 3. Pass through all other requests.
        //     req.continue();
        //   });

        // page.on('response', async resp => {
        //     const responseUrl = resp.url();
        //     const sameOrigin = new URL(responseUrl).origin === new URL(url).origin;
        //     const isStylesheet = resp.request().resourceType() === 'stylesheet';
        //     if (sameOrigin && isStylesheet) {
        //         stylesheetContents[responseUrl] = await resp.text();
        //     }
        // });

        // networkidle0 waits for the network to be idle (no requests for 500ms).
        // The page's JS has likely produced markup by this point, but wait longer
        // if your site lazy loads, etc.
        // 当在至少500ms的时间内没有超过0个网络连接时，导航就完成了。
        await page.goto(url, {waitUntil: 'networkidle0'});

        await page.waitForSelector(rootElementTag); // ensure #app exists in the DOM.

        // Replace stylesheets in the page with their equivalent <style>.
        // await page.$$eval('link[rel="stylesheet"]', (links, content) => {
        //     links.forEach(link => {
        //         const cssText = content[link.href];
        //         if (cssText) {
        //             const style = document.createElement('style');
        //             style.textContent = cssText;
        //             link.replaceWith(style);
        //         }
        //     });
        // }, stylesheetContents);
    } catch (err) {
        console.error(err);
        throw new Error('page.goto/waitForSelector timed out.');
    }
    
    const html = await page.content(); // serialized HTML of page DOM.
    await page.close();
    return html
}

function clearCache() {
    RENDER_CACHE.clear();
  }
  
export {ssr, clearCache};