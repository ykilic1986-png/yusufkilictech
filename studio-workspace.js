const root=document.getElementById('turko-project-workspace');
const $=id=>document.getElementById(id);
const names={s7:'Siemens S7',mqtt:'MQTT',opcua:'OPC UA',demo:'Simülasyon',modbus:'Modbus TCP',ethernetip:'EtherNet/IP',fins:'FINS',mc:'MC Protocol',ads:'TwinCAT ADS'};
const types=['REAL','BOOL','INT','DINT','WORD','DWORD','BYTE'];
const plcPorts={s7:102,modbus:502,mc:5000,fins:9600,ads:48898,ethernetip:null};
const clock=value=>value?new Date(value).toLocaleString('tr-TR'):'—';
const val=value=>value==null?'—':typeof value==='boolean'?(value?'Açık':'Kapalı'):typeof value==='number'?new Intl.NumberFormat('tr-TR',{maximumFractionDigits:3}).format(value):String(value);
let current='',turn=0;
let sourceRows=[],sourceTypes=new Map(),csvPreview=null;
let session=null;
try{
  if(/^https?:$/.test(location.protocol))session=await api('session');
}catch{}
function el(tag,text,attrs={}){
  const e=document.createElement(tag);
  if(text!=null)e.textContent=text;
  for(const [key,v] of Object.entries(attrs))e.setAttribute(key,v);
  return e;
}
function button(text,action){
  const e=el('button',text,{type:'button'});
  e.onclick=action;return e;
}
function field(form,name,label,options={}){
  const wrapper=el('label',label);
  const input=el(options.values?'select':'input',null,{name});
  if(options.values)for(const item of options.values){
    const [value,caption]=Array.isArray(item)?item:[item,item];
    input.add(new Option(caption,value));
  }
  else input.type=options.type??'text';
  if(options.value!==undefined){
    if(input.type==='checkbox')input.checked=options.value;
    else input.value=options.value;
  }
  if(options.placeholder)input.placeholder=options.placeholder;
  if(options.required)input.required=true;
  if(input.type==='number')input.step='any';
  wrapper.append(input);form.append(wrapper);return input;
}
function panel(target,title){
  const box=el('div',null,{class:'studio-card'});box.append(el('h3',title));target.append(box);return box;
}
function form(box){
  const f=el('form',null,{class:'studio-form'});box.append(f);return f;
}
function table(target,headers,rows){
  const t=el('table'),head=t.createTHead().insertRow(),body=t.createTBody();
  for(const h of headers)head.append(el('th',h));
  for(const row of rows){
    const tr=body.insertRow();
    for(const v of row){
      const td=tr.insertCell();
      if(v instanceof Node)td.append(v);else td.textContent=v??'—';
    }
  }
  target.replaceChildren(rows.length?t:el('p','Kayıt yok.'));
}
function quality(value){
  return el('span',value??'Bekleniyor',{class:value==='GOOD'?'studio-good':'studio-bad'});
}
function message(where,text,error=false){
  const output=where.querySelector('.studio-message');
  if(output){output.textContent=text;output.classList.toggle('error',error);}
}
async function api(path,payload){
  const response=await fetch('/api/'+path,payload===undefined?{cache:'no-store'}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error??'Sunucu isteği tamamlanamadı.');
  return data;
}
function act(where,task){
  return async event=>{
    event?.preventDefault();
    try{await task(event);}catch(error){message(where,error.message,true);}
  };
}
function heading(where,title){
  where.replaceChildren(el('h2',title),el('p','',{class:'studio-message',role:'status'}));
  if(session?.role==='admin')return true;
  message(where,'Bu çalışma alanını TURKO Studio sunucusu üzerinden yönetici oturumuyla açın.',true);
  return false;
}
function project(action,detail={}){
  const request={action,...detail};
  root.dispatchEvent(new CustomEvent('studio:project',{detail:request}));
  if(request.error)throw Error(request.error);
  return request.project;
}
async function samples(){
  const [drivers,live]=await Promise.all([api('drivers'),api('live')]);
  sourceTypes=new Map(drivers.configured.flatMap(d=>d.mappings.map(m=>[m.tag,{type:m.dataType,driver:d.name}])));
  sourceRows=live.values;
  return {drivers,live};
}
function fillOptions(select,values){
  const before=select.value;
  select.replaceChildren(...values.map(v=>new Option(v,v)));
  if(values.includes(before))select.value=before;
}
function editableDriver(container,where,preset,defaultType,after){
  container.replaceChildren();
  const f=form(container);
  const protocol=field(f,'type','Protokol',{values:[['s7','Siemens S7'],['mqtt','MQTT / TLS'],['opcua','OPC UA istemci'],['modbus','Delta Modbus TCP'],['ethernetip','Allen-Bradley EtherNet/IP'],['fins','Omron FINS'],['mc','Mitsubishi MC'],['ads','Beckhoff ADS']],value:preset?.type||(defaultType||'s7')});
  const name=field(f,'name','Bağlantı adı',{required:true,value:preset?.name});
  if(preset)name.readOnly=true;
  const controls=el('div',null,{class:'studio-form'}),mappingBox=el('div');
  container.append(controls,mappingBox);
  let rows=[];
  const connection=()=>{
    controls.replaceChildren();
    const type=protocol.value;
    if(Object.hasOwn(plcPorts,type)){
      field(controls,'host','PLC IP / adres',{required:true,placeholder:'192.168.1.20',value:preset?.host??''});
      if(plcPorts[type])field(controls,'port','Port',{type:'number',value:preset?.port??plcPorts[type]});
      if(type==='s7')field(controls,'rack','Rack',{type:'number',value:preset?.rack??0});
      if(['s7','ethernetip'].includes(type))field(controls,'slot','Slot',{type:'number',value:preset?.slot??(type==='s7'?1:0)});
      if(type==='modbus')field(controls,'unit','Cihaz numarası',{type:'number',value:preset?.unit??1});
      if(type==='fins'){
        field(controls,'sourceNode','Kaynak düğüm',{type:'number',value:preset?.sourceNode??5});
        field(controls,'destinationNode','Hedef düğüm',{type:'number',value:preset?.destinationNode??12});
      }
      if(type==='ads'){
        field(controls,'amsNetId','AMS Net ID',{value:preset?.amsNetId,required:true,placeholder:'192.168.1.20.1.1'});
        field(controls,'adsPort','ADS portu',{type:'number',value:preset?.adsPort??851});
      }
    }else{
      field(controls,'url',protocol.value==='mqtt'?'Broker adresi':'OPC UA uç adresi',
        {required:true,placeholder:protocol.value==='mqtt'?'mqtts://broker:8883':'opc.tcp://sunucu:4840',value:preset?.url});
      field(controls,'usernameEnv','Kullanıcı ortam değişkeni',{value:preset?.usernameEnv});
      field(controls,'passwordEnv','Parola ortam değişkeni',{value:preset?.passwordEnv});
    }
  };
  const add=(m={})=>{
    const line=el('div',null,{class:'studio-mapping'});
    const tag=field(line,'tag','Etiket',{required:true,value:m.tag});
    const address=field(line,'address',protocol.value==='s7'?'Siemens DB adresi':protocol.value==='mqtt'?'Topic':protocol.value==='opcua'?'NodeId':'PLC adresi',
      {required:true,value:m.sourceAddress??m.nodeId??m.topic??m.address,placeholder:protocol.value==='s7'?'DB1.DBD0':undefined});
    const modbus=protocol.value==='modbus';
    const jsonField=field(line,'field',modbus?'Modbus alanı':'JSON alanı',modbus?{values:['holding','input','coil','discrete'],value:m.area??'holding'}:{value:m.field});
    jsonField.disabled=!['mqtt','modbus'].includes(protocol.value);
    const type=field(line,'dataType','Veri tipi',{values:modbus?['UINT16','INT16','UINT32','INT32','FLOAT32','BOOL']:types,value:m.dataType??(modbus?'UINT16':'REAL')});
    const row={line,tag,address,jsonField,type};
    line.append(button('Kaldır',()=>{line.remove();rows=rows.filter(x=>x!==row);}));
    rows.push(row);mappingBox.append(line);
  };
  const clear=()=>{mappingBox.replaceChildren();rows=[];};
  protocol.onchange=()=>{connection();clear();if(protocol.value!=='s7')add();};
  if(preset)protocol.disabled=true;
  connection();for(const m of preset?.mappings??[])add(m);
  if(!rows.length&&protocol.value!=='s7')add();
  const actions=el('div',null,{class:'studio-actions'});
  actions.append(button('＋ Etiket eşlemesi',()=>add()),button('Bağlantıyı kaydet',act(where,async()=>{
    if(![...container.querySelectorAll('input,select')].every(e=>e.reportValidity()))return;
    const entry={name:name.value,type:protocol.value,
      mappings:rows.map(r=>({tag:r.tag.value,address:r.address.value,dataType:r.type.value,field:r.jsonField.value}))};
    for(const control of controls.querySelectorAll('input'))entry[control.name]=control.type==='number'?control.valueAsNumber:control.value;
    await api('studio/settings',{action:'driver',driver:entry});
    await after(entry.name);
    message(where,'Bağlantı kaydedildi. Okuma kalitesi aşağıdaki tabloda güncellenir.');
  })));
  container.append(actions);
}
async function connections(where,mode=''){
  const title=mode==='mqtt'?'MQTT yayın ve abonelik':mode==='opcua'?'OPC UA sunucu ve istemci':'Bağlantı yöneticisi';
  if(!heading(where,title))return;
  const stamp=turn,overview=panel(where,'Bağlantılar'),cards=el('div');overview.append(cards);
  const detail=panel(where,'Okunan etiketler');
  const top=el('div',null,{class:'studio-actions'});detail.append(top);
  const selection=field(top,'connection','Bağlantı',{values:[]});
  const endpoint=el('p'),readings=el('div');detail.append(endpoint,readings);
  const simulation=form(detail),sim=field(simulation,'value','Simülatör giriş değeri',{type:'number',required:true});
  simulation.append(el('button','Değeri uygula',{type:'submit'}));simulation.hidden=true;
  const csv=form(detail),file=field(csv,'csv','Siemens etiket CSV dosyası',{type:'file',required:true});
  file.accept='.csv,text/csv';
  const apply=button('Etiketleri içe aktar',act(where,async()=>{
    if(!csvPreview)return;
    await api('drivers/s7/import',{...csvPreview,apply:true});
    message(where,'Siemens etiketleri kaydedildi.');clearCsv();await refresh();
  }));
  csv.append(el('button','Adresleri önizle',{type:'submit'}),apply);csv.hidden=true;
  const preview=el('div');detail.append(preview);
  const editBox=panel(where,'Bağlantı ekle veya düzenle'),edit=el('div');editBox.append(edit);
  let list=[],refreshing=false;
  const chosen=()=>list.find(d=>d.name===selection.value);
  function clearCsv(){csvPreview=null;apply.disabled=true;preview.replaceChildren();}
  file.onchange=clearCsv;
  csv.onsubmit=act(where,async()=>{
    const selected=chosen();
    if(!file.files[0]||file.files[0].size>20000)throw Error('En fazla 20 KB CSV dosyası seçin.');
    const request={name:selected.name,csv:await file.files[0].text()};
    const result=await api('drivers/s7/import',request);
    if(chosen()?.name!==request.name)return;
    csvPreview=request;apply.disabled=false;
    table(preview,['Etiket','Siemens adresi','Tür','Sürücü adresi'],result.mappings.map(m=>[m.tag,m.sourceAddress,m.dataType,m.address]));
    message(where,'Adres önizlemesi hazır. İçe aktarma seçili S7 bağlantısının eşlemelerini değiştirir.');
  });
  simulation.onsubmit=act(where,async()=>{await api('control',{tag:chosen().labInput,value:sim.valueAsNumber});message(where,'Simülatör girişi değiştirildi.');});
  const after=async name=>{await refresh();selection.value=name;showDetails();};
  const newDriver=()=>editableDriver(edit,where,null,mode,after);
  function showDetails(){
    const d=chosen();
    endpoint.textContent=d?[names[d.type]??d.type,d.endpoint,d.type==='s7'?'Rack '+(d.rack??0)+' / Slot '+(d.slot??1):'',d.simulation?'Yerel simülatör':'',d.message].filter(Boolean).join(' · '):'Bağlantı seçin.';
    simulation.hidden=!d?.labInput;csv.hidden=d?.type!=='s7';
    table(readings,['Etiket','Adres / Topic / NodeId','Tür','Canlı değer','Kalite','Zaman'],(d?.mappings??[]).map(m=>[
      m.tag,m.sourceAddress??m.address??m.nodeId??m.topic,m.dataType??m.field,val(m.reading?.value),quality(m.reading?.quality),clock(m.reading?.at)
    ]));
  }
  async function refresh(){
    if(refreshing||stamp!==turn)return;
    refreshing=true;
    try{
      const data=await api('drivers');
      if(stamp!==turn)return;
      list=data.configured.filter(d=>!mode||d.type===mode);
      const previous=selection.value;
      if(list.map(d=>d.name).join('\0')!==[...selection.options].map(o=>o.value).join('\0'))fillOptions(selection,list.map(d=>d.name));
      if(previous!==selection.value)clearCsv();
      table(cards,['Bağlantı','Protokol','Etiket','Kalite','İşlem'],list.map(d=>{
        const editAction=d.managed?button('Düzenle',()=>{
          editableDriver(edit,where,d.settings,d.type,after);
          editBox.scrollIntoView({block:'nearest'});
        }):'Sunucu ayarı';
        return [d.name,names[d.type]??d.type,d.tags.length,quality(d.message),editAction];
      }));
      showDetails();
    }finally{refreshing=false;}
  }
  top.append(button('Yenile',act(where,refresh)),button('Yeni bağlantı',newDriver),button('Bağlantıyı sil',act(where,async()=>{
    const d=chosen();if(!d?.managed)throw Error('Bu bağlantı sunucu dosyasından yönetiliyor.');
    if(!confirm(d.name+' bağlantısı silinsin mi?'))return;
    await api('studio/settings',{action:'remove',name:d.name});clearCsv();newDriver();await refresh();
  })));
  selection.onchange=()=>{clearCsv();file.value='';showDetails();};
  clearCsv();newDriver();await refresh();repeat(stamp,refresh,where);
  if(mode)await serviceSettings(where,mode);
}
async function serviceSettings(where,mode){
  const data=await api('studio/settings');
  const mqtt=mode==='mqtt';
  const box=panel(where,mqtt?'MQTT telemetri yayını':'OPC UA sunucusu');
  if(mqtt?data.mqttFixed:data.opcFixed){box.append(el('p','Bu hizmet sunucu yapılandırmasından yönetiliyor.'));return;}
  const f=form(box),existing=mqtt?data.services.mqtt:data.services.opc;
  const enabled=field(f,'enabled','Etkin',{type:'checkbox',value:!!existing});
  const fields=mqtt?[
    field(f,'url','Broker adresi',{value:existing?.url,placeholder:'mqtts://broker:8883'}),
    field(f,'topic','Yayın topic’i',{value:existing?.topic,placeholder:'turko/telemetry'}),
    field(f,'usernameEnv','Kullanıcı ortam değişkeni',{value:existing?.usernameEnv}),
    field(f,'passwordEnv','Parola ortam değişkeni',{value:existing?.passwordEnv})
  ]:[
    field(f,'hostname','Sunucu adı',{value:existing?.hostname??'localhost'}),
    field(f,'port','Port',{type:'number',value:existing?.port??4840})
  ];
  const output=el('p',mqtt?'Aktif toplayıcı etiket verilerini JSON olarak yayınlar.':
    data.serviceError|| (data.opcOnline?'OPC UA yayında · /UA/TURKOStudio':'OPC UA kapalı · TURKO_OPC_PASSWORD ve güvenilen sertifikalar gerekir.'));
  box.append(output);
  f.append(el('button','Hizmeti uygula',{type:'submit'}));
  f.onsubmit=act(where,async()=>{
    const latest=await api('studio/settings');
    const update={enabled:enabled.checked};
    for(const e of fields)update[e.name]=e.type==='number'?e.valueAsNumber:e.value;
    await api('studio/settings',{action:'services',opc:mqtt?latest.services.opc:update,mqtt:mqtt?update:(latest.services.mqtt&&{...latest.services.mqtt,enabled:true})});
    output.textContent='Ayar kaydedildi. Aktif sunucu hizmeti güncelliyor.';
    let state;
    for(let i=0;i<10;i++){
      await new Promise(resolve=>setTimeout(resolve,500));
      state=await api('studio/settings');
      if(mqtt||state.opcOnline===enabled.checked||state.serviceError)break;
    }
    output.textContent=mqtt?'Yayın ayarı '+(state.services.mqtt?'etkin.':'kapalı.'):
      state.serviceError||(state.opcOnline?'OPC UA yayında · /UA/TURKOStudio':'OPC UA henüz yayın yapmıyor.');
  });
}
async function liveTags(where){
  if(!heading(where,'Sunucu etiketleri'))return;
  const box=panel(where,'Canlı değer, kalite ve zaman damgası'),output=el('div');box.append(output);
  const stamp=turn;
  const refresh=async()=>{
    await samples();if(stamp!==turn)return;
    table(output,['Etiket','Bağlantı','Değer','Kalite','Zaman','Projede kullan'],sourceRows.map(r=>{
      const meta=sourceTypes.get(r.tag);
      const type=meta?.type??(typeof r.value==='boolean'?'BOOL':'REAL');
      const links=el('div',null,{class:'studio-actions'});
      links.append(button('PLC etiketine ekle',act(where,()=>{project('tag',{tag:r.tag,type});message(where,r.tag+' projeye eklendi.');})),
        button('HMI göstergesi ekle',act(where,()=>project('hmi',{tag:r.tag,type}))));
      return [r.tag,meta?.driver??'Dönüşüm',val(r.value),quality(r.quality),clock(r.at),links];
    }));
  };
  await refresh();repeat(stamp,refresh,where);
}
function chart(target,rows,kind){
  const points=rows.filter(r=>r.quality==='GOOD'&&(typeof r.value==='boolean'||Number.isFinite(r.value))).map(r=>({at:r.at,value:Number(r.value)}));
  if(!points.length){target.replaceChildren(el('p','Bu aralıkta geçerli kayıt yok.'));return;}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 800 235');svg.setAttribute('aria-label','Veri kaydı grafiği');svg.setAttribute('role','img');
  const draw=(name,attributes,text)=>{
    const e=document.createElementNS(svg.namespaceURI,name);
    for(const [k,v] of Object.entries(attributes))e.setAttribute(k,v);
    if(text)e.textContent=text;svg.append(e);return e;
  };
  const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));
  const range=max-min||1,span=points.at(-1).at-points[0].at||1;
  for(let i=0;i<5;i++){
    const y=190-i*40;
    draw('line',{x1:63,x2:775,y1:y,y2:y,stroke:'#33525e'});
    draw('text',{x:8,y:y+4,fill:'#c3d4dc','font-size':12},val(min+i*range/4));
  }
  const coords=points.map(p=>[63+(p.at-points[0].at)*712/span,190-(p.value-min)*160/range]);
  if(kind==='bar'||kind==='point'){
    for(const [x,y] of coords)kind==='point'?draw('circle',{cx:x,cy:y,r:3,fill:'#72edc3'}):
      draw('rect',{x:x-2,y,width:Math.min(8,700/coords.length),height:Math.max(2,190-y),fill:'#72edc3'});
  }else{
    if(kind==='area')draw('polygon',{points:[[coords[0][0],190],...coords,[coords.at(-1)[0],190]].join(' '),fill:'#2b766a'});
    draw('polyline',{points:coords.join(' '),fill:'none',stroke:'#72edc3','stroke-width':2});
    if(coords.length===1)draw('circle',{cx:coords[0][0],cy:coords[0][1],r:3,fill:'#72edc3'});
  }
  draw('text',{x:63,y:220,fill:'#c3d4dc','font-size':12},clock(points[0].at));
  draw('text',{x:775,y:220,fill:'#c3d4dc','font-size':12,'text-anchor':'end'},clock(points.at(-1).at));
  target.replaceChildren(svg);
}
async function historian(where,reportOnly){
  if(!heading(where,reportOnly?'Raporlar':'Veri kaydı ve trend'))return;
  const stamp=turn;
  const box=panel(where,reportOnly?'Historian çıktısı':'Historian sorgusu');
  const f=form(box),tag=field(f,'tag','Etiket',{values:[],required:true});
  const period=field(f,'period','Zaman aralığı',{values:[['15','15 dakika'],['60','1 saat'],['1440','24 saat'],['10080','7 gün']]});
  const kind=field(f,'kind','Grafik',{values:[['line','Çizgi'],['area','Alan'],['bar','Sütun'],['point','Nokta']]});
  const live=field(f,'live','Otomatik yenile',{type:'checkbox'});
  f.append(el('button','Kayıtları getir',{type:'submit'}));
  const actions=el('div',null,{class:'studio-actions'}),visual=el('div'),rows=el('div');box.append(actions,visual,rows);
  await samples();if(stamp!==turn)return;
  fillOptions(tag,sourceRows.map(r=>r.tag));
  let busy=false;
  const refresh=async()=>{
    if(!tag.value||busy||stamp!==turn)return;
    busy=true;
    try{
      const selected=tag.value,to=Date.now();
      const query=new URLSearchParams({tag:selected,from:to-Number(period.value)*60000,to,limit:5000});
      const data=await api('history?'+query);
      if(stamp!==turn)return;
      chart(visual,data.rows,kind.value);
      table(rows,['Zaman','Değer','Kalite'],data.rows.slice(-12).reverse().map(r=>[clock(r.at),val(r.value),quality(r.quality)]));
      actions.replaceChildren(...['pdf','xlsx','csv'].map(fmt=>el('a',fmt.toUpperCase()+' indir',{href:'/api/report?'+query+'&format='+fmt})));
      message(where,data.rows.length+' kayıt · '+selected);
    }finally{busy=false;}
  };
  f.onsubmit=act(where,refresh);await refresh();
  repeat(stamp,()=>live.checked?refresh():null,where,3500);
}
async function alarms(where){
  if(!heading(where,'Alarm yönetimi'))return;
  const stamp=turn;
  const box=panel(where,'Yeni eşik kuralı'),f=form(box);
  const tag=field(f,'tag','Bağlantı etiketi',{values:[],required:true});
  const low=field(f,'low','Alt sınır',{type:'number',required:true});
  const high=field(f,'high','Üst sınır',{type:'number',required:true});
  const priority=field(f,'priority','Öncelik',{values:['Düşük','Orta','Yüksek','Kritik'],value:'Yüksek'});
  f.append(el('button','Kuralı kaydet',{type:'submit'}));
  const rules=el('div'),events=el('div');panel(where,'Kurallar').append(rules);panel(where,'Alarm geçmişi ve onay').append(events);
  await samples();fillOptions(tag,[...sourceTypes.keys()]);
  const refresh=async()=>{
    const [config,live]=await Promise.all([api('studio/settings'),api('live')]);if(stamp!==turn)return;
    table(rules,['Etiket','Alt','Üst','Öncelik','İşlem'],Object.entries(config.alarms).map(([name,r])=>[name,val(r.low),val(r.high),r.priority,
      config.editableAlarms.includes(name)?button('Sil',act(where,async()=>{await api('studio/settings',{action:'remove-alarm',tag:name});await refresh();})):'Sunucu ayarı']));
    const states={HIGH:'Yüksek',LOW:'Düşük',UNKNOWN:'Veri yok',NORMAL:'Normal'};
    table(events,['Saat','Etiket','Öncelik','Durum','Onay'],live.alarms.map(a=>[clock(a.at),a.tag,a.priority,states[a.state]??a.state,
      a.acknowledgedAt?clock(a.acknowledgedAt):['HIGH','LOW'].includes(a.state)?button('Onayla',act(where,async()=>{await api('alarm/ack',{id:a.id});await refresh();})):'—']));
  };
  f.onsubmit=act(where,async()=>{await api('studio/settings',{action:'alarm',tag:tag.value,low:low.valueAsNumber,high:high.valueAsNumber,priority:priority.value});await refresh();});
  await refresh();repeat(stamp,refresh,where,2500);
}
async function runtime(where){
  if(!heading(where,'Sunucu–istemci ve yedeklilik'))return;
  const stamp=turn,output=el('div');
  panel(where,'Sunucu çalışma durumu').append(output);
  panel(where,'Tarayıcı istemcileri').append(el('p','Bu editör TURKO Studio sunucusuna bağlı. İşletim rollerinde yönetici, operatör ve izleyici kullanılabilir.'));
  const refresh=async()=>{
    const state=await api('studio/settings');if(stamp!==turn)return;
    table(output,['Öğe','Durum'],[['Bu sunucu',state.instance+' · '+state.role],['Aktif toplayıcı',state.collector],['Toplama yetkisi süresi',clock(state.leaseUntil)],
      ['OPC UA',state.opcOnline?'Yayında':'Kapalı'],['Yedeklilik',state.redundancy]]);
  };
  await refresh();repeat(stamp,refresh,where);
}
async function versions(where){
  if(!heading(where,'Proje sürümleri'))return;
  const box=panel(where,'Açık projeyi sürümle'),rows=el('div');
  const refresh=async()=>{
    const result=await api('revisions');
    table(rows,['Sürüm','Proje','Tarih','İşlem'],result.map(r=>{
      const actions=el('div',null,{class:'studio-actions'});
      actions.append(el('a','İndir',{href:'/api/revisions/'+r.id}),button('Editörde aç',act(where,async()=>{
        if(!confirm('Bu sürüm yeni proje oturumu olarak açılsın mı?'))return;
        project('restore',{project:await api('revisions/'+r.id)});
      })));
      return [r.id,r.name,clock(r.at),actions];
    }));
  };
  box.append(button('Açık projeyi sürümle',act(where,async()=>{
    const p=project('snapshot');if(!p)throw Error('Açık proje bulunamadı.');
    const result=await api('revisions',p);await refresh();message(where,'Sürüm '+result.id+' kaydedildi.');
  })),rows);
  await refresh();
}
async function audit(where){
  if(!heading(where,'İşlem günlüğü'))return;
  const box=panel(where,'Son işlemler'),rows=el('div');box.append(rows);
  const refresh=async()=>table(rows,['Saat','İşlem'],(await api('audit')).map(r=>[clock(r.at),r.event]));
  box.prepend(button('Yenile',act(where,refresh)));await refresh();
}
let processScene;
async function process3d(where){
  if(!heading(where,'3B proses izleme'))return;
  const stamp=turn;
  const box=panel(where,'Tank ve pompa'),f=form(box);
  const level=field(f,'level','Seviye etiketi',{values:[]});
  const pump=field(f,'pump','Pompa etiketi',{values:[]});
  const output=el('p','');box.append(output);
  if(!processScene){
    const viewport=el('div',null,{class:'studio-3d'});
    box.append(viewport);
    try{
      const {createScene}=await import('./scene.js');
      processScene={viewport,update:createScene(viewport)};
    }catch{viewport.remove();message(where,'Tarayıcı WebGL görünümünü başlatamadı.',true);return;}
  }else box.append(processScene.viewport);
  await samples();
  const numeric=sourceRows.filter(r=>typeof r.value==='number').map(r=>r.tag);
  const bool=sourceRows.filter(r=>typeof r.value==='boolean').map(r=>r.tag);
  fillOptions(level,numeric);fillOptions(pump,bool);
  if(numeric.includes('TANK'))level.value='TANK';
  if(bool.includes('POMPA'))pump.value='POMPA';
  const refresh=async()=>{
    const {values}=await api('live');if(stamp!==turn)return;
    const levelRow=values.find(r=>r.tag===level.value&&r.quality==='GOOD');
    const pumpRow=values.find(r=>r.tag===pump.value&&r.quality==='GOOD');
    processScene.update(levelRow?.value??0,pumpRow?.value===true);
    output.textContent='Seviye '+val(levelRow?.value)+' % · Pompa '+val(pumpRow?.value);
  };
  f.onsubmit=act(where,refresh);level.onchange=pump.onchange=act(where,refresh);
  await refresh();repeat(stamp,refresh,where);
}
async function transforms(where){
  if(!heading(where,'Veri dönüşümleri'))return;
  const stamp=turn,box=panel(where,'JavaScript ve Python'),results=el('div');
  const config=await api('studio/settings');
  box.append(el('p','JavaScript: '+(config.scriptConfigured?'etkin':'kapalı')+' · Python: '+(config.pythonConfigured?'etkin':'kapalı')),
    el('p','Sunucu yöneticisinin kurduğu modüllerin ürettiği JS_ etiketleri aşağıda görünür.'),results);
  const refresh=async()=>{
    const {values}=await api('live');if(stamp!==turn)return;
    table(results,['Türetilen etiket','Değer','Kalite','Saat'],values.filter(v=>v.tag.startsWith('JS_')).map(v=>[v.tag,val(v.value),quality(v.quality),clock(v.at)]));
  };
  await refresh();repeat(stamp,refresh,where);
}
let timer;
function repeat(stamp,task,where,delay=1500){
  if(stamp!==turn)return;
  clearTimeout(timer);
  timer=setTimeout(async()=>{
    if(stamp!==turn)return;
    try{await task();}catch(error){message(where,error.message,true);}
    repeat(stamp,task,where,delay);
  },delay);
}
const pages={connections,ua:where=>connections(where,'opcua'),mqtt:where=>connections(where,'mqtt'),
  tags:liveTags,historian:where=>historian(where,false),reports:where=>historian(where,true),alarms,runtime,versions,audit,process3d,transforms};
root?.addEventListener('studio:view',event=>{
  current=event.detail;turn++;clearTimeout(timer);
  const where=$(current==='tags'?'studio-live-tags':'studio-'+current);
  if(where&&pages[current])Promise.resolve(pages[current](where)).catch(error=>message(where,error.message,true));
});
