import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from '../dist/scene.js';
test('pinhole projection centres forward sun, excludes rear sun, and responds to pitch',()=>{
 const scene=Object.create(Scene.prototype);scene.w=400;scene.h=600;
 const cal={heading:90,pitch:30,fov:60};
 const p=scene.cameraProject({azimuth:90,altitude:30},cal);
 assert.ok(Math.abs(p[0]-200)<1e-9&&Math.abs(p[1]-300)<1e-9);
 assert.equal(scene.cameraProject({azimuth:270,altitude:0},cal),null);
 const left=scene.cameraProject({azimuth:80,altitude:30},cal);assert.ok(left[0]<200);
 const up=scene.cameraProject({azimuth:90,altitude:45},cal);assert.ok(up[1]<300);
});
test('year worker evaluates every day in leap year including full 24-hour grids',async()=>{
 const messages=[];globalThis.self={postMessage:x=>messages.push(x)};
 await import('../dist/year-worker.js');
 self.onmessage({data:{year:2028,site:{lat:12.97,lon:77.59,offset:5.5},space:{x:0,y:0,z:0,w:2,d:2},blockers:[]}});
 const {days}=messages.at(-1);assert.equal(days.length,366);assert.equal(days[59].day,'2028-02-29');
 assert.equal(days.at(-1).day,'2028-12-31');
 for(const d of days){assert.equal(d.samples.length,72);assert.equal(d.hours,d.daylight);assert.ok(d.hours>10&&d.hours<14);}
 delete globalThis.self;
});
