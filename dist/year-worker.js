import {dayStudy} from './solar.js';
self.onmessage=({data:{year,site,space,blockers}})=>{
  const days=[];const end=Date.UTC(year+1,0,1);
  for(let t=Date.UTC(year,0,1);t<end;t+=86400000){
    const day=new Date(t).toISOString().slice(0,10);
    days.push({day,...dayStudy(day,site,space,blockers,20,4)});
    if(days.length%30===0)self.postMessage({progress:days.length});
  }
  self.postMessage({days});
};
