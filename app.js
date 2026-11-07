const $ = s => document.querySelector(s);
let mode = 'five'; let candidates = [];
const fmt = n => Number(n || 0).toLocaleString();
async function api(url, options={}) { const r = await fetch(url, { headers:{'content-type':'application/json', ...(options.headers||{})}, ...options }); const data = await r.json(); if(!r.ok) throw new Error(data.error || 'Request failed'); return data; }
function renderStats(s) { $('#checks').textContent=fmt(s.checks); $('#available').textContent=fmt(s.available); $('#taken').textContent=fmt(s.taken); $('#unknown').textContent=fmt(s.unknown); $('#candidates').textContent=fmt(s.candidates); $('#uptime').textContent=s.uptimeSeconds<60?`${s.uptimeSeconds}s`:`${Math.floor(s.uptimeSeconds/60)}m ${s.uptimeSeconds%60}s`; $('#sync').textContent=new Date(s.updatedAt).toLocaleTimeString(); }
function eventLine(message, at=new Date().toISOString()) { const el=document.createElement('div'); el.className='event'; el.textContent=`${new Date(at).toLocaleTimeString()} — ${message}`; $('#events').prepend(el); while($('#events').children.length>12) $('#events').lastChild.remove(); }
function renderCandidates(names) { candidates=names; $('#resultCount').textContent=`${names.length} RESULTS`; const root=$('#results'); root.className='results'; root.replaceChildren(); names.forEach(name=>{ const card=document.createElement('article'); card.className='candidate'; const top=document.createElement('div'); top.className='candidate-top'; const strong=document.createElement('strong'); strong.textContent='@'+name; const copy=document.createElement('button'); copy.textContent='COPY'; copy.onclick=()=>navigator.clipboard?.writeText(name); top.append(strong,copy); const status=document.createElement('small'); status.textContent='NOT CHECKED'; const check=document.createElement('button'); check.className='check'; check.textContent='REQUEST CHECK'; check.onclick=()=>checkName(name,status,check); card.append(top,status,check); root.append(card); }); }
async function generate(){ const btn=$('#generate'); btn.disabled=true; btn.textContent='GENERATING…'; try { const d=await api('/api/generate',{method:'POST',body:JSON.stringify({mode,count:$('#count').value})}); renderCandidates(d.names); renderStats(d.stats); eventLine(`${d.names.length} candidates generated`); } catch(e){eventLine(e.message)} finally{btn.disabled=false;btn.innerHTML='GENERATE CANDIDATES <span>↗</span>';} }
async function checkName(name,statusEl,button){ button.disabled=true;button.textContent='REQUESTING…';try{const d=await api('/api/check',{method:'POST',body:JSON.stringify({username:name})});statusEl.textContent='UNVERIFIED · MANUAL CHECK REQUIRED';button.textContent='OPEN TELEGRAM';button.disabled=false;button.onclick=()=>window.open(d.telegramUrl,'_blank','noopener');renderStats(d.stats);eventLine(`Manual check requested: @${name}`);}catch(e){statusEl.textContent=e.message;button.textContent='RETRY';button.disabled=false;} }
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');mode=b.dataset.mode;}));$('#generate').addEventListener('click',generate);
function setMusic(service){const box=$('#musicEmbed');box.replaceChildren();let iframe=document.createElement('iframe');iframe.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';iframe.loading='lazy';iframe.title=service+' music player';if(service==='spotify')iframe.src='https://open.spotify.com/embed/playlist/37i9dQZF1DX4WYpdgoIcn6?utm_source=generator';if(service==='soundcloud')iframe.src='https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/discover/sets/charts-top&color=%2379d9ee&auto_play=false&hide_related=true';if(service==='youtube')iframe.src='https://www.youtube-nocookie.com/embed/videoseries?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';box.append(iframe);document.querySelectorAll('[data-service]').forEach(b=>b.classList.toggle('selected',b.dataset.service===service));}
document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>setMusic(b.dataset.service)));
$('#openAdmin').onclick=()=>$('#adminModal').classList.remove('hidden');$('#closeAdmin').onclick=()=>$('#adminModal').classList.add('hidden');$('#adminModal').addEventListener('click',e=>{if(e.target.id==='adminModal')$('#adminModal').classList.add('hidden')});
function adminHeaders(){return {'x-admin-password':$('#adminPassword').value};}
async function mark(status){const name=$('#markName').value.trim().replace(/^@/,'');if(!name)return $('#adminMessage').textContent='Enter a username first.';try{await api('/api/admin/mark',{method:'POST',headers:adminHeaders(),body:JSON.stringify({username:name,status,confirmed:true})});$('#adminMessage').textContent=`@${name} manually marked ${status}.`;const s=await api('/api/stats');renderStats(s);}catch(e){$('#adminMessage').textContent=e.message;}}
$('#markAvailable').onclick=()=>mark('available');$('#markTaken').onclick=()=>mark('taken');
$('#publish').onclick=async()=>{try{const d=await api('/api/admin/update',{method:'POST',headers:adminHeaders(),body:JSON.stringify({message:$('#announcement').value})});$('#announcement').value='';$('#adminMessage').textContent='Public update published.';addUpdate(d.update);}catch(e){$('#adminMessage').textContent=e.message;}};
function addUpdate(item){const root=$('#updatesList');if(root.textContent.includes('No public updates'))root.textContent='';const el=document.createElement('div');el.className='update-item';const time=document.createElement('time');time.textContent=new Date(item.at).toLocaleString();const msg=document.createElement('div');msg.textContent=item.message;el.append(time,msg);root.prepend(el);}
async function init(){try{renderStats(await api('/api/stats'));const e=await api('/api/events');e.events.reverse().forEach(x=>eventLine(x.message,x.at));const u=await api('/api/updates');if(u.updates.length){$('#updatesList').textContent='';u.updates.forEach(addUpdate);}}catch(e){eventLine('Could not load dashboard data');}const stream=new EventSource('/api/stream');stream.onmessage=e=>{const d=JSON.parse(e.data);if(d.stats)renderStats(d.stats);if(d.type==='event')eventLine(d.payload.message,d.payload.at);if(d.type==='update')addUpdate(d.payload);};}
init();

// Progressive Web App: install prompt where supported, offline shell, and connection status.
let deferredInstallPrompt = null;
const installButton = document.querySelector('#installApp');
const connectionLabel = document.querySelector('#connectionState');
function updateConnection() {
  if (connectionLabel) connectionLabel.textContent = navigator.onLine ? 'BROWSER READY' : 'OFFLINE MODE';
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installButton) installButton.hidden = false;
});
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}
window.addEventListener('appinstalled', () => {
  if (installButton) installButton.hidden = true;
  eventLine('MONSOON installed on this device');
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => eventLine('Offline app shell enabled'))
      .catch(() => eventLine('Offline install is unavailable in this browser session'));
  });
}
