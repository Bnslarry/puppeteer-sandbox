import express from 'express';
import { ssr, clearCache } from './ssr.mjs';

const app = express();

app.get('/', async (req, res, next) => {
  const {html, ttRenderMs} = await ssr(`${req.protocol}://localhost:3000`, '#posts');
  // Add Server-Timing! See https://w3c.github.io/server-timing/.
  res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`);
  return res.status(200).send(html); // Serve prerendered page as response.
});

app.get('/test', async (req, res, next) => {
  const {html, ttRenderMs} = await ssr(`${req.protocol}s://blog.cjw.design/blog/frontend/puppeteer-ssr`, '#root');
  // Add Server-Timing! See https://w3c.github.io/server-timing/.
  res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`);
  return res.status(200).send(html); // Serve prerendered page as response.
});

app.get('/shopeefood', async (req, res, next) => {
  const {html, ttRenderMs} = await ssr(`${req.protocol}s://shopeefood.vn`);
  // Add Server-Timing! See https://w3c.github.io/server-timing/.
  res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`);
  return res.status(200).send(html); // Serve prerendered page as response.
});

app.listen(8080, () => {
                          console.log('Server started. Press Ctrl+C to quit');
                          console.log('init job');
                          ssr(`https://shopeefood.vn`); 
                          setInterval( async () => {
                            clearCache()
                            console.log('clear cache')
                            console.log('Execu cron update job')
                            let html = await ssr(`https://shopeefood.vn`); 
                          }, 20000)
                       }
          );