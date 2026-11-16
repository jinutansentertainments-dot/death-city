// Shared by server (require) and browser (<script>): same city layout + collision on both sides.
(function(g){
const S={R:100,CAR:{x:20,z:20},NEED:{engine:1,tire:4,battery:1,fuel:1,tools:1,keys:1}};
let s=7;const r=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
S.B=[];for(const x of [-80,-40,0,40,80])for(const z of [-80,-40,0,40,80]){if(r()<.12)continue;S.B.push({x,z,w:24,d:24,h:8+Math.floor(r()*24)})}
S.C=[];for(let i=0;i<80&&S.C.length<30;i++){const a=[-60,-20,20,60][Math.floor(r()*4)],c=(r()-.5)*180,v=r()<.5,o=(r()-.5)*4;
 if([-60,-20,20,60].some(q=>Math.abs(c-q)<12))continue;S.C.push({x:v?a+o:c,z:v?c:a+o,w:v?2.3:4.6,d:v?4.6:2.3,h:1.5,col:Math.floor(r()*6)})}
S.ALL=S.B.concat(S.C);
S.collide=(p,rad)=>{for(const b of S.ALL){const dx=p.x-b.x,dz=p.z-b.z,hx=b.w/2+rad,hz=b.d/2+rad;
 if(Math.abs(dx)<hx&&Math.abs(dz)<hz){if(hx-Math.abs(dx)<hz-Math.abs(dz))p.x=b.x+(dx<0?-hx:hx);else p.z=b.z+(dz<0?-hz:hz)}}
 p.x=Math.max(-S.R,Math.min(S.R,p.x));p.z=Math.max(-S.R,Math.min(S.R,p.z))};
S.street=rnd=>{const a=[-60,-20,20,60][Math.floor(rnd()*4)],c=(rnd()-.5)*180;return rnd()<.5?{x:a,z:c}:{x:c,z:a}};
if(typeof module!=='undefined')module.exports=S;else g.S=S;
})(typeof window!=='undefined'?window:globalThis);
