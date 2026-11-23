import assert from 'node:assert/strict';
import {DEFAULT_PROJECT,CamProfile,FlyingSawPLC,validateProject} from '../engine.mjs';
const eq=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const c=new CamProfile(DEFAULT_PROJECT.cam);
for(const [x,y,v]of[[0,0,0],[100,50,1],[500,450,1],[550,475,0],[675,237.5,-2.85],[800,0,0],[1000,0,0]]){const r=c.evaluate(x);eq(r.position,y);eq(r.slope,v);}
const p=new FlyingSawPLC();p.start();let returned=false,cut=false,lastCount=0;
for(let i=0;i<1150;i++){p.scan();assert.equal(p.fault,'');assert.ok(p.x>=-.001&&p.x<=475.001);if(p.xVelocity<0){returned=true;assert.equal(p.blocks.Cam.InSync,true);assert.equal(p.clampClosed,false);assert.ok(p.depth<.1);}if(p.cutOutput){cut=true;assert.equal(p.tags.SyncZone,true);assert.equal(p.clampClosed,true);}assert.ok(p.count>=lastCount);lastCount=p.count;}
assert.equal(returned,true);assert.equal(cut,true);assert.equal(p.count,2);
p.stop();for(let i=0;i<100;i++)p.scan();eq(p.velocity,0);const at=p.encoder;for(let i=0;i<30;i++)p.scan();eq(p.encoder,at);assert.equal(p.blocks.Cam.InSync,true);p.start();for(let i=0;i<30;i++)p.scan();assert.ok(p.encoder>at);
p.emergency();p.scan();assert.equal(p.velocity,0);assert.equal(p.blocks.Power.Status,false);assert.equal(p.blocks.Cam.InSync,false);assert.throws(()=>p.start());p.reset();assert.equal(p.fault,'');eq(p.encoder,0);
const bad=structuredClone(DEFAULT_PROJECT);bad.cam[2].y=499;assert.throws(()=>validateProject(bad));
const disabled=structuredClone(DEFAULT_PROJECT);disabled.program.cut=false;const q=new FlyingSawPLC(disabled);q.start();for(let i=0;i<650;i++)q.scan();assert.equal(q.count,0);assert.equal(q.depth,0);
const slow=structuredClone(DEFAULT_PROJECT);slow.sawSpeed=20;const z=new FlyingSawPLC(slow);z.start();for(let i=0;i<600&&!z.fault;i++)z.scan();assert.ok(z.fault.includes('onayı'));assert.equal(z.blocks.Power.Status,false);z.scan();assert.equal(z.blocks.Power.Status,false);
const snapshot=p.snapshot();snapshot.name='Yedek';assert.notEqual(p.project.name,'Yedek');
console.log('PASS: cam points/derivatives, 2 cycles, return interlocks, cut outputs, stop/resume, E-stop/reset, validation, program changes, fault detection, project copies');
