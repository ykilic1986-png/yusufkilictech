const baseURL=new URL('./assets/',import.meta.url);
export class MachineView{
 constructor(canvas){this.c=canvas;this.ctx=canvas.getContext('2d');this.images={};this.ready=Promise.all(['motor','tower','head','base'].map(n=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.images[n]=im;resolve();};im.onerror=()=>reject(Error(n+' görseli yüklenemedi.'));im.src=new URL(n+'.png',baseURL);})));canvas.width=1280;canvas.height=605;}
 draw(plc){
 const g=this.ctx,W=1280,H=605;g.clearRect(0,0,W,H);g.fillStyle='#eef4f7';g.fillRect(0,0,W,H);
 const y=x=>470-.065*x,poly=(pts,fill,stroke)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}},line=(a,b,c,width=2)=>{g.beginPath();g.moveTo(...a);g.lineTo(...b);g.strokeStyle=c;g.lineWidth=width;g.stroke();},text=(x,y,s,size=16,color='#12304a')=>{g.font=`600 ${size}px system-ui`;g.fillStyle=color;g.fillText(s,x,y);};
 g.fillStyle='#d9e4eb';g.beginPath();g.ellipse(650,566,565,24,0,0,Math.PI*2);g.fill();
 poly([[100,493],[1140,425],[1180,463],[140,534]],'#718695','#536a7d');poly([[140,534],[1180,463],[1180,506],[140,576]],'#405969');
 for(const x of [160,460,820,1120]){const yy=y(x)+80;poly([[x,yy],[x+28,yy-2],[x+28,yy+55],[x,yy+58]],'#8095a2');g.fillStyle='#607988';g.fillRect(x-11,yy+53,54,11);}
 for(const off of [42,62])line([115,y(115)+off],[1160,y(1160)+off],'#d7e6ef',9);
 for(let x=125;x<1160;x+=14)line([x,y(x)+68],[x+5,y(x)+72],'#1d3443',3);
 for(let x=45;x<1240;x+=65){const yy=y(x)+25;poly([[x,yy],[x+28,yy-19],[x+63,yy-21],[x+33,yy+4]],'#9aafba','#546d7c');g.beginPath();g.arc(x+24,yy+7,10,0,Math.PI*2);g.fillStyle='#237d83';g.fill();const a=plc.encoder*.04;line([x+24,yy+7],[x+24+7*Math.cos(a),yy+7+7*Math.sin(a)],'white',2);}
 // The gap and the cut piece stay on the same conveyor plane throughout.
 let cutx=750+(plc.phase-50)*.52;let gap=plc.piece?Math.min(90,(plc.encoder-plc.piece.encoder)*.23):0;
 if(plc.piece)cutx=plc.piece.cutX+(plc.encoder-plc.piece.encoder)*.52;
 const prof=(a,b)=>{if(b<=a)return;poly([[a,y(a)],[b,y(b)],[b,y(b)+25],[a,y(a)+25]],'#aebdc7','#607686');poly([[a,y(a)],[a+12,y(a)-12],[b+12,y(b)-12],[b,y(b)]],'#e0e9ee','#8195a1');};
 if(plc.piece){prof(-20,Math.min(1300,cutx));prof(Math.max(-20,cutx+gap),1300);}else prof(-20,1300);
 for(let n=-35;n<35;n++){let x=((n*95+plc.encoder*.52)%2470+2470)%2470-600;if(plc.piece&&x>cutx)x+=gap;if(x<0||x>1280||plc.piece&&x>cutx&&x<cutx+gap)continue;const yy=y(x);poly([[x,yy],[x+6,yy],[x+6,yy+24],[x,yy+24]],'#167db0');line([x,yy],[x+12,yy-12],'#167db0',4);}
 // Stationary E1 encoder: only its measuring wheel rotates.
 const ex=135,ey=y(ex)-39;g.fillStyle='#ed9a29';g.fillRect(ex-16,ey-89,27,65);line([ex+5,ey-34],[ex+15,ey+17],'#ed9a29',10);g.beginPath();g.arc(ex,ey+17,22,0,Math.PI*2);g.fillStyle='#334958';g.fill();g.strokeStyle='#d7e6eb';g.lineWidth=4;g.stroke();
 for(let k=0;k<4;k++){const a=plc.encoder*.04+k*Math.PI/2;line([ex,ey+17],[ex+17*Math.cos(a),ey+17+17*Math.sin(a)],'white',2);}text(42,310,'E1 · Hat enkoderi',16);
 const cx=plc.x*.52,ox=-20+cx,oy=86-.065*cx,S=.7;
 poly([[ox+680*S,oy+510*S],[ox+1190*S,oy+480*S],[ox+1190*S,oy+610*S],[ox+750*S,oy+642*S]],'#16898f','#126369');
 const put=(name,x,y,dy=0)=>{if(this.images[name])g.drawImage(this.images[name],ox+x*S,oy+y*S+dy);};put('base',680,500);put('tower',898,94);
 const pts=[[827,150],[1144,132],[1240,215],[1240,500],[827,530],[827,150]];for(let j=1;j<pts.length;j++)line([ox+pts[j-1][0]*S,oy+pts[j-1][1]*S],[ox+pts[j][0]*S,oy+pts[j][1]*S],'#8cabb5',3);
 put('head',1000,139,plc.depth);
 const bx=ox+1100*S,by=oy+391*S+plc.depth;for(let k=0;k<5;k++){const a=(plc.blocks.Power?.Status?plc.seconds*18:0)+k*2*Math.PI/5;line([bx+8*Math.cos(a),by+8*Math.sin(a)],[bx+30*Math.cos(a),by+30*Math.sin(a)],'#e0e8ea',2);}put('motor',628,358);
 const mx=ox+944*S,my=oy+441*S;g.fillStyle='#ed9a29';g.fillRect(mx,my-20,38,plc.clampClosed?34:13);g.fillStyle=plc.clampClosed?'#20edb2':'#b9d0dd';g.fillRect(mx+27,my-15,7,7);
 text(ox+624*S,oy+337*S,'M1 · Araba servosu',15);text(ox+974*S,oy+60*S,'M2 · Testere',15);
 text(30,40,plc.status,23,plc.fault?'#b42e39':'#16898f');text(30,580,'Mavi çizgiler profile bağlıdır. Kesilen parça rulolarda taşınır.',16,'#177ba4');
 line([278,81],[425,81],'#167db0',5);poly([[425,81],[411,73],[411,89]],'#167db0');text(278,65,'SÜREKLİ PROFİL AKIŞI',14,'#167db0');
 if(plc.piece&&cutx+gap<1260)text(Math.min(1070,cutx+gap),y(cutx)-38,'KESİLEN PARÇA',14,'#087b68');
 }
}
