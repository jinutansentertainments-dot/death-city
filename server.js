const express=require('express'),http=require('http'),{Server}=require('socket.io'),S=require('./shared');
const app=express(),srv=http.createServer(app),io=new Server(srv),rr=Math.random;
app.get('/',(q,r)=>r.sendFile(__dirname+'/index.html'));
app.get('/shared.js',(q,r)=>r.sendFile(__dirname+'/shared.js'));
app.get('/health',(q,r)=>r.send('ok'));
const rooms=new Map(),PARTS=Object.keys(S.NEED),DT=.05,
 TYPES=['engine','tire','tire','tire','tire','battery','fuel','tools','keys','med','med','med'],
 blank=()=>({engine:0,tire:0,battery:0,fuel:0,tools:0,keys:0,med:0}),
 dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),sp=()=>S.street(rr);
function reset(p){Object.assign(p,sp(),{hp:100,inf:0,team:'human',inv:blank(),mx:0,mz:0,cd:0,ry:0,sp:0})}
function init(R){R.state='lobby';R.end=null;R.car=blank();
 R.loot=TYPES.map((t,i)=>({id:i,t,...sp()}));
 R.zombies=Array.from({length:24},(_,i)=>({id:i,...sp(),ry:0,hp:60,cd:0,wx:0,wz:0,wt:0}));
 R.players.forEach(reset)}
function mkRoom(){let c;do c=Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rr()*24)]).join('');while(rooms.has(c));
 const R={code:c,players:new Map(),host:null};init(R);rooms.set(c,R);return R}
const meta=R=>({code:R.code,state:R.state,host:R.host,end:R.end,car:R.car,loot:R.loot.map(l=>[l.id,l.t,l.x,l.z])}),
 sendM=R=>io.to(R.code).emit('m',meta(R)),note=(R,t)=>io.to(R.code).emit('n',t),
 tell=(p,t)=>io.to(p.sock).emit('n',t),sendI=p=>io.to(p.sock).emit('i',p.inv);
function turn(R,p){p.team='zombie';p.hp=100;p.inf=100;p.inv=blank();sendI(p);note(R,p.name+' turned into a zombie!')}
function bite(R,h){if(h.team!=='human'||R.state!=='playing')return;h.hp-=8;h.inf=h.inf+30;
 if(h.hp<=0||h.inf>=100)turn(R,h);else tell(h,'You were bitten! Find a medkit (H)')}

io.on('connection',s=>{
 const ctx=()=>{const R=rooms.get(s.data.rc),p=R&&R.players.get(s.data.pid);return p?[R,p]:null};
 s.on('join',(d,cb)=>{d=d||{};
  const R=d.create?mkRoom():rooms.get(String(d.code||'').toUpperCase());
  if(!R)return cb({err:'Room not found. Check the code.'});
  let p=d.token&&[...R.players.values()].find(q=>q.token===d.token);
  if(!p){if(R.players.size>=12)return cb({err:'Room is full (12 players).'});
   p={id:s.id,token:d.token,name:String(d.name||'Survivor').slice(0,14)};reset(p);R.players.set(p.id,p)}
  p.sock=s.id;p.online=true;p.off=0;s.data={rc:R.code,pid:p.id};s.join(R.code);
  const h=R.players.get(R.host);if(!h||!h.online)R.host=p.id;
  sendM(R);sendI(p);note(R,p.name+' joined');cb({code:R.code,id:p.id})});
 s.on('in',d=>{const x=ctx();if(!x)return;const p=x[1];p.mx=+d.mx||0;p.mz=+d.mz||0;p.sp=d.sp?1:0});
 s.on('start',()=>{const x=ctx();if(!x||x[1].id!==x[0].host)return;const R=x[0];
  if(R.state==='over')init(R);R.state='playing';sendM(R);R.players.forEach(sendI)});
 s.on('act',()=>{const x=ctx();if(!x)return;const[R,p]=x;if(R.state!=='playing'||p.team!=='human')return;
  const l=R.loot.find(l=>dist(l,p)<3);
  if(l){R.loot=R.loot.filter(q=>q!==l);p.inv[l.t]++;tell(p,'Picked up '+l.t);sendI(p);return sendM(R)}
  if(dist(S.CAR,p)<6){let n=0;for(const k of PARTS){const t=Math.min(S.NEED[k]-R.car[k],p.inv[k]);if(t>0){R.car[k]+=t;p.inv[k]-=t;n+=t}}
   const done=PARTS.every(k=>R.car[k]>=S.NEED[k]);
   if(done&&!n){R.state='over';R.end='humans';note(R,'The engine roars. You escaped!')}
   else if(n)note(R,done?'Car repaired! Press E at the car to escape':p.name+' installed '+n+' part(s)');
   else tell(p,'You have no parts to install');
   sendI(p);sendM(R)}});
 s.on('atk',()=>{const x=ctx();if(!x)return;const[R,p]=x;if(R.state!=='playing'||p.team!=='human'||p.cd>0)return;p.cd=.5;
  [...R.zombies,...[...R.players.values()].filter(q=>q.team==='zombie')].forEach(z=>{if(dist(z,p)<2.6)z.hp-=34})});
 s.on('heal',()=>{const x=ctx();if(!x)return;const p=x[1];
  if(p.team==='human'&&p.inv.med>0){p.inv.med--;p.inf=0;p.hp=Math.min(100,p.hp+40);sendI(p);tell(p,'Infection cured')}});
 s.on('disconnect',()=>{const x=ctx();if(!x||x[1].sock!==s.id)return;const[R,p]=x;
  p.online=false;p.off=Date.now();p.mx=p.mz=0;
  if(R.host===p.id){const n=[...R.players.values()].find(q=>q.online);if(n){R.host=n.id;sendM(R)}}
  note(R,p.name+' lost connection (60s to rejoin)')})});

setInterval(()=>{const now=Date.now();
 for(const R of rooms.values()){
  for(const p of R.players.values())if(!p.online&&now-p.off>120000)R.players.delete(p.id);
  if(!R.players.size){rooms.delete(R.code);continue}
  const P=[...R.players.values()],play=R.state==='playing';
  for(const p of P){p.cd=Math.max(0,p.cd-DT);const l=Math.hypot(p.mx,p.mz);
   if(l>.05&&p.online){const v=p.team==='zombie'?4:p.sp?7:4.5;p.x+=p.mx/l*v*DT;p.z+=p.mz/l*v*DT;p.ry=Math.atan2(p.mx,p.mz);S.collide(p,.5)}
   if(!play)continue;
   if(p.team==='human'&&p.inf>0){p.inf+=2*DT;if(p.inf>=100)turn(R,p)}
   if(p.team==='zombie'){if(p.hp<=0)Object.assign(p,sp(),{hp:100});
    if(p.cd<=0&&p.online){const h=P.find(q=>q.team==='human'&&dist(q,p)<1.8);if(h){bite(R,h);p.cd=1.2}}}}
  if(play){const hs=P.filter(p=>p.team==='human'&&p.online);
   for(const z of R.zombies){if(z.hp<=0){Object.assign(z,sp(),{hp:60});continue}
    z.cd=Math.max(0,z.cd-DT);let t=null,bd=28;for(const h of hs){const d=dist(h,z);if(d<bd){bd=d;t=h}}
    let tx,tz,v;
    if(t){tx=t.x;tz=t.z;v=2.8}else{if((z.wt-=DT)<0||Math.hypot(z.wx-z.x,z.wz-z.z)<2){z.wt=6;z.wx=z.x+(rr()-.5)*30;z.wz=z.z+(rr()-.5)*30}tx=z.wx;tz=z.wz;v=1.2}
    const dx=tx-z.x,dz=tz-z.z,d=Math.hypot(dx,dz)||1;
    if(!t||d>1.4){z.x+=dx/d*v*DT;z.z+=dz/d*v*DT;z.ry=Math.atan2(dx,dz);S.collide(z,.5)}
    if(t&&d<1.6&&z.cd<=0){bite(R,t);z.cd=1.2}}
   if(!P.some(p=>p.team==='human')){R.state='over';R.end='zombies';sendM(R);note(R,'Every survivor has fallen.')}}
  io.to(R.code).emit('s',{p:P.map(p=>[p.id,p.name,+p.x.toFixed(1),+p.z.toFixed(1),+p.ry.toFixed(2),Math.max(0,p.hp|0),p.inf|0,p.team==='zombie'?1:0,p.online?1:0]),
   z:R.zombies.map(z=>[+z.x.toFixed(1),+z.z.toFixed(1),+z.ry.toFixed(2)])})}},50);
srv.listen(process.env.PORT||3000,()=>console.log('Dead City server running'));
