(function(){
  'use strict';
  const endpoint='https://script.google.com/macros/s/AKfycbwMtXCMuUb_eJ1PlcOlCULqAdYuftwk1xlxTCwE5dqfjcCygA017_rtnkfKn7ELXFI5LQ/exec';
  const root=document.querySelector('.yk-visitor-stats');
  if(!root)return;
  let visitor;
  try{
    visitor=localStorage.getItem('ykVisitorId');
    if(!visitor || !/^[a-f0-9-]{20,64}$/.test(visitor)){
      visitor=crypto.randomUUID();
      localStorage.setItem('ykVisitorId',visitor);
    }
  }catch(e){
    root.querySelector('[data-status]').textContent='Ziyaretçi sayacı için tarayıcı depolaması gerekli.';
    return;
  }
  let busy=false;
  function refresh(){
    if(busy || document.visibilityState==='hidden')return;
    busy=true;
    const name='ykStats_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let timer;
    function cleanup(){
      clearTimeout(timer);script.remove();delete window[name];busy=false;
    }
    function fail(){
      root.querySelector('[data-status]').textContent='Canlı veriye şu anda ulaşılamıyor.';
      ['today','total','active','counter'].forEach(k=>root.querySelector('[data-'+k+']').textContent='—');
      cleanup();
    }
    window[name]=function(data){
      if(!data || !data.ok){fail();return;}
      const values={today:data.today,total:data.total,active:data.active,counter:3567+data.total};
      Object.keys(values).forEach(k=>root.querySelector('[data-'+k+']').textContent=Number(values[k]).toLocaleString('tr-TR'));
      root.querySelector('[data-status]').textContent='Aktif: son 2 dakika · Sayaç: 3567 başlangıç değeri + ölçülen toplam · Aynı tarayıcı tek ziyaretçi sayılır.';
      cleanup();
    };
    script.onerror=fail;
    script.src=endpoint+'?callback='+name+'&visitor='+encodeURIComponent(visitor)+'&t='+Date.now();
    timer=setTimeout(fail,20000);
    document.head.appendChild(script);
  }
  refresh();
  setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
})();
