/* Elatra E-Alpha — offline, procedural 3D product study. */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const smooth = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected='performance', chapter=-1, progress=0, targetProgress=0, lastTime=0;
const descriptions={everyday:'Standard camera + balanced everyday modules.',creator:'Large camera optics + expanded storage.',performance:'Vented compute module + dynamic audio.'};
const details={camera:['A new perspective.','The high-performance camera concept pairs a larger primary lens with a dedicated periscope lens. Swap the camera module while keeping the E-Alpha chassis.','creator'],compute:['Room to push further.','The performance boost concept introduces a vented CPU/GPU module with dedicated cooling. Its visible fan and heat-dissipation fins replace the standard upper module.','performance'],audio:['Feel every detail.','The dynamic audio concept replaces the lower module with a dedicated stereo speaker assembly. Two visible grilles give this configuration its own character.','performance'],storage:['Keep more of your world.','The memory and storage expansion concept adds another way to adapt E-Alpha. Explore it as part of the Creator configuration.','creator']};
function chooseConfig(name){selected=name;$$('[data-config]').forEach(b=>{b.classList.toggle('selected',b.dataset.config===name);b.setAttribute('aria-pressed',b.dataset.config===name)});$('#config-description').textContent=descriptions[name];}
$$('[data-config]').forEach(b=>b.addEventListener('click',()=>chooseConfig(b.dataset.config)));
$$('[data-module]').forEach(b=>b.addEventListener('click',()=>{const d=details[b.dataset.module];$('#dialog-title').textContent=d[0];$('#dialog-copy').textContent=d[1];$('#dialog-config').dataset.configTarget=d[2];$('#module-dialog').showModal()}));
$('#dialog-config').addEventListener('click',()=>{chooseConfig($('#dialog-config').dataset.configTarget);$('#module-dialog').close()});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
['#view-design','#image-design'].forEach(s=>$(s).addEventListener('click',()=>$('#design-dialog').showModal()));
function motionLabel(){$('#motion-toggle').textContent=reduced?'Enable motion':'Reduce motion';$('#motion-toggle').setAttribute('aria-pressed',String(reduced))}
$('#motion-toggle').addEventListener('click',()=>{reduced=!reduced;motionLabel()});motionLabel();chooseConfig(selected);
function readScroll(){const el=$('#experience');targetProgress=clamp(-el.getBoundingClientRect().top/(el.offsetHeight-innerHeight));}
addEventListener('scroll',readScroll,{passive:true});readScroll();
function updateCopy(p){const n=p<.23?0:p<.51?1:p<.79?2:3;if(n!==chapter){chapter=n;$$('.story-copy').forEach((el,i)=>{el.classList.toggle('active',i===n);el.inert=i!==n});$('#chapter-number').textContent=String(n+1).padStart(2,'0')}
$('#progress-fill').style.width=`${Math.max(3,p*100)}%`;$('#model-state').textContent=['E-ALPHA / GRAPHITE','THE MODULAR ARCHITECTURE','RECONFIGURING / E-ALPHA',selected.toUpperCase()+' / E-ALPHA'][n];}
let renderer,scene,camera,phone,modules=[],upgrades={},mobile=false;
try{
if(!window.THREE)throw Error('3D engine not available');
renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;$('#scene').appendChild(renderer.domElement);
scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,0,17);
scene.add(new THREE.HemisphereLight(0xe5eddd,0x343b30,2));
function light(color,intensity,x,y,z){const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l)}light(0xf4f8e8,4,-4,6,8);light(0xabc9e7,3,5,2,-5);light(0xc8e798,2,4,-2,5);
phone=new THREE.Group();scene.add(phone);
const metal=new THREE.MeshStandardMaterial({color:0x656960,metalness:.87,roughness:.28});
const edge=new THREE.MeshStandardMaterial({color:0x93958a,metalness:.9,roughness:.23});
const dark=new THREE.MeshStandardMaterial({color:0x171c17,metalness:.55,roughness:.5});
const rubber=new THREE.MeshStandardMaterial({color:0x080b08,metalness:.05,roughness:.85});
const lensMat=new THREE.MeshPhysicalMaterial({color:0x101a26,metalness:.65,roughness:.1,clearcoat:1,clearcoatRoughness:.05});
const glass=new THREE.MeshPhysicalMaterial({color:0x1d3848,metalness:.65,roughness:.13,clearcoat:1});
const gold=new THREE.MeshStandardMaterial({color:0xb4a162,metalness:.8,roughness:.32});
const graphite=new THREE.MeshStandardMaterial({color:0x292e28,metalness:.6,roughness:.46});
const upgradedMat=new THREE.MeshStandardMaterial({color:0x464f3b,metalness:.65,roughness:.4});
function rounded(w,h,d,r=.12){const s=new THREE.Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:8});g.translate(0,0,-d/2);return g}
function box(parent,w,h,d,mat,x=0,y=0,z=0,r=.1){const m=new THREE.Mesh(rounded(w,h,d,r),mat);m.position.set(x,y,z);parent.add(m);return m}
function disc(parent,r,depth,mat,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,40),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m}
function label(parent,txt,w,x,y,z,color='#aeb5a5',size=48){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font=`500 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,256,48);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.position.set(x,y,z);parent.add(m);return m}
box(phone,2.64,5.5,.25,metal,0,0,0,.25);box(phone,2.52,5.38,.045,edge,0,0,.138,.22);box(phone,2.4,5.22,.06,rubber,0,0,.18,.18);
// Exposed structural rails and contact beds remain visible when modules lift away.
for(const y of [-2.4,-1.58,.9,2.4])box(phone,2.27,.045,.04,metal,0,y,.24,.01);
box(phone,.06,1.55,.04,metal,0,1.6,.23,.01);
for(const y of [1.25,-.65,-2.08]){box(phone,.55,.27,.03,dark,.57,y,.245,.025);for(let i=0;i<6;i++)for(let j=0;j<2;j++)disc(phone,.025,.022,gold,.37+i*.076,y-.065+j*.13,.276)}
for(const x of [-1.11,1.11])for(const y of [-2.45,2.45,-1.48,.97]){disc(phone,.035,.025,edge,x,y,.25);box(phone,.035,.007,.007,rubber,x,y,.268,.002)}
// Side buttons, antenna breaks, speaker perforations, and USB-C port.
box(phone,.055,.62,.12,edge,1.345,.8,0,.02);box(phone,.055,.32,.12,edge,1.345,-.1,0,.02);
for(const x of [-1.315,1.315])for(const y of [-1.9,1.95])box(phone,.035,.07,.255,rubber,x,y,0,.002);
const port=box(phone,.42,.018,.1,rubber,0,-2.77,0,.02);for(let i=0;i<5;i++)box(phone,.045,.025,.04,rubber,.65+i*.095,-2.77,0,.015);
// Front screen, visible during the rotation.
box(phone,2.48,5.32,.025,rubber,0,0,-.152,.22);
const screenCanvas=document.createElement('canvas');screenCanvas.width=512;screenCanvas.height=1100;const sx=screenCanvas.getContext('2d');const sg=sx.createLinearGradient(0,0,512,1100);sg.addColorStop(0,'#748071');sg.addColorStop(.5,'#232e28');sg.addColorStop(1,'#060d0c');sx.fillStyle=sg;sx.fillRect(0,0,512,1100);sx.lineWidth=1;for(let i=0;i<25;i++){sx.strokeStyle=`rgba(201,233,166,${.08+i*.002})`;sx.beginPath();sx.ellipse(130,620,130+i*23,370+i*8,.6,0,Math.PI*2);sx.stroke()}sx.fillStyle='#e2e9dd';sx.textAlign='center';sx.font='200 100px Arial';sx.fillText('09:41',256,265);sx.font='20px Arial';sx.fillText('MONDAY, OCTOBER 12',256,312);sx.font='17px Arial';sx.fillText('E L A T R A',256,950);const tex=new THREE.CanvasTexture(screenCanvas);tex.colorSpace=THREE.SRGBColorSpace;
const screen=box(phone,2.33,5.04,.012,new THREE.MeshBasicMaterial({map:tex}),0,.035,-.18,.17);screen.rotation.y=Math.PI;
const screenPos=screen.geometry.attributes.position,screenUV=screen.geometry.attributes.uv;for(let i=0;i<screenPos.count;i++)screenUV.setXY(i,screenPos.getX(i)/2.33+.5,screenPos.getY(i)/5.04+.5);screenUV.needsUpdate=true;
disc(phone,.067,.02,rubber,0,2.36,-.2);
function module(name,w,h,x,y){const group=new THREE.Group();group.position.set(x,y,.37);phone.add(group);const rim=box(group,w,h,.18,metal,0,0,0,.12);box(group,w-.07,h-.07,.03,graphite,0,0,.112,.09);const item={name,group,x,y,z:.37,w,h};modules.push(item);return item}
const cam=module('camera',1.22,1.83,-.615,1.625),compute=module('compute',1.14,1.83,.625,1.625),battery=module('battery',2.4,2.35,0,-.515),audio=module('audio',2.4,.82,0,-2.16);
function cameraPack(parent,advanced){const g=new THREE.Group();parent.add(g);if(advanced){for(const [x,y,r] of [[-.16,.39,.36],[-.19,-.43,.28]]){disc(g,r,.12,edge,x,y,.19);disc(g,r-.045,.04,rubber,x,y,.27);disc(g,r-.10,.03,lensMat,x,y,.30);disc(g,.065,.006,glass,x-.045,y+.04,.323)}box(g,.25,.46,.09,rubber,.35,-.33,.19,.07);box(g,.14,.24,.01,glass,.35,-.33,.245,.025)}else{for(const y of [.56,0,-.56]){disc(g,.235,.09,edge,-.22,y,.19);disc(g,.192,.035,rubber,-.22,y,.25);disc(g,.142,.025,lensMat,-.22,y,.275);disc(g,.046,.006,glass,-.26,y+.038,.291)}box(g,.14,.42,.035,rubber,.30,-.05,.16,.05)}disc(g,.065,.04,new THREE.MeshStandardMaterial({color:0xe7e7bf,emissive:0x77774e,emissiveIntensity:.25}),.32,.59,.19);return g}
upgrades.cameraStandard=cameraPack(cam.group,false);upgrades.cameraPro=cameraPack(cam.group,true);
label(compute.group,'E / CORE',.72,0,-.57,.145,'#697260',35);
upgrades.fan=new THREE.Group();compute.group.add(upgrades.fan);
for(let i=0;i<10;i++)box(upgrades.fan,.85,.035,.03,rubber,0,.65-i*.065,.17,.006);
disc(upgrades.fan,.37,.04,rubber,0,-.35,.17);const rotor=new THREE.Group();rotor.position.set(0,-.35,.20);upgrades.fan.add(rotor);for(let i=0;i<10;i++){const blade=box(rotor,.085,.25,.02,metal,0,0,0,.02);const a=i*Math.PI/5;blade.position.set(Math.sin(a)*.16,Math.cos(a)*.16,0);blade.rotation.z=-a+.4}disc(rotor,.09,.045,graphite,0,0,.04);
label(battery.group,'E L A T R A',1.1,0,.18,.143,'#68715f',42);label(battery.group,'E — ALPHA',.65,.65,-.87,.145,'#87937b',30);
// A subtle machined surface on the large rear module.
for(let i=0;i<35;i++)box(battery.group,2.12,.003,.001,new THREE.MeshStandardMaterial({color:0x42483c,roughness:.75}),0,-.95+i*.055,.133,.001);
upgrades.storage=new THREE.Group();battery.group.add(upgrades.storage);box(upgrades.storage,.60,.45,.065,metal,0,-.55,.17,.04);box(upgrades.storage,.39,.28,.012,dark,0,-.55,.21,.025);label(upgrades.storage,'UFS 4.0',.34,0,-.55,.224,'#b5c3a3',45);
label(audio.group,'E / SOUND',.7,0,0,.145,'#707967',34);
upgrades.speakers=new THREE.Group();audio.group.add(upgrades.speakers);
for(const x of [-.78,.78]){box(upgrades.speakers,.55,.53,.035,rubber,x,0,.15,.08);for(let i=0;i<7;i++)for(let j=0;j<7;j++)disc(upgrades.speakers,.011,.008,metal,x-.19+i*.063,-.19+j*.063,.177)}
function resize(){mobile=innerWidth<601;const w=$('#scene').clientWidth,h=$('#scene').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();readScroll()}
addEventListener('resize',resize);resize();
let dragging=false,lastX=0,drag=0,dragTarget=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(chapter!==3)return;dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(dragging){dragTarget+=(e.clientX-lastX)*.008;lastX=e.clientX}});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
const offsets=[[-.9,.4,1.35],[.9,.4,1.65],[0,-.02,2],[0,-.7,1.45]];
function animate(time){requestAnimationFrame(animate);const dt=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;progress+=(targetProgress-progress)*(1-Math.exp(-dt*9));updateCopy(progress);
if(document.hidden||$('#experience').getBoundingClientRect().bottom<0)return;
const p=progress;let explode=smooth(.22,.40,p)*(1-smooth(.66,.83,p));if(reduced)explode=chapter===1||chapter===2?1:0;
const swap=smooth(.5,.66,p);const config=p<.52?'everyday':selected;
upgrades.cameraStandard.visible=config==='everyday';upgrades.cameraPro.visible=config!=='everyday';upgrades.fan.visible=config==='performance';upgrades.speakers.visible=config==='performance';upgrades.storage.visible=config==='creator';
const yaw=reduced?-.36:(-.42+Math.PI*2*smooth(.04,.28,p)-.25*smooth(.30,.48,p)+.32*smooth(.72,.93,p));
drag+=(dragTarget-drag)*(1-Math.exp(-dt*8));phone.rotation.set(.10+explode*.27,yaw+(chapter===3?drag:0),-.10+explode*.13);
const viewH=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*17,viewW=viewH*camera.aspect;
phone.position.x=mobile?.08:viewW*.22;phone.position.y=mobile?-1.9:.12;
const scale=mobile?Math.min(.66,viewW/5.5):Math.min(1.15,viewH/7.2);phone.scale.setScalar(scale);
modules.forEach((m,i)=>{const v=offsets[i],burst=Math.sin(swap*Math.PI)*.32;const flight=explode+burst;m.group.position.set(m.x+v[0]*flight,m.y+v[1]*flight,m.z+v[2]*flight);m.group.rotation.set(flight*.025*(i%2?1:-1),flight*.07*(i%2?1:-1),flight*.055*(i%2?1:-1))});
if(!reduced&&upgrades.fan.visible)rotor.rotation.z=time*.004;renderer.render(scene,camera);
}requestAnimationFrame(animate);
}catch(error){console.warn('Elatra 3D fallback:',error);$('.fallback').hidden=false;function fallbackLoop(){updateCopy(targetProgress);requestAnimationFrame(fallbackLoop)}fallbackLoop()}
})();
