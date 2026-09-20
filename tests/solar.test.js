import test from 'node:test';
import assert from 'node:assert/strict';
import {solarPosition,instant,sunVector,rayBox,isLit,sampleSpace,roomConfig,interiorPoint,roomOpeningHit,isInteriorLit,sampleInterior,dayStudy,validateStudy} from '../dist/solar.js';
const box={x:10,y:0,w:2,d:6,base:0,h:12};
test('NOAA/Meeus implementation agrees with independent NREL SPA example within 0.05 degrees',()=>{
  // https://midcdmz.nlr.gov/spa/spa_tester.c (accessed 2026-09-08).
  // SPA reference is topocentric and refracted, our altitude is geometric.
  // This is one reference point, not a global accuracy certification.
  const p=solarPosition(new Date('2003-10-17T19:30:30Z'),39.742476,-105.1786);
  assert.ok(Math.abs(p.azimuth-194.340241)<.05);
  assert.ok(Math.abs(p.altitude-(90-50.111622))<.05);
});
test('fractional UTC offsets cross date boundaries correctly',()=>{
 assert.equal(instant('2026-01-01',0,5.5).toISOString(),'2025-12-31T18:30:00.000Z');
 assert.equal(instant('2026-01-01',1380,-7).toISOString(),'2026-01-02T06:00:00.000Z');
});
test('June polar day and December polar night at 80 degrees north',()=>{
 for(let h=0;h<24;h++){
 assert.ok(solarPosition(instant('2026-06-21',h*60,0),80,0).altitude>0);
 assert.ok(solarPosition(instant('2026-12-21',h*60,0),80,0).altitude<0);
 }
});
test('equinox at equator has a near-zenith noon sun',()=>{
 const p=solarPosition(new Date('2026-03-20T12:07:00Z'),0,0);
 assert.ok(p.altitude>89);
});
test('east-positive longitudes and UTC instant give consistent solar position',()=>{
 const a=solarPosition(instant('2026-06-21',720,5.5),12.97,77.59);
 const b=solarPosition(new Date('2026-06-21T06:30:00Z'),12.97,77.59);
 assert.deepEqual(a,b);
});
test('sun vectors have unit length and cardinal directions',()=>{
 for(let a=0;a<360;a+=45){assert.ok(Math.abs(Math.hypot(...sunVector({azimuth:a,altitude:37}))-1)<1e-12);}
 assert.ok(sunVector({azimuth:90,altitude:0})[0]>.999);
 assert.ok(sunVector({azimuth:0,altitude:0})[1]>.999);
});
test('east blocker casts westward shadow, not eastward',()=>{
 assert.equal(isLit([0,0,0],{azimuth:90,altitude:45},[box]),false);
 assert.equal(isLit([0,0,0],{azimuth:270,altitude:45},[box]),true);
});
test('raising apartment above roof clears blockage',()=>{
 assert.equal(isLit([0,0,20],{azimuth:90,altitude:10},[box]),true);
 assert.equal(isLit([0,0,0],{azimuth:90,altitude:10},[box]),false);
});
test('a low blocker beyond the shadow length does not obstruct',()=>{
 assert.equal(isLit([0,0,0],{azimuth:90,altitude:45},[{...box,h:2}]),true);
});
test('raised overhang blocks upward rays but can leave a low ray clear',()=>{
 const overhang={x:0,y:0,w:10,d:10,base:3,h:.3};
 assert.equal(isLit([0,0,0],{azimuth:90,altitude:85},[overhang]),false);
 assert.equal(isLit([0,0,0],{azimuth:90,altitude:5},[overhang]),true);
});
test('parallel rays handle slab misses and origins inside a solid box',()=>{
 assert.equal(rayBox([0,10,0],[1,0,0],box),false);
 assert.equal(rayBox([10,0,1],[0,0,1],box),true);
});
test('space sampling responds to partial shade and never reports night as sunlight',()=>{
 const s={x:0,y:0,z:0,w:2,d:12};
 const f=sampleSpace(s,{azimuth:90,altitude:20},[box],12);
 assert.equal(f,.5);
 assert.equal(sampleSpace(s,{azimuth:90,altitude:-1},[],12),0);
});
test('interior rays must pass through the modeled opening',()=>{
 const room={x:0,y:0,z:0,w:4,d:6,facadeAzimuth:90,openingWidth:2,openingHeight:2.2,sill:0};
 const lowEast={azimuth:90,altitude:20},highEast={azimuth:90,altitude:60};
 assert.ok(roomOpeningHit(interiorPoint(room,0,3),room,lowEast));
 assert.equal(roomOpeningHit(interiorPoint(room,0,3),room,highEast),null);
 assert.equal(roomOpeningHit(interiorPoint(room,0,.5),room,{azimuth:270,altitude:20}),null);
 assert.equal(roomOpeningHit(interiorPoint(room,1.5,.5),room,lowEast),null);
});
test('interior sunlight still obeys external blockers',()=>{
 const room={x:0,y:0,z:0,w:4,d:6,facadeAzimuth:90,openingWidth:2,openingHeight:2.2,sill:0};
 const sun={azimuth:90,altitude:20},point=interiorPoint(room,0,1);
 assert.equal(isInteriorLit(point,room,sun,[]),true);
 assert.equal(isInteriorLit(point,room,sun,[{x:4,y:0,w:1,d:3,base:0,h:8}]),false);
});
test('interior floor sampling reports partial direct sun and zero with sun behind façade',()=>{
 const room={x:0,y:0,z:0,w:4,d:6,facadeAzimuth:90,openingWidth:2,openingHeight:2.2,sill:0};
 const fraction=sampleInterior(room,{azimuth:90,altitude:30},[],24);
 assert.ok(fraction>0&&fraction<1);
 assert.equal(sampleInterior(room,{azimuth:270,altitude:30},[],24),0);
 assert.equal(roomConfig({...room,openingWidth:99}).openingWidth,4);
});
test('open-space sun-equivalent hours equal geometric daylight and shade cannot increase them',()=>{
 const site={lat:12.97,lon:77.59,offset:5.5},s={x:0,y:0,z:0,w:2,d:3};
 const a=dayStudy('2026-06-21',site,s,[]),b=dayStudy('2026-06-21',site,s,[box]);
 assert.equal(a.hours,a.daylight);assert.ok(b.hours<=a.hours);assert.ok(a.hours>12&&a.hours<14);
});
test('north and south pole solar positions stay finite',()=>{
 for(const lat of [-90,90])for(const date of ['2026-06-21','2026-12-21']){
 const s=solarPosition(instant(date,720,0),lat,0);assert.ok(Number.isFinite(s.altitude)&&Number.isFinite(s.azimuth));
 }
});
test('reject invalid coordinates',()=>{assert.throws(()=>solarPosition(new Date(),91,0));assert.throws(()=>solarPosition(new Date('invalid'),0,0));});
test('import bounds geometry and rejects malformed studies',()=>{
 const valid={version:1,site:{lat:0,lon:0,offset:0,name:'test'},spaces:[{id:'1',name:'terrace',x:0,y:0,z:0,w:1,d:1}],blockers:[]};
 assert.equal(validateStudy(valid),valid);
 assert.throws(()=>validateStudy({...valid,spaces:[]}));
 assert.throws(()=>validateStudy({...valid,spaces:[{...valid.spaces[0],w:Infinity}]}));
 assert.throws(()=>validateStudy({...valid,spaces:[valid.spaces[0],valid.spaces[0]]}));
});
