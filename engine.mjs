// TURKO browser motion runtime. PLCopen-style semantics; no IEC 61131 runtime or hardware transport.
export const FORMAT='turko-flying-saw-v1';
export const DEFAULT_PROJECT={format:FORMAT,version:1,name:'Uçan Testere · Elektronik Kam',feed:100,deceleration:200,sawSpeed:48,scanMs:20,
 cam:[{x:0,y:0,type:'Accel'},{x:100,y:50,type:'Line'},{x:500,y:450,type:'Decel'},{x:550,y:475,type:'Return'},{x:800,y:0,type:'Dwell'},{x:1000,y:0,type:'End'}],
 program:{power:true,table:true,cam:true,cut:true,clamp:true,contacts:['Cam.InSync','SyncZone','ClampClosed','CutZone']},
 zones:{clampOn:170,downOn:200,upOn:360,release:470,returnAt:550},notes:'Tarayıcıda çalışan sanal PLC / makine modeli. Gerçek CODESYS runtime veya donanım sürücüsü değildir.'};
const clone=x=>JSON.parse(JSON.stringify(x));
const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
export function validateProject(input){
 if(!input||input.format!==FORMAT||input.version!==1)throw Error('Uçan Testere proje biçimi desteklenmiyor.');
 const p=clone(input);if(typeof p.name!=='string'||!p.name.trim()||p.name.length>90)throw Error('Proje adı 1–90 karakter olmalı.');
 for(const [k,a,b] of [['feed',10,150],['deceleration',10,1000],['sawSpeed',20,200],['scanMs',20,20]])if(!finite(p[k],a,b))throw Error('Geçersiz parametre: '+k);
 if(!Array.isArray(p.cam)||p.cam.length!==6)throw Error('Bu uygulama altı noktalı kam profili kullanır.');
 const types=['Accel','Line','Decel','Return','Dwell','End'];
 p.cam.forEach((v,i)=>{if(!v||!finite(v.x,0,5000)||!finite(v.y,0,800)||v.type!==types[i]||(i&&v.x-p.cam[i-1].x<10))throw Error('Kam noktaları artan X, geçerli Y ve sabit segment türlerinde olmalı.');});
 if(p.cam[0].x!==0||p.cam[0].y!==0||p.cam[4].y!==0||p.cam[5].y!==0)throw Error('Kam başlangıç ve dönüş/bekleme noktaları Y=0 olmalı.');
 if(p.cam[2].y<=p.cam[1].y||p.cam[3].y<p.cam[2].y)throw Error('İleri hareket ve strok noktaları geçersiz.');
 const z=p.zones;if(!z||!['clampOn','downOn','upOn','release','returnAt'].every(k=>finite(z[k],0,p.cam[5].x)))throw Error('İşlem bölgeleri geçersiz.');
 if(!(p.cam[1].x<=z.clampOn&&z.clampOn<z.downOn&&z.downOn<z.upOn&&z.upOn<z.release&&z.release<=p.cam[2].x&&z.returnAt===p.cam[3].x))throw Error('Mengene, kesim, üst konum ve dönüş bölgelerinin sırası geçersiz.');
 const slope=(p.cam[2].y-p.cam[1].y)/(p.cam[2].x-p.cam[1].x);if(Math.abs(slope-1)>1e-8)throw Error('Kesim segmenti 1:1 olmalı: ΔY = ΔX.');
 // Exact velocity continuity for the supported quadratic / cubic pieces.
 if(Math.abs(2*(p.cam[1].y-p.cam[0].y)/(p.cam[1].x-p.cam[0].x)-1)>1e-8||Math.abs(2*(p.cam[3].y-p.cam[2].y)/(p.cam[3].x-p.cam[2].x)-1)>1e-8)throw Error('İvme segmentleri ile kesim segmentinin hızları süreklilik sağlamıyor.');
 const pg=p.program;const signals=new Set(['Cam.InSync','SyncZone','ClampClosed','CutZone','SawUp','Power.Status']);
 if(!pg||!['power','table','cam','cut','clamp'].every(k=>typeof pg[k]==='boolean')||!Array.isArray(pg.contacts)||pg.contacts.length<1||pg.contacts.length>8||!pg.contacts.every(x=>signals.has(x)))throw Error('Desteklenmeyen PLC programı veya kontak.');
 return p;
}
export class CamProfile{
 constructor(points){this.points=clone(points);this.period=this.points.at(-1).x;}
 evaluate(phase){
  let x=Math.max(0,Math.min(this.period,phase));let i=this.points.findIndex((p,j)=>j<this.points.length-1&&x<this.points[j+1].x);if(i<0)i=this.points.length-2;
  const a=this.points[i],b=this.points[i+1],dx=b.x-a.x,dy=b.y-a.y,q=Math.max(0,Math.min(1,(x-a.x)/dx));let f,d1,d2;
  switch(a.type){case'Accel':f=q*q;d1=2*q;d2=2;break;case'Decel':f=2*q-q*q;d1=2-2*q;d2=-2;break;case'Return':f=3*q*q-2*q*q*q;d1=6*q-6*q*q;d2=6-12*q;break;case'Dwell':f=0;d1=0;d2=0;break;default:f=q;d1=1;d2=0;}
  return {position:a.y+dy*f,slope:dy/dx*d1,curvature:dy/dx**2*d2,index:i,phase:x};
 }
}
export class FlyingSawPLC{
 constructor(project=DEFAULT_PROJECT){this.load(project);}
 load(project){this.project=validateProject(project);this.cam=new CamProfile(this.project.cam);this.reset();}
 reset(){this.scanCount=0;this.seconds=0;this.encoder=0;this.phase=0;this.velocity=0;this.x=0;this.xVelocity=0;this.depth=0;this.runRequest=false;this.estop=false;this.fault='';this.cutMade=false;this.piece=null;this.count=0;this.clampClosed=false;this.trace=[];this.events=[];this._selectionScans=0;this._camEngaged=false;this.status='HAZIR';this.blocks={};this.scan(0);this.log('Simülasyon sıfırlandı; X referansı 0 mm.');}
 log(text){this.events.unshift({time:this.seconds,text});this.events.length=Math.min(100,this.events.length);}
 start(){if(this.estop||this.fault)throw Error('Arızayı giderip simülasyonu sıfırlayın.');if(!this.project.program.power||!this.project.program.table||!this.project.program.cam)throw Error('PLC programında Power, Table ve Cam izinleri açık olmalı.');this.runRequest=true;this.log('Başlat komutu.');}
 stop(){this.runRequest=false;this.log('Kontrollü durdurma komutu; master yavaşlıyor.');}
 emergency(){this.estop=true;this.trip('Acil durdurma aktif.');this.scan(0);}
 trip(reason){if(!this.fault)this.log(reason);this.fault=reason;this.runRequest=false;this.velocity=0;this.xVelocity=0;this._camEngaged=false;}
 scan(dt=.02){
  if(!Number.isFinite(dt)||dt<0||dt>.05)throw Error('Tarama süresi geçersiz.');
  const p=this.project,pg=p.program;this.seconds+=dt;this.scanCount++;
  const power=pg.power&&!this.estop&&!this.fault;
  if(power&&pg.table)this._selectionScans++;else this._selectionScans=0;
  const table=power&&pg.table&&this._selectionScans>=2;
  if(this.runRequest&&power&&table&&pg.cam)this._camEngaged=true;
  if(!power||!pg.cam)this._camEngaged=false;
  const target=this.runRequest&&this._camEngaged?p.feed:0;
  this.velocity+=(Math.sign(target-this.velocity))*Math.min(Math.abs(target-this.velocity),p.deceleration*dt);
  const previousPhase=this.phase;
  if(this._camEngaged)this.encoder+=this.velocity*dt;
  const oldCycle=Math.floor((this.encoder-this.velocity*dt)/this.cam.period),newCycle=Math.floor(this.encoder/this.cam.period);
  this.phase=((this.encoder%this.cam.period)+this.cam.period)%this.cam.period;
  if(newCycle!==oldCycle){if(this.depth>.1||this.clampClosed)this.trip('Çevrim sonunda testere / mengene açık konuma gelemedi.');this.cutMade=false;this.piece=null;}
  const c=this.cam.evaluate(this.phase);if(this._camEngaged){this.x=c.position;this.xVelocity=c.slope*this.velocity;}else this.xVelocity=0;
  const z=p.zones,sync=this._camEngaged&&this.phase>=p.cam[1].x&&this.phase<p.cam[2].x&&Math.abs(c.slope-1)<.001;
  const clampRequest=this._camEngaged&&this.phase>=z.clampOn&&this.phase<z.release&&pg.clamp;
  if(clampRequest)this.clampClosed=true;else if(this.depth<.1)this.clampClosed=false;
  const cutZone=this.phase>=z.downOn&&this.phase<z.upOn;
  const signals={'Cam.InSync':this._camEngaged,'Power.Status':power,SyncZone:sync,ClampClosed:this.clampClosed,CutZone:cutZone,SawUp:this.depth<.1};
  this.cutOutput=pg.cut&&power&&pg.contacts.every(k=>signals[k]);
  // Mechanical interlock is independent of the editable rung.
  const down=this.cutOutput&&sync&&this.clampClosed;
  const up=power&&!down;
  if(down)this.depth=Math.min(48,this.depth+p.sawSpeed*dt);else if(up)this.depth=Math.max(0,this.depth-p.sawSpeed*dt);
  if(down&&this.depth>=47.99)this.cutMade=true;
  if(this.cutMade&&!this.clampClosed&&!this.piece){this.count++;this.piece={encoder:this.encoder,phase:this.phase,cutX:750+(this.phase-50)*.52};this.log('Kesim tamamlandı; parça rulolara bırakıldı.');}
  if(this._camEngaged&&this.phase>=p.cam[2].x&&this.phase<z.returnAt&&(this.depth>.1||this.clampClosed))this.trip('Dönüş öncesi üst konum / mengene açılma onayı yok.');
  const active=this._camEngaged&&!this.fault;
  if(this.fault)this.cutOutput=false;
  this.blocks={Power:{Status:power&&!this.fault,Error:false},Table:{Done:table,Busy:power&&pg.table&&!table,Error:false,CamTableID:table?'CAM_SAW':'—'},Cam:{Busy:active,InSync:active,CommandAborted:!active&&!!this.fault,Error:!!this.fault,EndOfProfile:newCycle!==oldCycle},Stop:{Busy:false,Done:!!this.estop,Error:false}};
  this.tags={RunRequest:this.runRequest,ServoEnable:pg.power,EStop:this.estop,Fault:this.fault,EncoderPosition:this.encoder,CamPhase:this.phase,AxisPosition:this.x,AxisVelocity:this.xVelocity,FeedVelocity:this.velocity,InSync:active,SyncZone:sync,ClampClosed:this.clampClosed,SawUp:this.depth<.1,SawDown:this.depth>=47.99,SawDepth:this.depth,CutOutput:this.cutOutput,CutCount:this.count,ScanCount:this.scanCount};
  this.status=this.fault?'ARIZA':!active?'HAZIR':!this.runRequest&&this.velocity<.001?'DURDU':this.phase<p.cam[1].x?'ARABA HIZLANIYOR':this.phase<z.downOn?'SENKRON · MENGENE':this.phase<z.upOn?'SENKRON KESİM':this.phase<z.release?'TESTERE YUKARI':this.phase<p.cam[2].x?'MENGENE AÇIK':this.phase<z.returnAt?'YAVAŞLAMA':this.phase<p.cam[4].x?'KAM İLE GERİ DÖNÜŞ':'REFERANSTA BEKLİYOR';
  if(dt>0&&this.scanCount%5===0){this.trace.push({t:this.seconds,phase:this.phase,encoder:this.encoder,x:this.x,v:this.xVelocity,feed:this.velocity,cut:this.cutOutput});if(this.trace.length>5000)this.trace.shift();}
  return this.tags;
 }
 snapshot(){return clone(this.project);}
}
export function generateST(p){return `(* TURKO Uçan Testere - CODESYS SoftMotion uyarlama taslağı\n   Browser runtime bu ST metnini derlemez. Axis ve MC_CAM_REF hedefte tanımlanmalıdır.\n   MasterPosition ve SyncZone aynı kam koordinat sisteminde değerlendirilir. *)\nPROGRAM PLC_PRG\nVAR\n    fbPower : MC_Power;\n    fbSelect : MC_CamTableSelect;\n    fbCam : MC_CamIn;\n    StartCam, LoadCam, ServoEnable : BOOL;\n    SyncZone, ClampOK, CutStep, Q_TestereIn : BOOL;\n    MasterPosition, CamPhase : LREAL;\nEND_VAR\n\nfbPower(Axis := X_Servo, Enable := ServoEnable,\n    bRegulatorOn := TRUE, bDriveStart := TRUE);\nfbSelect(Master := E1_Encoder, Slave := X_Servo, CamTable := CAM_SAW,\n    Execute := LoadCam, Periodic := TRUE,\n    MasterAbsolute := TRUE, SlaveAbsolute := TRUE);\nfbCam(Master := E1_Encoder, Slave := X_Servo,\n    Execute := StartCam AND fbPower.Status AND fbSelect.Done,\n    CamTableID := fbSelect.CamTableID, StartMode := MC_StartMode.absolute,\n    MasterScaling := 1.0, SlaveScaling := 1.0);\n\n(* MasterPosition fiziksel enkoderin mm cinsinden konum girişidir. *)\nCamPhase := MasterPosition - DINT_TO_LREAL(TRUNC(MasterPosition / ${Number(p.cam[5].x).toFixed(6)})) * ${Number(p.cam[5].x).toFixed(6)};\nSyncZone := (CamPhase >= ${p.cam[1].x}) AND (CamPhase < ${p.cam[2].x});\nCutStep := (CamPhase >= ${p.zones.downOn}) AND (CamPhase < ${p.zones.upOn});\nQ_TestereIn := fbCam.InSync AND SyncZone AND ClampOK AND CutStep;\n(* Geri dönüş: master ${p.cam[3].x}..${p.cam[4].x} mm aralığında kam Y'si ${p.cam[3].y}..0 mm'dir.\n   Bu çevrimde MC_MoveAbsolute kullanılmaz. Hedefte pnömatik I/O,\n   limitler, home, güvenlik ve kam verisi ayrıca yapılandırılmalıdır. *)\n`;}
