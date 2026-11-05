(function(){
'use strict';
const BASE=1234;
const endpoint='https://script.google.com/macros/s/AKfycbwMtXCMuUb_eJ1PlcOlCULqAdYuftwk1xlxTCwE5dqfjcCygA017_rtnkfKn7ELXFI5LQ/exec';
const ids=['studio','cloud','reports'];
const root=document.querySelector('.yk-visitor-stats');
let metrics={siteVisits:BASE,videos:{studio:BASE,cloud:BASE,reports:BASE}},live=false,busy=false;
let localViews={studio:0,cloud:0,reports:0};try{let stored=JSON.parse(localStorage.getItem('ykLocalViewsV3')||'{}');ids.forEach(id=>{localViews[id]=Number.isSafeInteger(stored[id])&&stored[id]>=0?stored[id]:0;metrics.videos[id]=BASE+localViews[id]})}catch(e){}
function uuid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16)});}
function read(store,key,fallback){try{return store.getItem(key)||fallback}catch(e){return fallback}}
function write(store,key,value){try{store.setItem(key,value)}catch(e){}}
let visitor;try{visitor=localStorage.getItem('ykVisitorId')}catch(e){}
if(!visitor||!/^[a-f0-9-]{20,64}$/.test(visitor)){visitor=uuid();try{localStorage.setItem('ykVisitorId',visitor)}catch(e){}}
let pending=[];try{pending=JSON.parse(read(sessionStorage,'ykPendingMetricsV2','[]')).filter(e=>e&&/^[a-f0-9-]{36}$/.test(e.id)).slice(-15)}catch(e){}
function savePending(){try{write(sessionStorage,'ykPendingMetricsV2',JSON.stringify(pending))}catch(e){}}
function enqueue(type,video){pending.push({id:uuid(),type,video:video||''});savePending();send();}
const format=n=>Number(n).toLocaleString('tr-TR');
function paint(data){
 document.querySelectorAll('[data-site-visits]').forEach(el=>el.textContent=format(metrics.siteVisits));
 ids.forEach(id=>document.querySelectorAll('[data-video-count="'+id+'"]').forEach(el=>{el.textContent=format(metrics.videos[id]);el.title=live?'1234 başlangıç değeri + ortak ölçülen izlenmeler':'Bu tarayıcıda ölçülen izlenmeler; 1234 başlangıç değerine eklenir. Ortak toplam için ölçüm servisi eşitlenmelidir.';}));
 document.querySelectorAll('[data-metrics-status]').forEach(el=>el.textContent=live?'Başlangıç: 1234':'Başlangıç: 1234 · Canlı veri bekleniyor');
 if(root){
  const set=(key,value)=>{const el=root.querySelector('[data-'+key+']');if(el)el.textContent=value};
  set('counter',format(metrics.siteVisits));
  if(data){['today','total','active'].forEach(k=>{if(Number.isFinite(Number(data[k])))set(k,format(data[k]))})}
  const status=root.querySelector('[data-status]');if(status)status.textContent=live?'Site ziyareti: 1234 başlangıç + ölçülen sayfa açılışları. Aktif: son 2 dakika.':'Başlangıç değeri: 1234. Canlı ölçüm bağlantısı bekleniyor.';
 }
}
function send(){
 if(busy||document.visibilityState==='hidden')return;busy=true;
 const event=pending[0],name='ykStats_'+Math.random().toString(36).slice(2),script=document.createElement('script');let timeout;
 function clean(){clearTimeout(timeout);script.remove();delete window[name];busy=false}
 function fail(){clean();paint()}
 window[name]=function(data){
  clean();
  if(data&&data.ok&&data.metrics&&data.metrics.version===2){
   const m=data.metrics;const valid=n=>Number.isSafeInteger(n)&&n>=BASE;
   if(valid(m.siteVisits)&&ids.every(id=>valid(m.videos&&m.videos[id]))){metrics=m;live=true;}
   if(event&&data.acknowledged===event.id){pending=pending.filter(e=>e.id!==event.id);savePending();if(pending.length)setTimeout(send,150)}
   if(live)ids.forEach(id=>{metrics.videos[id]+=pending.filter(e=>e.type==='video'&&e.video===id).length});
  }
  paint(data&&data.ok?data:null);
 };
 const params=new URLSearchParams({callback:name,visitor,t:String(Date.now())});
 if(event){params.set('event',event.type);params.set('eventId',event.id);if(event.video)params.set('video',event.video)}
 script.src=endpoint+'?'+params.toString();script.onerror=fail;timeout=setTimeout(fail,15000);document.head.appendChild(script);
}
paint();enqueue('visit');setInterval(send,60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')send()});
// Count the first visible playback on each page opening. A video loop is not a new view.
const videos=Array.from(document.querySelectorAll('video[data-video-id]')).map(el=>({el,id:el.dataset.videoId,ratio:0,seconds:0,counted:false}));
if(typeof IntersectionObserver==='function'){
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const item=videos.find(v=>v.el===entry.target);if(item)item.ratio=entry.intersectionRatio}),{threshold:[0,.5,1]});videos.forEach(v=>observer.observe(v.el));
}else videos.forEach(v=>v.ratio=1);
function firstPlayback(v){
 if(v.counted||!ids.includes(v.id)||document.visibilityState!=='visible'||v.ratio<.5||v.el.paused||v.el.ended||v.el.readyState<2)return;
 v.counted=true;localViews[v.id]++;try{localStorage.setItem('ykLocalViewsV3',JSON.stringify(localViews))}catch(e){}
 // An immediate local measurement remains usable when the shared endpoint is offline.
 metrics.videos[v.id]=live?metrics.videos[v.id]+1:BASE+localViews[v.id];paint();enqueue('video',v.id);
}
videos.forEach(v=>v.el.addEventListener('playing',()=>firstPlayback(v)));
setInterval(()=>videos.forEach(firstPlayback),250);
})();
