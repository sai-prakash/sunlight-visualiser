import {solarPosition,instant,roomConfig,interiorPoint,isInteriorLit,sampleInterior,wrap} from './solar.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback=()=>({version:1,example:true,site:{name:'Bengaluru · example',lat:12.9716,lon:77.5946,offset:5.5},spaces:[{id:'example-room',name:'Example living room',x:0,y:0,w:4.2,d:5.4,z:3}],blockers:[{id:'example-blocker',name:'Neighbouring building',x:12,y:-8,w:9,d:10,h:18,base:0}]});
let study=fallback();try{const raw=localStorage.getItem('sunlight-study-v1');if(raw)study=JSON.parse(raw);}catch{}
if(!Array.isArray(study.spaces)||!study.spaces.length)study=fallback();
let saved={};try{saved=JSON.parse(localStorage.getItem('sunlight-interior-v1')||'{}')||{};}catch{}
let selected=new URLSearchParams(location.search).get('space');if(!study.spaces.some(s=>s.id===selected))selected=study.spaces[0].id;
let day=new Date().toISOString().slice(0,10),minute=570;
const space=()=>study.spaces.find(s=>s.id===selected)||study.spaces[0];
const defaults=s=>({roomWidth:s.w,roomDepth:s.d,facadeAzimuth:Number.isFinite(s.facadeAzimuth)?s.facadeAzimuth:180,openingWidth:Number.isFinite(s.openingWidth)?s.openingWidth:Math.min(2.4,s.w*.75),openingHeight:Number.isFinite(s.openingHeight)?s.openingHeight:2.1,sill:Number.isFinite(s.sill)?s.sill:0});
const room=()=>{const s=space(),cfg={...defaults(s),...(saved[selected]||{})};return {...s,...cfg,w:Math.max(.1,+cfg.roomWidth||s.w),d:Math.max(.1,+cfg.roomDepth||s.d)};};
const fmt=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
const direction=a=>['N','NE','E','SE','S','SW','W','NW'][Math.round(wrap(a)/45)%8];
function persist(){saved[selected]={roomWidth:+$('roomWidth').value,roomDepth:+$('roomDepth').value,facadeAzimuth:+$('facade').value,openingWidth:+$('openingWidth').value,openingHeight:+$('openingHeight').value,sill:+$('sill').value};localStorage.setItem('sunlight-interior-v1',JSON.stringify(saved));}
function syncControls(){const s=space(),r=room();$('space').innerHTML=study.spaces.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('space').value=selected;$('date').value=day;$('time').value=minute;$('timeLabel').textContent=fmt(minute);$('roomWidth').value=r.w;$('roomDepth').value=r.d;$('facade').value=r.facadeAzimuth;$('openingWidth').max=r.w;$('openingWidth').value=Math.min(r.openingWidth,r.w);$('openingHeight').value=r.openingHeight;$('sill').value=r.sill;$('roomSize').textContent=`${s.w.toFixed(1)} × ${s.d.toFixed(1)} m · floor ${s.z.toFixed(1)} m`;}
function draw(){const canvas=$('interiorCanvas'),rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,rect.width,rect.height);
 const r=room(),sun=solarPosition(instant(day,minute,study.site.offset),study.site.lat,study.site.lon),n=28,pad=Math.max(34,Math.min(rect.width,rect.height)*.08),availableW=rect.width-pad*2,availableH=rect.height-pad*2-28,k=Math.min(availableW/r.w,availableH/r.d),rw=r.w*k,rd=r.d*k,left=(rect.width-rw)/2,frontY=rect.height-pad-18,top=frontY-rd;
 c.fillStyle='#101922';c.fillRect(left,top,rw,rd);let lit=0,maxDepth=0;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const lateral=-r.w/2+r.w*(i+.5)/n,depth=r.d*(j+.5)/n,p=interiorPoint(r,lateral,depth),on=isInteriorLit(p,r,sun,study.blockers||[]);if(on){lit++;maxDepth=Math.max(maxDepth,depth);}c.fillStyle=sun.altitude<=0?'#2b3742':on?'#f2c66d':'#5d3e49';c.fillRect(left+i*rw/n,frontY-(j+1)*rd/n,Math.ceil(rw/n)+.4,Math.ceil(rd/n)+.4);}
 c.strokeStyle='#b8c5d0';c.lineWidth=5;c.beginPath();c.moveTo(left,top);c.lineTo(left,frontY);c.moveTo(left,top);c.lineTo(left+rw,top);c.moveTo(left+rw,top);c.lineTo(left+rw,frontY);c.stroke();
 const cfg=roomConfig(r),openPx=cfg.openingWidth/r.w*rw,cx=left+rw/2;c.strokeStyle='#ffca66';c.lineWidth=7;c.beginPath();c.moveTo(cx-openPx/2,frontY);c.lineTo(cx+openPx/2,frontY);c.stroke();c.strokeStyle='#b8c5d0';c.lineWidth=5;c.beginPath();c.moveTo(left,frontY);c.lineTo(cx-openPx/2,frontY);c.moveTo(cx+openPx/2,frontY);c.lineTo(left+rw,frontY);c.stroke();
 c.fillStyle='#a2b0be';c.font='12px system-ui';c.textAlign='center';c.fillText('FAÇADE / OPENING',rect.width/2,frontY+25);c.textAlign='left';c.fillText('BACK OF ROOM',left,Math.max(16,top-10));
 const fraction=lit/(n*n);$('litPercent').textContent=Math.round(fraction*100)+'%';$('depth').textContent=maxDepth?`${maxDepth.toFixed(1)} m`:'0 m';$('sunAngle').textContent=sun.altitude>0?`${direction(sun.azimuth)} ${sun.azimuth.toFixed(1)}° · ${sun.altitude.toFixed(1)}° high`:'Below horizon';$('openingState').textContent=sun.altitude<=0?'Night':fraction>0?'Direct sun enters through this opening':'No sampled floor point gets direct sun';$('openingState').dataset.state=fraction>0?'lit':'shade';
}
function render(){syncControls();draw();}
$('space').onchange=e=>{persist();selected=e.target.value;history.replaceState(null,'',`?space=${encodeURIComponent(selected)}`);syncControls();draw();};
$('date').onchange=e=>{day=e.target.value;draw();};$('time').oninput=e=>{minute=+e.target.value;$('timeLabel').textContent=fmt(minute);draw();};
for(const id of ['roomWidth','roomDepth','facade','openingWidth','openingHeight','sill'])$(id).oninput=()=>{persist();draw();};
$('now').onclick=()=>{const n=new Date(Date.now()+study.site.offset*3600000);day=n.toISOString().slice(0,10);minute=n.getUTCHours()*60+n.getUTCMinutes();render();};
new ResizeObserver(draw).observe($('interiorCanvas'));
render();
