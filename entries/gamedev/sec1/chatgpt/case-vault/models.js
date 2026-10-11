import * as T from './vendor/three.module.js';
import {WEAPONS,CASES} from './economy.js';
const metal=new T.MeshStandardMaterial({color:0x242d30,metalness:.8,roughness:.36});
const rubber=new T.MeshStandardMaterial({color:0x101716,roughness:.9});
const steel=new T.MeshStandardMaterial({color:0x65716d,metalness:.9,roughness:.28});
export function box(g,x,y,z,w,h,d,m){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
export function cylinder(g,x,y,z,r,l,m,axis='y',r2=r){const o=new T.Mesh(new T.CylinderGeometry(r,r2,l,12),m);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const skinTextures=new Map();
export function skinMaterial(skin){
 if(!skin)return new T.MeshStandardMaterial({color:0x52604e,metalness:.55,roughness:.5});
 let texture=skinTextures.get(skin.id);
 if(!texture){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d'),r=rng(skin.id.split('').reduce((a,c)=>a+c.charCodeAt(0),1));const [a,b]=skin.colors;ctx.fillStyle=b;ctx.fillRect(0,0,512,256);
 if(skin.design==='field'){for(let i=0;i<70;i++){ctx.fillStyle=i%2?a:b;ctx.globalAlpha=.35+r()*.5;ctx.beginPath();ctx.ellipse(r()*512,r()*256,15+r()*90,4+r()*30,r()*3,0,7);ctx.fill();}}
 if(skin.design==='stripe'){ctx.fillStyle=a;for(let i=-256;i<800;i+=70){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+28,0);ctx.lineTo(i-160,256);ctx.lineTo(i-188,256);ctx.fill();}}
 if(skin.design==='camo'){for(let i=0;i<170;i++){ctx.globalAlpha=.3+r()*.65;ctx.fillStyle=i%3?a:'#152c39';ctx.fillRect(Math.floor(r()*32)*16,Math.floor(r()*16)*16,16+Math.floor(r()*3)*16,16+Math.floor(r()*3)*16);}}
 if(skin.design==='circuit'){ctx.strokeStyle=a;ctx.lineWidth=3;for(let i=0;i<24;i++){const x=r()*512,y=r()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45,y);ctx.lineTo(x+70,y+25);ctx.lineTo(x+150,y+25);ctx.stroke();ctx.fillStyle=a;ctx.fillRect(x-3,y-3,6,6);}ctx.fillStyle=a;ctx.fillRect(0,215,512,12);}
 if(skin.design==='marble'){for(let i=0;i<35;i++){ctx.strokeStyle=i%3===0?'#eee4e2':a;ctx.globalAlpha=.3+r()*.5;ctx.lineWidth=2+r()*15;ctx.beginPath();ctx.moveTo(-20,i*12-40);ctx.bezierCurveTo(180,Math.sin(i)*100+i*8,300,Math.cos(i)*90+i*8,550,i*11-10);ctx.stroke();}}
 if(skin.design==='prism'){for(let x=0;x<512;x+=64)for(let y=0;y<256;y+=64){ctx.fillStyle=[a,b,'#e1cce9','#28594f','#77a9c7'][Math.floor(r()*5)];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+64,y+64);ctx.lineTo(x+(r()>.5?64:0),y+(r()>.5?0:64));ctx.fill();ctx.strokeStyle='#e8fff755';ctx.lineWidth=1;ctx.stroke();}}
 if(skin.design==='facet'){ctx.strokeStyle=a;ctx.lineWidth=4;for(let x=-128;x<600;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+128,128);ctx.lineTo(x,256);ctx.stroke();}for(let i=0;i<12;i++){ctx.fillStyle=a;ctx.globalAlpha=.2+r()*.7;let x=r()*512,y=r()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+90,y+30);ctx.lineTo(x+30,y+65);ctx.fill();}}
 ctx.globalAlpha=.12;for(let i=0;i<1600;i++){ctx.fillStyle=r()>.5?'#fff':'#000';ctx.fillRect(r()*512,r()*256,r()*3,1);}texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;skinTextures.set(skin.id,texture);}
 return new T.MeshStandardMaterial({map:texture,metalness:skin.rarity==='legendary'?.78:.48,roughness:skin.rarity==='legendary'?.25:.43});
}
// Stylized original models: x is the barrel axis, +x is the muzzle.
export function weaponModel(id,skin){const g=new T.Group(),paint=skinMaterial(skin);const type=WEAPONS.find(w=>w.id===id).type;
 const grip=(x,y,len=.4,ang=-.22)=>{const o=box(g,x,y,0,.17,len,.16,rubber);o.rotation.z=ang;for(let i=0;i<4;i++)box(g,x-.005,y-.12+i*.07,.087,.12,.018,.01,metal);};
 const barrel=(x,y,len,r=.044)=>{cylinder(g,x,y,0,r,len,metal,'x');cylinder(g,x+len/2-.01,y,0,r*1.2,.07,steel,'x');cylinder(g,x+len/2+.029,y,0,r*.65,.008,rubber,'x');};
 const rail=(x,y,len)=>{box(g,x,y,0,len,.05,.13,metal);for(let i=0;i<len/.075;i++)box(g,x-len/2+i*.075,y+.038,0,.03,.035,.15,steel);};
 const stock=(x,y,len=.6)=>{box(g,x,y,0,len,.22,.19,rubber);const o=box(g,x-len/2,y-.05,0,.1,.35,.22,rubber);o.rotation.z=-.10;};
 const trigger=(x,y)=>{box(g,x,y-.10,0,.24,.035,.075,metal);box(g,x+.1,y,0,.035,.2,.075,metal);box(g,x,y,0,.023,.1,.05,steel).rotation.z=-.4;};
 if(type==='pistol'){const de=id==='deagle',len=de?.83:.64;box(g,.04,.15,0,len,.17,.18,paint);barrel(.25,.16,len*.65,.045);box(g,-.03,.02,0,.52,.12,.17,metal);grip(-.20,-.20,de?.44:.36,-.23);trigger(.015,-.09);for(let i=0;i<6;i++)box(g,-.26+i*.025,.15,.095,.01,.1,.01,steel);box(g,-.25,.25,0,.04,.045,.08,metal);box(g,len/2-.025,.25,0,.03,.04,.055,metal);}
 else if(id==='p90'){box(g,-.28,.05,0,1.04,.36,.26,paint);box(g,.13,.17,0,.65,.20,.21,paint);stock(-.79,.03,.16);barrel(.68,.16,.38,.044);box(g,-.15,.29,0,.94,.10,.17,new T.MeshStandardMaterial({color:0xa99856,transparent:true,opacity:.7,metalness:.2,roughness:.35}));for(let i=0;i<14;i++)box(g,-.58+i*.06,.30,0,.025,.04,.12,steel);box(g,.02,-.13,.14,.3,.23,.015,rubber);rail(.12,.51,.55);box(g,-.1,.37,0,.09,.23,.08,metal);box(g,.35,.37,0,.09,.23,.08,metal);grip(.34,-.2,.25,.2);}
 else{
 const ak=id==='ak',m4=id==='m4',smg=id==='mp5',shot=type==='shotgun',lmg=type==='lmg';const body=shot?.65:lmg?.93:.72;
 box(g,-.17,.13,0,body,.25,lmg?.27:.19,paint);box(g,.42,.15,0,shot?.7:smg?.38:.62,shot?.17:.21,.18,paint);
 const bl=shot?.9:lmg?.85:m4?.66:ak?.62:.3;barrel(shot?1.03:lmg?1.1:m4?.99:ak?.92:.70,.18,bl,shot?.064:.038);
 if(shot){cylinder(g,.65,.03,0,.045,1.15,metal,'x');stock(-.94,.04,.68);if(id==='nova')for(let i=0;i<10;i++)box(g,.16+i*.043,.15,.098,.021,.16,.024,rubber);else rail(-.17,.30,.48);}
 else {stock(smg?-.89:-1.02,.12,smg?.54:.70);rail(-.15,.30,body);grip(-.32,-.20);trigger(-.12,-.085);
 if(lmg){box(g,-.10,-.2,0,.40,.37,.31,paint);box(g,-.11,-.39,0,.42,.04,.33,rubber);for(let i=0;i<6;i++)cylinder(g,-.36+i*.052,.17,.19,.018,.17,new T.MeshStandardMaterial({color:0xb49953,metalness:.7,roughness:.35}),'z');const leg=box(g,.96,-.16,.17,.035,.55,.035,metal);leg.rotation.x=.3;const leg2=box(g,.96,-.16,-.17,.035,.55,.035,metal);leg2.rotation.x=-.3;box(g,.05,.41,0,.39,.035,.05,rubber);box(g,-.13,.34,0,.03,.14,.05,metal);}
 else{const mag=box(g,.1,-.18,0,ak?.22:.17,ak?.55:smg?.4:.43,ak?.15:.12,ak?paint:metal);mag.rotation.z=ak?.25:-.10;if(ak){box(g,.19,-.43,0,.22,.19,.15,paint).rotation.z=.45;}for(let i=0;i<4;i++)box(g,.08+i*.033,-.2,.078,.012,.27,.01,steel);}
 if(id==='negev'){box(g,.42,.29,0,.62,.13,.24,paint);for(let i=0;i<7;i++)box(g,.17+i*.073,.29,.125,.038,.065,.008,rubber);box(g,-1.08,.07,.106,.35,.13,.025,paint);rail(.43,.4,.5);grip(.45,-.16,.32,.08);}
 if(id==='m249'){cylinder(g,.47,.15,0,.13,.6,paint,'x');for(let i=0;i<6;i++)box(g,.20+i*.095,.15,.129,.05,.055,.012,rubber);box(g,-.13,.02,.22,.43,.27,.23,paint);}
 if(m4){cylinder(g,1.40,.18,0,.07,.38,metal,'x');box(g,-.15,.44,0,.35,.04,.075,metal);box(g,-.30,.36,0,.035,.15,.075,metal);box(g,.0,.36,0,.035,.15,.075,metal);}
 if(ak){cylinder(g,.46,.31,0,.027,.62,metal,'x');box(g,.81,.3,0,.06,.25,.07,metal);}
 if(smg){box(g,.55,.29,0,.06,.16,.1,metal);cylinder(g,.56,.39,0,.07,.025,steel,'x');}
 }
 for(let i=0;i<3;i++)cylinder(g,-.40+i*.14,.12,.105,.018,.013,steel,'z');box(g,-.12,.18,.111,.13,.06,.015,metal);}
 g.userData.weapon=id;return g;
}
export function label(text,w=512,h=128,fg='#d5dcbb',bg='#00000000',size=42){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font=`bold ${size}px monospace`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2,w-24);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:t,transparent:true,side:T.DoubleSide});return new T.Mesh(new T.PlaneGeometry(w/200,h/200),m);}
export function caseModel(id='assault',scale=1){const info=CASES.find(x=>x.id===id),g=new T.Group(),paint=new T.MeshStandardMaterial({color:info.color,metalness:.55,roughness:.60});const dark=new T.MeshStandardMaterial({color:0x25352d,roughness:.72,metalness:.4});box(g,0,.20,0,1.35,.40,.85,dark);const lid=new T.Group();lid.position.set(0,.40,-.425);box(lid,0,.05,.425,1.40,.1,.90,paint);g.add(lid);for(const x of [-.48,.48]){box(g,x,.20,.438,.13,.25,.03,metal);box(g,x,.25,.462,.07,.1,.04,steel);}for(const z of [-.31,.31])box(lid,0,.115,z+.425,1.15,.027,.035,metal);const l=label(id==='legendary'?'★ VAULT ★':'CV / '+info.name.toUpperCase(),512,100,'#16251a',undefined,40);l.rotation.x=-Math.PI/2;l.scale.setScalar(.32);l.position.set(0,.12,.425);lid.add(l);box(g,0,.18,.46,.3,.06,.08,rubber);g.scale.setScalar(scale);g.userData.lid=lid;return g;}
export function disposeModel(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==metal&&o.material!==rubber&&o.material!==steel){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
