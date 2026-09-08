import {rad,wrap,solarPosition,instant,isLit,sunVector} from './solar.js';
export class Scene {
  constructor(canvas,getState,onRectangle) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.state=getState;this.onRectangle=onRectangle;
    this.yaw=-.55;this.zoom=1;this.extent=32;this.drag=null;this.mark=null;this.frozen=null;
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const p=this.point(e);this.drag={start:p,end:p,yaw:this.yaw};});
    canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.drag.end=this.point(e);const s=this.state();if(s.view==='3d'&&!s.drawMode)this.yaw=this.drag.yaw+(this.drag.end[0]-this.drag.start[0])*.008;this.draw();});
    canvas.addEventListener('pointerup',()=>{const d=this.drag;this.drag=null;if(!d)return;const s=this.state();if(s.drawMode&&Math.hypot(d.end[0]-d.start[0],d.end[1]-d.start[1])>12){if(s.view==='plan'){this.onRectangle(this.unplan(d.start),this.unplan(d.end));}else if(s.view==='camera'&&this.frozen){this.mark={a:d.start.map((v,i)=>v/[this.w,this.h][i]),b:d.end.map((v,i)=>v/[this.w,this.h][i])};this.onRectangle(null,null);}}this.draw();});
    canvas.addEventListener('pointercancel',()=>{this.drag=null;this.draw();});
    canvas.addEventListener('wheel',e=>{if(this.state().view!=='camera'){e.preventDefault();this.zoom=Math.max(.35,Math.min(2.2,this.zoom*Math.exp(-e.deltaY*.001)));this.draw();}},{passive:false});
  }
  point(e){const r=this.canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
  reset(){this.yaw=-.55;this.zoom=1;this.draw();}
  plan(p){const k=Math.min(this.w,this.h)*.78/(this.extent*2)*this.zoom;return [this.w/2+p[0]*k,this.h/2-p[1]*k];}
  unplan(p){const k=Math.min(this.w,this.h)*.78/(this.extent*2)*this.zoom;return [(p[0]-this.w/2)/k,-(p[1]-this.h/2)/k];}
  project(p){if(this.state().view==='plan')return this.plan(p);const k=Math.min(this.w/100,this.h/65)*this.zoom;const x=p[0]*Math.cos(this.yaw)-p[1]*Math.sin(this.yaw),y=p[0]*Math.sin(this.yaw)+p[1]*Math.cos(this.yaw);return [this.w/2+x*k,this.h*.64-y*k*.52-p[2]*k*.84];}
  polygon(points,fill,stroke){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const a=this.project(p);i?c.lineTo(...a):c.moveTo(...a);});c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
  line(points,color,width=1,dashed=false){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const a=this.project(p);i?c.lineTo(...a):c.moveTo(...a);});c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dashed?[4,5]:[]);c.stroke();c.setLineDash([]);}
  label(text,p,color='#b7c7d4',size=11){const a=this.project(p),c=this.ctx;c.font=`${size}px system-ui`;c.textAlign='center';c.fillStyle=color;c.fillText(text,a[0],a[1]);}
  draw(){
    const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.w=r.width;this.h=r.height;const ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*ratio);this.canvas.height=Math.round(this.h*ratio);const c=this.ctx;c.scale(ratio,ratio);c.clearRect(0,0,this.w,this.h);
    const s=this.state();if(s.view==='camera'){this.drawCamera(s);return;}
    for(let x=-30;x<=30;x+=5){this.line([[x,-30,0],[x,30,0]],'#66849e20');this.line([[-30,x,0],[30,x,0]],'#66849e20');}
    this.line([[0,0,0],[0,30,0]],'#7c95ac65',1,true);this.label('N',[0,33,0],'#e4cc92',13);this.label('E',[34,0,0]);this.label('S',[0,-34,0]);this.label('W',[-34,0,0]);
    // The coloured grid is a ray-tested horizontal surface, not a painted shadow.
    for(let x=-28;x<28;x+=2)for(let y=-28;y<28;y+=2)if(s.sun.altitude>0&&!isLit([x+1,y+1,.01],s.sun,s.study.blockers))this.polygon([[x,y,0],[x+2,y,0],[x+2,y+2,0],[x,y+2,0]],'#a05a6832');
    for(const space of s.study.spaces){const n=12,dx=space.w/n,dy=space.d/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=space.x-space.w/2+i*dx,y=space.y-space.d/2+j*dy;const lit=isLit([x+dx/2,y+dy/2,space.z+.01],s.sun,s.study.blockers);this.polygon([[x,y,space.z],[x+dx,y,space.z],[x+dx,y+dy,space.z],[x,y+dy,space.z]],s.sun.altitude<=0?'#546778':lit?'#e6b857':'#b76572');}
      const x=space.x-space.w/2,y=space.y-space.d/2;this.polygon([[x,y,space.z],[x+space.w,y,space.z],[x+space.w,y+space.d,space.z],[x,y+space.d,space.z]],null,space.id===s.selected?'#fff2c5':'#af9c6c');this.label(space.name,[space.x,y-2,space.z],'#efe4c8',12);
      if(s.view==='3d'&&space.z>0){this.line([[x,y,0],[x,y,space.z]],'#e6cc8b90',1,true);this.label(space.z+' m',[x-2,y,space.z/2],'#baa778',10);}
    }
    const faces=[];
    for(const b of s.study.blockers){const x=b.x-b.w/2,y=b.y-b.d/2,z=b.base,t=z+b.h;const p=[[x,y,z],[x+b.w,y,z],[x+b.w,y+b.d,z],[x,y+b.d,z],[x,y,t],[x+b.w,y,t],[x+b.w,y+b.d,t],[x,y+b.d,t]];
      if(s.view==='plan'){this.polygon([p[4],p[5],p[6],p[7]],'#506072','#91a2b2');this.label(b.name,[b.x,b.y,t],'#eef3f6',11);}else{[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach((ids,i)=>{const pts=ids.map(id=>p[id]);const depth=pts.reduce((v,p)=>v+p[0]*Math.sin(this.yaw)+p[1]*Math.cos(this.yaw),0)/4;faces.push({pts,depth,fill:['#384958d9','#435767d9','#465a6bd9','#334757d9','#65798be8'][i]});});}
    }
    faces.sort((a,b)=>b.depth-a.depth).forEach(f=>this.polygon(f.pts,f.fill,'#9fb7c045'));
    if(s.view==='3d'){for(const b of s.study.blockers)this.label(b.name,[b.x,b.y,b.base+b.h+1.5],'#becbd5',10);
      const p=s.study.spaces.find(p=>p.id===s.selected),v=sunVector(s.sun),start=[p.x,p.y,p.z];
      if(s.sun.altitude>0){const end=start.map((a,i)=>a+v[i]*27);this.line([start,end],'#ffcf7085',2,true);const a=this.project(end);c.fillStyle='#ffcf70';c.shadowColor='#ffcc68';c.shadowBlur=22;c.beginPath();c.arc(...a,7,0,2*Math.PI);c.fill();c.shadowBlur=0;this.label('SUN',end.map((v,i)=>i===2?v+3:v),'#ffda8b',10);}
    }
    c.font='11px system-ui';c.fillStyle='#8fa4b5';c.textAlign='left';c.fillText('METRES · MEASURED GEOMETRY',20,this.h-53);
    if(this.drag&&s.drawMode){const [x,y]=this.drag.start,[a,b]=this.drag.end;c.fillStyle='#ffcb6640';c.strokeStyle='#ffcb66';c.fillRect(x,y,a-x,b-y);c.strokeRect(x,y,a-x,b-y);}
  }
  cameraProject(sun,cal){const a=sun.azimuth*rad,e=sun.altitude*rad,h=cal.heading*rad,p=cal.pitch*rad;const v=[Math.sin(a)*Math.cos(e),Math.cos(a)*Math.cos(e),Math.sin(e)];const right=[Math.cos(h),-Math.sin(h),0],up=[-Math.sin(h)*Math.sin(p),-Math.cos(h)*Math.sin(p),Math.cos(p)],forward=[Math.sin(h)*Math.cos(p),Math.cos(h)*Math.cos(p),Math.sin(p)];const dot=b=>v.reduce((t,x,i)=>t+x*b[i],0),z=dot(forward);if(z<.05)return null;const f=this.w/(2*Math.tan(cal.fov*rad/2));return [this.w/2+f*dot(right)/z,this.h/2-f*dot(up)/z];}
  drawCamera(s){const c=this.ctx,cal=this.frozen?.cal||s.cal;
    if(this.frozen)c.drawImage(this.frozen.image,0,0,this.w,this.h);
    if(!s.cameraActive&&!this.frozen)return;
    c.lineWidth=1;c.strokeStyle='#ffffff55';c.setLineDash([6,6]);const horizon=this.cameraProject({azimuth:cal.heading,altitude:0},cal);if(horizon){c.beginPath();c.moveTo(0,horizon[1]);c.lineTo(this.w,horizon[1]);c.stroke();}c.setLineDash([]);
    // Project measured boxes from the explicitly selected observation point.
    // No pixels are classified as buildings and no depth is inferred from video.
    const target=s.study.spaces.find(p=>p.id===s.selected);
    const origin=[target.x,target.y,target.z+1.6];
    for(const b of s.study.blockers){
      const corners=[];
      for(const z of [b.base,b.base+b.h])for(const [x,y] of [[b.x-b.w/2,b.y-b.d/2],[b.x+b.w/2,b.y-b.d/2],[b.x+b.w/2,b.y+b.d/2],[b.x-b.w/2,b.y+b.d/2]]){
        const dx=x-origin[0],dy=y-origin[1],dz=z-origin[2];
        corners.push(this.cameraProject({azimuth:wrap(Math.atan2(dx,dy)/rad),altitude:Math.atan2(dz,Math.hypot(dx,dy))/rad},cal));
      }
      c.fillStyle='#e9656525';c.strokeStyle='#ff9d9d85';c.lineWidth=1;
      for(const face of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]){
        const points=face.map(i=>corners[i]);if(points.some(p=>!p||Math.abs(p[0])>this.w*8||Math.abs(p[1])>this.h*8))continue;
        c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();c.stroke();
      }
    }
    for(const [day,color,width] of [[s.day.slice(0,4)+'-06-21','#acd7e170',1],[s.day.slice(0,4)+'-12-21','#cbaacb70',1],[s.day,'#ffcf78',2.5]]){
      c.strokeStyle=color;c.lineWidth=width;c.beginPath();let previous=false;
      for(let minute=0;minute<=1440;minute+=5){const sun=solarPosition(instant(day,minute,s.study.site.offset),s.study.site.lat,s.study.site.lon),a=sun.altitude>=0?this.cameraProject(sun,cal):null;if(a&&Math.abs(a[0])<this.w*5&&Math.abs(a[1])<this.h*5){previous?c.lineTo(...a):c.moveTo(...a);previous=true;}else previous=false;}c.stroke();
    }
    for(let minute=0;minute<1440;minute+=60){const sun=solarPosition(instant(s.day,minute,s.study.site.offset),s.study.site.lat,s.study.site.lon),a=sun.altitude>0?this.cameraProject(sun,cal):null;if(a&&a[0]>10&&a[0]<this.w-35&&a[1]>20&&a[1]<this.h-70){c.fillStyle='#ffe1a8';c.font='12px system-ui';c.textAlign='left';c.fillText(String(minute/60).padStart(2,'0')+':00',a[0]+5,a[1]-8);}}
    const a=this.cameraProject(s.sun,cal),space=s.study.spaces.find(p=>p.id===s.selected),clear=isLit([space.x,space.y,space.z+1.6],s.sun,s.study.blockers);
    if(a&&s.sun.altitude>0&&a[0]>0&&a[0]<this.w&&a[1]>0&&a[1]<this.h){c.fillStyle=clear?'#ffd077':'#f58787';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(...a,11,0,Math.PI*2);c.fill();c.stroke();}else{c.fillStyle='#ffdfab';c.font='14px system-ui';c.textAlign='center';c.fillText(s.sun.altitude<=0?'Sun is below the horizon':'Sun is outside this view',this.w/2,this.h-70);}
    if(this.mark){const x=this.mark.a[0]*this.w,y=this.mark.a[1]*this.h,w=(this.mark.b[0]-this.mark.a[0])*this.w,h=(this.mark.b[1]-this.mark.a[1])*this.h;const inside=s.sun.altitude>0&&a&&a[0]>=Math.min(x,x+w)&&a[0]<=Math.max(x,x+w)&&a[1]>=Math.min(y,y+h)&&a[1]<=Math.max(y,y+h);c.fillStyle=inside?(clear?'#ffd07740':'#ef878740'):'#ffd07715';c.strokeStyle=inside&&!clear?'#ffaaaa':'#ffdb90';c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);c.font='12px system-ui';c.fillStyle='#ffe8bd';c.textAlign='left';c.fillText(inside?(clear?'Sun inside opening · alignment estimate':'Sun inside opening · blocked by model'):'Sun outside marked opening',Math.max(8,Math.min(x,x+w)),Math.max(25,Math.min(y,y+h)-8));}
    if(this.drag&&s.drawMode){const [x,y]=this.drag.start,[a,b]=this.drag.end;c.strokeStyle='#ffdb90';c.strokeRect(x,y,a-x,b-y);}
    c.fillStyle='#0d1827bf';c.fillRect(12,this.h-57,this.w-24,24);c.fillStyle='#d7e1e7';c.font='11px system-ui';c.textAlign='center';c.fillText(this.frozen?'FROZEN FRAME · annotations are not spatially tracked':'APPROXIMATE ALIGNMENT · no automatic obstacle detection',this.w/2,this.h-41);
  }
}
