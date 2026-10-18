import {LEVELS} from './levels.js';
export const LEVEL_COUNT=LEVELS.length,DURATION=180,MAX_ECHOES=6,SPEED=3.8;
export const SYMBOLS=['☀','◇','≈','☾'], SOLUTION=[2,0,3];
export const SPAWN={x:0,z:20};
export const FLOORS=LEVELS[0].floors,LOCATIONS={...LEVELS[0].levers,terminal:LEVELS[0].terminal,note:LEVELS[0].note};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function echoAt(record,t){
 const fs=record.frames;if(!fs.length)return null;
 let lo=0,hi=fs.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fs[mid].t<=t)lo=mid;else hi=mid-1;}
 const a=fs[lo],b=fs[Math.min(lo+1,fs.length-1)],p=b.t===a.t?0:clamp((t-a.t)/(b.t-a.t),0,1);
 const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*p;
 return{x:a.x+(b.x-a.x)*p,z:a.z+(b.z-a.z)*p,y:(a.y||0)+((b.y||0)-(a.y||0))*p,yaw,holding:a.holding};
}
// Высота пола в точке; null, если там вода. Пол [l,r,t,b,y_юг,y_север]; берётся ближайшая к cy высота (не выше шага).
export function floorY(floors,x,z,cy=0){let best=null;for(const [l,r,t,b,ys=0,yn=ys] of floors){if(x>=l+.25&&x<=r-.25&&z>=t-.01&&z<=b+.01){const y=ys+(yn-ys)*(b-z)/(b-t);if(Math.abs(y-cy)<=.75&&(best===null||Math.abs(y-cy)<Math.abs(best-cy)))best=y;}}return best;}
export function onFloor(x,z){return floorY(LEVELS[0].floors,x,z,0)!==null;}
export class EchoGame{
 constructor(saved){this.level=0;this.echoes=[];this.cycle=1;this.noteRead=false;this.victory=false;this.resetCycle();if(saved)this.restore(saved);}
 get L(){return LEVELS[this.level];}
 get duration(){return this.L.time||DURATION;}
 resetCycle(){this.time=0;this.player={...SPAWN,y:0,yaw:0};this.holding=null;this.frames=[];this.rings=[0,0,0];this.sampleAt=0;this.capture();}
 get actors(){return this.echoes.map(e=>echoAt(e,this.time));}
 get gates(){const actors=[{holding:this.holding},...this.actors],o={};for(const id in this.L.levers)o[id]=actors.some(a=>a?.holding===id);return o;}
 capture(){const f={t:this.time,...this.player,holding:this.holding};const last=this.frames.at(-1);if(last&&Math.abs(last.t-f.t)<.00001)this.frames[this.frames.length-1]=f;else this.frames.push(f);this.sampleAt=this.time;}
 canStand(x,z){const y=floorY(this.L.floors,x,z,this.player.y||0);if(y===null)return false;const g=this.gates;for(const gt of this.L.gates)if(!g[gt.lever]&&Math.abs(z-gt.z)<.55)return false;return y;}
 move(dx,dz){const length=Math.hypot(dx,dz);if(length<.00001)return;if(this.holding){this.holding=null;this.capture();}const steps=Math.max(1,Math.ceil(length/.12));for(let i=0;i<steps;i++){let y=this.canStand(this.player.x+dx/steps,this.player.z);if(y!==false){this.player.x+=dx/steps;this.player.y=y;}y=this.canStand(this.player.x,this.player.z+dz/steps);if(y!==false){this.player.z+=dz/steps;this.player.y=y;}}}
 tick(dt){if(this.victory)return null;this.time=Math.min(this.duration,this.time+Math.max(0,dt));if(this.time-this.sampleAt>=.1)this.capture();if(this.time>=this.duration){this.rewind();return'rewind';}return null;}
 loc(id){return id==='terminal'?this.L.terminal:id==='note'?this.L.note:this.L.levers[id];}
 near(id,r=2.7){const p=this.loc(id);return !!p&&distance(this.player,p)<=r&&Math.abs((p.y||0)-(this.player.y||0))<1.8;}
 need(){return this.L.terminal.need.every(k=>this.gates[k]);}
 interact(id){
  if(this.victory||!this.near(id))return'far';
  if(this.L.levers[id]){this.holding=this.holding===id?null:id;this.capture();return this.holding?'holding':'released';}
  if(id==='note'){this.noteRead=true;return'note';}
  if(id==='terminal')return this.need()?'terminal':'power';
 }
 rewind(){if(this.victory)return;this.capture();const frames=this.frames.map(f=>({...f}));const last={...frames.at(-1),t:this.duration};if(last.t>frames.at(-1).t)frames.push(last);this.echoes.push({frames});if(this.echoes.length>MAX_ECHOES)this.echoes.shift();this.cycle++;this.resetCycle();}
 solve(){if(!this.near('terminal')||!this.need())return'power';if(!this.rings.every((v,i)=>v===SOLUTION[i]))return'wrong';this.victory=true;return'won';}
 nextLevel(){this.level++;this.echoes=[];this.cycle=1;this.noteRead=false;this.victory=false;this.resetCycle();}
 removeEcho(index){this.echoes.splice(index,1);}
 serialize(){return{version:1,level:this.level,cycle:this.cycle,echoes:this.echoes,time:this.time,player:this.player,holding:this.holding,frames:this.frames,rings:this.rings,noteRead:this.noteRead,victory:this.victory};}
 restore(s){
  try{
   const lvl=Number.isInteger(s.level)&&s.level>=0&&s.level<LEVEL_COUNT?s.level:0;
   if(s.version!==1||!Array.isArray(s.echoes)||s.echoes.length>MAX_ECHOES)throw Error();
   const valid=f=>f&&Number.isFinite(f.t)&&f.t>=0&&f.t<=DURATION&&Number.isFinite(f.x)&&Math.abs(f.x)<=15&&Number.isFinite(f.z)&&f.z>=-130&&f.z<=25&&Number.isFinite(f.yaw)&&Number.isFinite(f.y??0)&&(f.holding===null||/^[a-d]$/.test(f.holding));
   const frames=fs=>{if(!Array.isArray(fs)||!fs.length||fs.length>4000||!fs.every(valid)||fs.some((f,i)=>i&&f.t<fs[i-1].t))throw Error();return fs.map(f=>({...f}));};
   const es=s.echoes.map(e=>({frames:frames(e.frames)}));
   if(!valid({...s.player,t:s.time,holding:s.holding})||floorY(LEVELS[lvl].floors,s.player.x,s.player.z,s.player.y||0)===null)throw Error();
   const current=frames(s.frames);if(!Array.isArray(s.rings)||s.rings.length!==3||!s.rings.every(n=>Number.isInteger(n)&&n>=0&&n<4))throw Error();
   this.level=lvl;this.echoes=es;this.cycle=Number.isInteger(s.cycle)&&s.cycle>0?s.cycle:es.length+1;this.time=s.time;this.player={y:0,...s.player};this.holding=s.holding;this.frames=current;this.sampleAt=this.time;this.rings=[...s.rings];this.noteRead=!!s.noteRead;this.victory=!!s.victory;
  }catch{this.level=0;this.echoes=[];this.cycle=1;this.noteRead=false;this.victory=false;this.resetCycle();}
 }
}
