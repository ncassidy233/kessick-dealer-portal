// Real-browser compatibility checks for an installed client that predates the
// update listener. Run `node scripts/test-legacy-app-update.mjs`; use --serve
// for the same fixtures in an already-running browser when Chromium cannot be
// launched by the execution environment.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve-secure-static.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(repository, 'artifacts/kessick-visualizer/public');
const require = createRequire(path.join(repository, 'artifacts/kessick-visualizer/package.json'));

const appScript = `
const status = document.getElementById('status');
const modern = document.body.dataset.release === 'new';
const acknowledgements = new URL(location.href).searchParams.has('ack');
if (modern || acknowledgements) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'KESSICK_RELEASE_READY') {
      event.source?.postMessage({type:'KESSICK_UPDATE_CLIENT'});
      document.getElementById('notice').textContent = 'Modern client acknowledged update';
    }
  });
  navigator.serviceWorker.controller?.postMessage({type:'KESSICK_UPDATE_CLIENT'});
}
async function database() {
  return new Promise((resolve,reject) => {
    const request=indexedDB.open('legacy-upgrade-test',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function readDraft() {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('drafts').objectStore('drafts').get('quote');
    request.onsuccess=()=>{db.close();resolve(request.result)};
    request.onerror=()=>{db.close();reject(request.error)};
  });
}
async function displayStorage() {
  const names=await caches.keys();
  document.getElementById('storage').textContent=JSON.stringify({
    draft:localStorage.getItem('saved-quote'),
    cookie:document.cookie.includes('fixture-session=approved-user'),
    indexedDB:await readDraft(),
    unrelatedCache:names.includes('unrelated-test-cache'),
    legacyCache:names.some(name=>name.startsWith('kessick-portal-'))
  });
}
document.getElementById('seed').onclick=async()=>{
  localStorage.setItem('saved-quote','Customer draft 42');
  document.cookie='fixture-session=approved-user; path=/; SameSite=Lax';
  const db=await database();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');
    tx.objectStore('drafts').put('Saved layout 73','quote');
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
  await (await caches.open('kessick-portal-old-demo')).put('/old-document',new Response('old cached app'));
  await (await caches.open('unrelated-test-cache')).put('/other-data',new Response('keep me'));
  await displayStorage(); status.textContent='Saved draft, cookie, IndexedDB and cache markers';
};
document.getElementById('inspect').onclick=displayStorage;
document.getElementById('upgrade').onclick=async()=>{
  await fetch('/__fixture/deploy',{method:'POST'});
  const registration=await navigator.serviceWorker.getRegistration('/');
  await registration.update();
  status.textContent='New worker requested';
};
document.getElementById('reset').onclick=async()=>{
  for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
  await fetch('/__fixture/reset',{method:'POST'});
  location.replace('/?case=legacy');
};
document.getElementById('missing').onclick=async()=>{
  for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
  await fetch('/__fixture/missing',{method:'POST'});
  location.replace('/portal/projects?view=saved#draft');
};
if(!modern) {
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)location.reload();
  else status.textContent='Legacy worker ready';
}
await displayStorage();
if(modern) status.textContent='Current app ready';
`;

function appHtml(release) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Kessick update test</title>${release === 'new' ? '<script src="/app-start.js" defer></script>' : ''}</head><body data-release="${release}">
  <h1>${release === 'new' ? 'Current portal fixture' : 'Legacy portal fixture'}</h1>
  <p id="status">Starting…</p><p id="notice"></p>
  <label>Unsaved work <input id="unsaved" value="Unsent estimate"></label>
  <p><button id="seed">Save test data</button> <button id="inspect">Inspect saved data</button></p>
  <p><button id="upgrade">Deploy new worker</button> <button id="reset">Reset to legacy app</button> <button id="missing">Open cached HTML with missing entry</button></p>
  <p><a href="/admin/page-studio">Open legacy editor</a> <a href="/#draft">Open hash form</a> <a href="/?ack=1">Open modern acknowledgement client</a></p>
  <pre id="storage"></pre><script type="module" src="/fixture-app.js"></script></body></html>`;
}

export async function createUpgradeFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'kessick-legacy-browser-'));
  const legacyWorker = await readFile(new URL('./fixtures/legacy-notification-sw.js', import.meta.url), 'utf8');
  for (const file of ['app-update.html','app-update.js','app-start.js','kessick-logo-white.svg']) {
    await copyFile(path.join(publicDirectory,file),path.join(directory,file));
  }
  await writeFile(path.join(directory,'fixture-app.js'),appScript);
  let missing = false;
  async function reset() {
    missing = false;
    await writeFile(path.join(directory,'sw.js'),legacyWorker);
    await writeFile(path.join(directory,'index.html'),appHtml('old'));
  }
  async function deploy() {
    await copyFile(path.join(publicDirectory,'sw.js'),path.join(directory,'sw.js'));
    await writeFile(path.join(directory,'index.html'),appHtml('new'));
  }
  await reset();
  const server = await createStaticServer(directory,'/',undefined);
  const staticHandler = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', async (request,response) => {
    const url = new URL(request.url,'http://fixture.invalid');
    if (request.method === 'POST' && url.pathname.startsWith('/__fixture/')) {
      try {
        if(url.pathname === '/__fixture/reset') await reset();
        else if(url.pathname === '/__fixture/deploy') await deploy();
        else if(url.pathname === '/__fixture/missing') { await deploy(); missing = true; }
        else { response.writeHead(404); response.end(); return; }
        response.writeHead(204); response.end();
      } catch(error) { response.writeHead(500); response.end(String(error)); }
      return;
    }
    if(missing && url.pathname === '/portal/projects' && !url.searchParams.has('_kessick_update')) {
      // Only the stale document is synthetic. Its removed index request goes
      // through the real production static handler and actual recovery assets.
      missing = false;
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end('<!doctype html><title>Cached old portal HTML</title><h1>Old cached document</h1><script type="module" src="/assets/index-retired123.js"></script>');
      return;
    }
    return staticHandler(request,response);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return {
    origin:`http://127.0.0.1:${server.address().port}`,
    reset,deploy,
    async close(){ server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true}); },
  };
}

async function runBrowserChecks(fixture) {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
    headless:!process.argv.includes('--headed'),
    args:['--no-sandbox'],
  });
  async function scenario(name,run) {
    await fixture.reset();
    const context=await browser.newContext();
    const page=await context.newPage();
    page.setDefaultTimeout(12_000);
    try {await run(page,context);console.log('PASS '+name);} finally {await context.close();}
  }
  async function oldPage(page,route='/') {
    await page.goto(fixture.origin+route);
    await page.getByText('Legacy worker ready',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Save test data',exact:true}).click();
    await page.getByText('Saved draft, cookie, IndexedDB and cache markers',{exact:true}).waitFor();
  }
  async function verifySaved(page) {
    const saved=JSON.parse(await page.locator('#storage').innerText());
    assert.equal(saved.draft,'Customer draft 42');
    assert.equal(saved.cookie,true);
    assert.equal(saved.indexedDB,'Saved layout 73');
    assert.equal(saved.unrelatedCache,true);
    assert.equal(saved.legacyCache,false);
  }
  try {
    await scenario('foreground legacy home gets working update prompt; saved data survives',async page=>{
      await oldPage(page,'/?view=saved');
      await page.getByRole('button',{name:'Deploy new worker',exact:true}).click();
      await page.getByRole('heading',{name:'Portal update ready',exact:true}).waitFor();
      await page.getByRole('button',{name:'Update now',exact:true}).click();
      await page.getByText('Current app ready',{exact:true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('view'),'saved');
      await verifySaved(page);
    });
    for(const route of ['/admin/page-studio','/#draft']) {
      await scenario('legacy work stays in place: '+route,async page=>{
        await oldPage(page,route);
        await page.locator('#unsaved').fill('Unsaved customer estimate');
        await page.getByRole('button',{name:'Deploy new worker',exact:true}).click();
        await page.waitForTimeout(2500);
        assert.equal(page.url(),fixture.origin+route);
        assert.equal(await page.locator('#unsaved').inputValue(),'Unsaved customer estimate');
      });
    }
    await scenario('modern update acknowledgement prevents legacy migration',async page=>{
      await oldPage(page,'/?ack=1');
      await page.getByRole('button',{name:'Deploy new worker',exact:true}).click();
      await page.getByText('Modern client acknowledged update',{exact:true}).waitFor();
      await page.waitForTimeout(2000);
      assert.equal(new URL(page.url()).pathname,'/');
      assert.equal(await page.locator('h1').innerText(),'Legacy portal fixture');
    });
    await scenario('offline update keeps the recovery prompt until reconnection',async (page,context)=>{
      await oldPage(page);
      await page.getByRole('button',{name:'Deploy new worker',exact:true}).click();
      await page.getByRole('heading',{name:'Portal update ready',exact:true}).waitFor();
      const promptUrl=page.url();
      await context.setOffline(true);
      await page.getByRole('button',{name:'Update now',exact:true}).click();
      await page.getByText('You are offline. Reconnect, then tap Update now.',{exact:true}).waitFor();
      assert.equal(page.url(),promptUrl);
      await context.setOffline(false);
      await page.getByRole('button',{name:'Update now',exact:true}).click();
      await page.getByText('Current app ready',{exact:true}).waitFor();
      await verifySaved(page);
    });
    await scenario('missing historical entry recovers without old app-start or worker',async page=>{
      await oldPage(page);
      await page.getByRole('button',{name:'Open cached HTML with missing entry',exact:true}).click();
      await page.getByRole('heading',{name:'Portal update ready',exact:true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('returnTo'),'/portal/projects?view=saved');
      assert.equal(new URL(page.url()).hash,'#draft');
      await page.getByRole('button',{name:'Update now',exact:true}).click();
      await page.getByText('Current app ready',{exact:true}).waitFor();
      const url=new URL(page.url());
      assert.equal(url.pathname,'/portal/projects');
      assert.equal(url.searchParams.get('view'),'saved');
      assert.equal(url.hash,'#draft');
      await verifySaved(page);
    });
  } finally {await browser.close();}
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture=await createUpgradeFixture();
  console.log('Legacy update fixture: '+fixture.origin);
  if(process.argv.includes('--serve')) {
    const close=async()=>{await fixture.close();process.exit(0)};
    process.once('SIGTERM',close);process.once('SIGINT',close);
  } else {
    try {await runBrowserChecks(fixture);} finally {await fixture.close();}
  }
}
