// Trusted browser pointer checks for the profile dialog and its live editor handoff.
// Uses memory settings and a disposable Chrome profile; no Obsidian vault is modified.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root=resolve('.'),chromeBin=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!chromeBin)throw Error('Chrome required (CHROME_BIN).');
const work=mkdtempSync(join(tmpdir(),'ll-template-ui-')),evidence=join(tmpdir(),'latex-live-template-visualization-smoke');mkdirSync(evidence,{recursive:true});
const fixture=['\\begin{definition}{A definition}','Plain text.','\\end{definition}','\\begin{theorem}{A theorem}','Plain text.','\\end{theorem}','end'].join('\n');
let chrome,server,ws;const checks=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}`);if(!pass)throw Error(name+': '+JSON.stringify(detail));};
try{
 const entry=String.raw`
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {texEditorExtensions} from './src/editor/texExtensions';
import {latexLiveLanguage} from './src/editor/latexLive';
import {livePreview} from './src/editor/shared/livePreview';
import {DEFAULT_REF_NAMES} from './src/editor/latexRefs';
import {theoremMap} from './src/tex/theorems';
import {applyTemplateVisualization} from './src/editor/templateVisualization';
import {TemplateVisualizationModal} from './src/editor/templateVisualizationModal';
const text=window.__text;
const refs={theorems:theoremMap([window.__class]),numbers:new Map(),labels:new Map(),cites:new Map(),names:DEFAULT_REF_NAMES,checkpoints:new Map()};
const listeners=new Set();let current=null,profiles=[],selected='auto',modal,saves=0;
const renderer={epoch:()=>0,render:()=>null,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
const editor=new EditorView({parent:document.querySelector('#editor'),state:EditorState.create({doc:text,selection:{anchor:text.length},extensions:texEditorExtensions({text,live:livePreview({language:latexLiveLanguage({refs:()=>refs,visualization:()=>applyTemplateVisualization(refs.theorems,current)}),renderer})})})});
function open(){modal=new TemplateVisualizationModal({app:{},profiles,selected,project:'math/main.tex',save:async(p,s)=>{profiles=p;selected=s;current=p.find(p=>p.id===s)??null;saves++;for(const fn of listeners)fn();},closed:()=>modal.modalEl.remove()});modal.open();modal.modalEl.classList.add('smoke-modal');document.body.append(modal.modalEl);}
window.smoke={open,get modal(){return modal},editor,get saves(){return saves},snapshot:()=>({unchanged:editor.state.doc.toString()===text,native:refs.theorems.get('definition').name,colors:[...editor.contentDOM.querySelectorAll('.lsp-lp-box')].map(el=>getComputedStyle(el).borderLeftColor),head:editor.contentDOM.textContent})};open();window.__ready=true;`;
 const compiled=await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'iife',write:false,alias:{obsidian:join(root,'tests/support/obsidian.ts')},logLevel:'warning',plugins:[{name:'isolated-io',setup(b){b.onResolve({filter:/^(?:node:)?(?:fs|path|os|crypto|child_process)$/},a=>({path:a.path,namespace:'io'}));b.onLoad({filter:/.*/,namespace:'io'},()=>({contents:"module.exports=new Proxy({sep:'/'},{get:(o,k)=>k==='__esModule'?false:k in o?o[k]:()=>{throw Error('Unexpected IO')}})",loader:'js'}));}}]});
 writeFileSync(join(work,'bundle.js'),compiled.outputFiles[0].contents);
 writeFileSync(join(work,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><style>${readFileSync('styles.css','utf8')}body{margin:0;font:15px/1.5 system-ui;color:#222;--font-text-size:16px;--font-monospace:monospace;--text-normal:#222;--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#ccc;--interactive-accent:#7755aa;--text-error:#b00}#editor{height:800px;width:750px;margin:20px}.smoke-modal{position:fixed;inset:4% 5%;box-sizing:border-box;max-height:92vh;overflow:auto;background:var(--background-primary);padding:16px;border:1px solid #aaa;z-index:10}button,input,select,textarea{font:inherit;box-sizing:border-box}.theme-dark{background:#17171a;--text-normal:#eee;--background-primary:#252528;--background-secondary:#303033;--background-modifier-border:#666;color:#eee}</style></head><body><div id="editor" class="ll-editor-content lsp-cm-view"></div><script>window.__text=${JSON.stringify(fixture)};window.__class=${JSON.stringify('\\documentclass[lang=cn]{elegantbook}')};</script><script src="/bundle.js"></script></body></html>`);
 server=createServer((req,res)=>{const js=req.url==='/bundle.js';res.writeHead(200,{'content-type':js?'text/javascript':'text/html'}).end(readFileSync(join(work,js?'bundle.js':'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 chrome=spawn(chromeBin,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${join(work,'profile')}`,'--no-first-run','--disable-extensions','about:blank'],{detached:true,stdio:['ignore','ignore','pipe']});
 const url=await new Promise((ok,fail)=>{let out='';const timer=setTimeout(()=>fail(Error('Chrome startup timeout')),20000);chrome.stderr.on('data',data=>{out+=data;const m=/DevTools listening on (ws:[^\s]+)/.exec(out);if(m){clearTimeout(timer);ok(m[1]);}});});
 ws=new WebSocket(url);await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail});let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.fail(Error(JSON.stringify(m.error))):p.ok(m.result)}};
 const send=(method,params={},sessionId)=>new Promise((ok,fail)=>{pending.set(++seq,{ok,fail});ws.send(JSON.stringify({id:seq,method,params,sessionId}))});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true}),page=(m,p)=>send(m,p,sessionId);
 const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 await page('Emulation.setDeviceMetricsOverride',{width:950,height:850,deviceScaleFactor:1,mobile:false});await page('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
 for(let i=0;i<100;i++){if(await evaluate('window.__ready').catch(()=>false))break;await sleep(40)}
 const click=async text=>{const p=await evaluate(`(()=>{const el=[...smoke.modal.contentEl.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(text)});if(!el)throw Error('Missing button');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await page('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...p});await sleep(40)};
 await click('New profile');check('trusted pointer creates a local draft without changing the editor',await evaluate('smoke.saves===0 && smoke.snapshot().unchanged'));
 await evaluate(`(()=>{const details=smoke.modal.contentEl.querySelector('.ll-template-rule');details.open=true;const name=details.querySelector('input[aria-label="Heading"]'),color=details.querySelector('input[aria-label="Color (#RRGGBB)"]');name.value='My definition';name.dispatchEvent(new Event('input'));color.value='invalid';color.dispatchEvent(new Event('input'))})()`);
 await click('Save and use selected profile');check('invalid color leaves the old live rendering and settings intact',await evaluate('smoke.saves===0 && smoke.modal.contentEl.textContent.includes("#RRGGBB") && smoke.snapshot().unchanged'));
 await evaluate(`(()=>{const color=smoke.modal.contentEl.querySelector('input[type=color]');color.value='#aa33cc';color.dispatchEvent(new Event('input'))})()`);
 await click('Save and use selected profile');await sleep(100);const changed=await evaluate('smoke.snapshot()');check('Apply updates the real live box through its renderer subscriber',await evaluate('smoke.saves===1')&&changed.colors.includes('rgb(170, 51, 204)')&&changed.head.includes('My definition')&&changed.unchanged&&changed.native==='定义',changed);
 await evaluate('smoke.open();smoke.modal.contentEl.querySelector("select").value="auto";smoke.modal.contentEl.querySelector("select").dispatchEvent(new Event("change"))');await click('Save and use selected profile');await sleep(100);const restored=await evaluate('smoke.snapshot()');check('Automatic restores the original class colors without changing source',restored.colors.includes('rgb(0, 166, 82)')&&!restored.colors.includes('rgb(170, 51, 204)')&&restored.unchanged,restored);
 await evaluate('smoke.open()');await click('New profile');await page('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:false});await evaluate('document.body.classList.add("theme-dark");smoke.modal.contentEl.querySelector(".ll-template-rule").open=true');
 const geometry=await evaluate('(()=>{const m=smoke.modal.modalEl,r=m.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth,client:m.clientWidth,scroll:m.scrollWidth}})()');check('dark 375px profile controls stay inside the modal',geometry.left>=0&&geometry.right<=geometry.width+1&&geometry.scroll<=geometry.client+1,geometry);
 const shot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(join(evidence,'mobile.png'),Buffer.from(shot.data,'base64'));await click('Cancel');check('Cancel preserves the last saved profile selection',await evaluate('smoke.saves===2 && smoke.snapshot().unchanged'));
 writeFileSync(join(evidence,'checks.json'),JSON.stringify(checks,null,2));
}finally{ws?.close();if(chrome?.exitCode===null){try{process.kill(-chrome.pid,'SIGKILL')}catch{chrome.kill('SIGKILL')}}server?.close();rmSync(work,{recursive:true,force:true})}
console.log(`template-visualization-smoke: ${checks.filter(c=>c.pass).length}/${checks.length} passed; ${evidence}`);
