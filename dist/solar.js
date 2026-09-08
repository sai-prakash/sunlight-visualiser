// Independent implementation of NOAA/Meeus solar equations. Degrees clockwise
// from true north, east-positive longitude. Geometric altitude for ray casting.
export const rad = Math.PI / 180;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const wrap = v => ((v % 360) + 360) % 360;
export function solarPosition(date, latitude, longitude) {
  if (!Number.isFinite(+date) || !Number.isFinite(latitude) || Math.abs(latitude)>90 || !Number.isFinite(longitude) || Math.abs(longitude)>180) throw new RangeError('Invalid date or coordinates');
  const t=(+date/86400000+2440587.5-2451545)/36525;
  const L=wrap(280.46646+t*(36000.76983+t*0.0003032));
  const M=357.52911+t*(35999.05029-0.0001537*t), m=M*rad;
  const e=0.016708634-t*(0.000042037+0.0000001267*t);
  const C=Math.sin(m)*(1.914602-t*(0.004817+0.000014*t))+Math.sin(2*m)*(0.019993-0.000101*t)+Math.sin(3*m)*0.000289;
  const omega=125.04-1934.136*t;
  const lambda=(L+C-0.00569-0.00478*Math.sin(omega*rad))*rad;
  const eps=(23+(26+(21.448-t*(46.815+t*(0.00059-t*0.001813)))/60)/60+0.00256*Math.cos(omega*rad))*rad;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lambda));
  const y=Math.tan(eps/2)**2,l=L*rad;
  const eq=4/rad*(y*Math.sin(2*l)-2*e*Math.sin(m)+4*e*y*Math.sin(m)*Math.cos(2*l)-0.5*y*y*Math.sin(4*l)-1.25*e*e*Math.sin(2*m));
  const minutes=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;
  const trueSolar=((minutes+eq+4*longitude)%1440+1440)%1440;
  const ha=(trueSolar/4-180)*rad,lat=latitude*rad;
  const altitude=Math.asin(clamp(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha),-1,1))/rad;
  const azimuth=wrap(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))/rad+180);
  return {altitude,azimuth};
}
export function instant(day, minute, offset) {
  return new Date(Date.parse(day+'T00:00:00Z')+(minute-offset*60)*60000);
}
// Coordinates are east, north, up, in metres above a shared local datum.
export function sunVector(sun) {
  const a=sun.azimuth*rad,e=sun.altitude*rad;
  return [Math.sin(a)*Math.cos(e),Math.cos(a)*Math.cos(e),Math.sin(e)];
}
export function rayBox(origin, direction, box) {
  const min=[box.x-box.w/2,box.y-box.d/2,box.base];
  const max=[box.x+box.w/2,box.y+box.d/2,box.base+box.h];
  let near=0.00001,far=Infinity;
  for(let i=0;i<3;i++) {
    if(Math.abs(direction[i])<1e-10) {if(origin[i]<min[i]||origin[i]>max[i])return false;continue;}
    let a=(min[i]-origin[i])/direction[i],b=(max[i]-origin[i])/direction[i];
    if(a>b)[a,b]=[b,a]; near=Math.max(near,a);far=Math.min(far,b);
    if(near>far)return false;
  }
  return far>=near;
}
export function isLit(point,sun,blockers) {
  return sun.altitude>0&&!blockers.some(b=>rayBox(point,sunVector(sun),b));
}
export function sampleSpace(space,sun,blockers,n=8) {
  let lit=0;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++) if(isLit([space.x-space.w/2+space.w*(i+0.5)/n,space.y-space.d/2+space.d*(j+0.5)/n,space.z+0.01],sun,blockers))lit++;
  return lit/(n*n);
}
export function dayStudy(day,site,space,blockers,step=10,n=5) {
  const samples=[];let hours=0,daylight=0;
  for(let minute=0;minute<1440;minute+=step) {
    const sun=solarPosition(instant(day,minute+step/2,site.offset),site.lat,site.lon);
    const fraction=sampleSpace(space,sun,blockers,n);
    samples.push({minute,fraction,altitude:sun.altitude});hours+=fraction*step/60;
    if(sun.altitude>0)daylight+=step/60;
  }
  return {samples,hours,daylight};
}
export function validateStudy(s) {
  const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  if(!s||s.version!==1||!s.site||!num(s.site.lat,-90,90)||!num(s.site.lon,-180,180)||!num(s.site.offset,-12,14)||typeof s.site.name!=='string'||s.site.name.length>100)throw Error('Invalid location');
  if(!Array.isArray(s.spaces)||s.spaces.length<1||s.spaces.length>25||!Array.isArray(s.blockers)||s.blockers.length>100)throw Error('Invalid study size');
  for(const [type,items] of [['space',s.spaces],['blocker',s.blockers]]) for(const b of items) {
    if(typeof b.id!=='string'||typeof b.name!=='string'||b.name.length>100||!num(b.x,-1000,1000)||!num(b.y,-1000,1000)||!num(b.w,.1,500)||!num(b.d,.1,500))throw Error('Invalid geometry');
    if(type==='space'&&!num(b.z,-100,1000)||type==='blocker'&&(!num(b.base,-100,1000)||!num(b.h,.1,1000)))throw Error('Invalid elevation');
  }
  if(new Set([...s.spaces,...s.blockers].map(b=>b.id)).size!==s.spaces.length+s.blockers.length)throw Error('Duplicate object identifiers');
  return s;
}
