export const WEAPONS = [
 {id:'m4',name:'M4A1',type:'assault',value:1.18}, {id:'ak',name:'AK-47',type:'assault',value:1.35},
 {id:'deagle',name:'Desert Eagle',type:'pistol',value:1.12}, {id:'glock',name:'Glock',type:'pistol',value:.82},
 {id:'mp5',name:'MP5',type:'smg',value:.92}, {id:'p90',name:'P90',type:'smg',value:1.04},
 {id:'benelli',name:'Benelli M4',type:'shotgun',value:1.10}, {id:'nova',name:'Nova',type:'shotgun',value:.86},
 {id:'m249',name:'M249',type:'lmg',value:1.02}, {id:'negev',name:'Negev',type:'lmg',value:1.15}
];
export const RARITIES={common:{label:'Common',color:'#a9bed1',base:42},rare:{label:'Rare',color:'#598bff',base:145},epic:{label:'Epic',color:'#c783ff',base:520},legendary:{label:'Legendary',color:'#ffbd59',base:1800}};
export const DESIGNS=[
 {id:'field',name:'Fieldwork',rarity:'common',colors:[['Sage','#7b9580','#293b37'],['Sand','#c9ac73','#60513d']]},
 {id:'stripe',name:'Hazard Tape',rarity:'common',colors:[['Amber','#e6b640','#292d32'],['Ice','#92bfc6','#35434f']]},
 {id:'camo',name:'Digital Ghost',rarity:'rare',colors:[['Arctic','#d5e4ec','#496b8b'],['Jungle','#84aa61','#24483e']]},
 {id:'circuit',name:'Circuit Breaker',rarity:'rare',colors:[['Volt','#b9f756','#253348'],['Cyan','#52dfe9','#203358']]},
 {id:'marble',name:'Nebula',rarity:'epic',colors:[['Orchid','#ed7ee7','#49248d'],['Solar','#ffb369','#bd384f']]},
 {id:'prism',name:'Prismatic',rarity:'legendary',colors:[['Aurora','#6be3d3','#836cf5']]},
 {id:'facet',name:'Aurum',rarity:'legendary',colors:[['Obsidian','#f8c963','#252c34']]}
];
export const SKINS=WEAPONS.flatMap(w=>DESIGNS.flatMap(d=>d.colors.map((c,i)=>({id:`${w.id}-${d.id}-${i}`,weapon:w.id,design:d.id,rarity:d.rarity,name:d.name,variant:c[0],colors:c.slice(1),type:w.type}))));
export const CASES=[
 {id:'assault',name:'Assault',price:170,color:'#c2dd8d',subtitle:'M4A1 / AK-47'},
 {id:'pistol',name:'Pistol',price:100,color:'#9bbddd',subtitle:'Desert Eagle / Glock'},
 {id:'smg',name:'SMG',price:130,color:'#9bd5c8',subtitle:'MP5 / P90'},
 {id:'shotgun',name:'Shotgun',price:150,color:'#d5ad91',subtitle:'Benelli M4 / Nova'},
 {id:'lmg',name:'LMG',price:160,color:'#b9a4d1',subtitle:'M249 / Negev'},
 {id:'legendary',name:'Legendary',price:2500,color:'#ffc66d',subtitle:'Guaranteed legendary'}
];
export const KEY='case-vault-save-v1';
export function freshState(){return {version:1,credits:5000,cases:{assault:1,pistol:1,smg:0,shotgun:0,lmg:0,legendary:0},inventory:[],opened:0,sold:0,market:{},history:{},tick:Date.now(),nextId:1};}
export function validateState(s){
 if(!s||s.version!==1||!Number.isFinite(s.credits)||s.credits<0||s.credits>1e12||!Array.isArray(s.inventory)||s.inventory.length>10000)throw Error('Invalid save file.');
 if(!s.cases||CASES.some(c=>!Number.isInteger(s.cases[c.id])||s.cases[c.id]<0||s.cases[c.id]>100000))throw Error('Invalid case inventory.');
 if(s.inventory.some(i=>!i||!SKINS.some(x=>x.id===i.skin)||!Number.isInteger(i.id)||i.id<1)||new Set(s.inventory.map(i=>i.id)).size!==s.inventory.length)throw Error('Invalid skin inventory.');
 if(!Number.isInteger(s.nextId)||s.nextId<=Math.max(0,...s.inventory.map(i=>i.id)))throw Error('Invalid item sequence.');
 if(!Number.isInteger(s.opened)||s.opened<0||!Number.isFinite(s.sold)||s.sold<0||!Number.isFinite(s.tick))throw Error('Invalid statistics.');
 s.market=s.market&&typeof s.market==='object'?s.market:{};s.history=s.history&&typeof s.history==='object'?s.history:{};
 for(const skin of SKINS){if(!Number.isFinite(s.market[skin.id])||s.market[skin.id]<.4||s.market[skin.id]>2.5)s.market[skin.id]=1; const h=s.history[skin.id];s.history[skin.id]=Array.isArray(h)?h.filter(v=>Number.isFinite(v)&&v>0).slice(-20):[];}
 return s;
}
export function buyCase(s,id){const c=CASES.find(c=>c.id===id);if(!c||s.credits<c.price)return false;s.credits-=c.price;s.cases[id]++;return true;}
export function rollSkin(id,rng=Math.random){const r=rng();const rarity=id==='legendary'?'legendary':r<.60?'common':r<.87?'rare':r<.97?'epic':'legendary';const pool=SKINS.filter(x=>x.rarity===rarity&&(id==='legendary'||x.type===id));return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];}
export function openCase(s,id,rng=Math.random){if(!(s.cases[id]>0))return null;const skin=rollSkin(id,rng);if(!skin)return null;s.cases[id]--;s.opened++;const item={id:s.nextId++,skin:skin.id,obtained:Date.now()};s.inventory.push(item);return item;}
export function price(s,id){const skin=SKINS.find(x=>x.id===id);if(!skin)return 0;const w=WEAPONS.find(x=>x.id===skin.weapon);const premium=skin.design==='facet'?1.23:skin.design==='circuit'?1.12:1;return Math.round(RARITIES[skin.rarity].base*w.value*premium*(s.market[id]||1));}
export function tickMarket(s,rng=Math.random,now=Date.now()){
 const sectors=Object.fromEntries(CASES.map(c=>[c.id,(rng()-.5)*.09]));
 for(const skin of SKINS){const prev=s.market[skin.id]||1;const volatility=skin.rarity==='legendary'?.13:skin.rarity==='epic'?.10:.07;s.market[skin.id]=Math.max(.4,Math.min(2.5,prev+(1-prev)*.045+sectors[skin.type]+(rng()-.5)*volatility));s.history[skin.id]=[...(s.history[skin.id]||[]),price(s,skin.id)].slice(-20);}
 s.tick=now;
}
export function sellItem(s,id){const i=s.inventory.findIndex(x=>x.id===id);if(i<0)return 0;const value=price(s,s.inventory[i].skin);s.inventory.splice(i,1);s.credits+=value;s.sold+=value;return value;}
