// Mock APIs only. Run: node tests/admin-plan-browser.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'chis-admin-plan-browser-'));
const server = await createServer({ server:{host:'127.0.0.1',port:4176,strictPort:true} });
await server.listen();
const browser = spawn(process.env.CHIS_TEST_CHROME || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],
  {windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket, output='', browserError, sequence=0;
browser.stderr.on('data', chunk => { output+=chunk.toString(); }); browser.on('error', error=>{browserError=error;});
const pending=new Map();
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);return result.result.value;};
const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timed out: '+expression+' '+JSON.stringify(await evaluate('({text:document.body.innerText,errors:window.__errors})')));};
const click=async label=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)} || b.title===${JSON.stringify(label)});if(!button)throw Error('Button missing: '+${JSON.stringify(label)});button.click();return true;})()`);
const apiCount=()=>evaluate("window.__requests.filter(r=>r.url.startsWith('/api/')).length");
const routeCount=()=>evaluate("window.__requests.filter(r=>r.url.includes('/route/v1/')).length");
const widths=[320,375,390,768,1024,1440];
const layout=async label=>{
  for(const width of widths){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await delay(50);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`${label}: page overflow at ${width}`);
    const modal=await evaluate("(()=>{const m=document.querySelector('[role=dialog]') || document.querySelector('.fixed.inset-0 .max-w-3xl');if(!m)return true;const r=m.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})()");
    assert.equal(modal,true,`${label}: modal bounds at ${width}`);
    console.log(`PASS ${label} ${width}px`);
  }
};
try{
  let port;
  for(let i=0;i<100;i++){if(browserError)throw browserError;port=output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1];if(port)break;await delay(100);}
  assert.ok(port,'Headless browser starts');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}});
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:4176/tests/fixtures/admin-plan-performance.html'});
  await until("document.body.innerText.includes('Welcome back, Administrator!')");
  assert.equal(await apiCount(),1);console.log('REQUESTS Admin startup: 1');
  await click('Heritage Sites');await until("document.querySelector('table')?.innerText.includes('Recorded landmark 1')");
  await layout('Admin sites');
  await click('Edit');await until("document.querySelector('#admin-site-form')");await layout('Admin site editor');
  const beforeEdit=await apiCount();
  await evaluate("(()=>{const input=document.querySelector('input[placeholder=\"Site Name\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Edited landmark');input.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
  await delay(50);
  await evaluate("document.querySelector('#admin-site-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true");
  await until("!document.querySelector('#admin-site-form') && document.querySelector('table')?.innerText.includes('Edited landmark')");
  assert.equal((await apiCount())-beforeEdit,1);console.log('REQUESTS edit basic site: 1 PUT, 0 GET');
  await click('Events');await until("document.body.innerText.includes('No events found.')");
  const beforeSwitch=await apiCount();await click('Heritage Sites');await until("document.querySelector('table')?.innerText.includes('Edited landmark')");
  assert.equal(await apiCount(),beforeSwitch);console.log('REQUESTS revisit loaded Admin tab: 0');
  const beforePhotos=await apiCount(); await click('Manage Photos'); await until("document.body.innerText.includes('Photo Management')");
  await layout('Admin photos');
  assert.equal(await apiCount(),beforePhotos);console.log('REQUESTS open existing site photos: 0');
  assert.equal(await evaluate("[...document.querySelectorAll('img[loading=lazy]')].every(image=>image.hasAttribute('width') && image.hasAttribute('height'))"),true);
  await click('Back to Heritage Sites'); await until("document.querySelector('table')?.innerText.includes('Edited landmark')");
  await click('Recommended Itineraries');await until("document.body.innerText.includes('Recorded route')");
  await click('Edit');await until("document.querySelector('form')");await layout('Admin itinerary editor');await click('Cancel');
  const beforePlan=await apiCount();await evaluate('window.__showPlan();true');await until("document.querySelector('#open-itinerary-7')");
  assert.equal((await apiCount())-beforePlan,2); // Fixture catalogue + itinerary list; App already supplies catalogue normally.
  console.log('REQUESTS Plan: 1 itinerary GET (+ fixture-only catalogue GET)');
  await layout('Plan recommended');const beforeMode=await apiCount();
  await click('Build My Own Itinerary');await until("document.querySelector('#custom-add-1')");await layout('Plan custom');
  await evaluate("document.querySelector('#custom-add-1').click();document.querySelector('#custom-add-2').click();true");
  await until("document.querySelector('#custom-up-2')");await layout('Plan custom reorder');
  await click('Recommended');await until("document.querySelector('#open-itinerary-7')");
  await evaluate("document.querySelector('#open-itinerary-7').click();true");await until("document.querySelector('#itinerary-route-summary')");
  assert.equal(await apiCount(),beforeMode);assert.equal(await routeCount(),0);console.log('REQUESTS mode switching and detail: 0; OSRM before map: 0');
  await evaluate("document.querySelector('#itinerary-map-toggle').click();true");
  await until("document.querySelector('.leaflet-container') && document.querySelector('#itinerary-route-summary').innerText.includes('4.8 km')");
  await layout('Plan route map');assert.equal(await routeCount(),1);
  await evaluate("document.querySelector('#itinerary-map-toggle').click();true");await delay(50);
  await evaluate("document.querySelector('#itinerary-map-toggle').click();true");await until("document.querySelector('.leaflet-container')");
  assert.equal(await routeCount(),1);console.log('REQUESTS first route map: 1 OSRM; reopen: 0');
  assert.deepEqual(await evaluate('window.__errors'),[]);
}finally{socket?.close();browser.kill();await server.close();}
