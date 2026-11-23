let THREE;
try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'); }
catch (e) { try { THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js'); } catch (e2) { document.getElementById('startPanel').innerHTML = '<div class="panel"><div class="eyebrow">3D ENGINE CONNECTION REQUIRED</div><h1>LOAD THE <em>GAME ENGINE.</em></h1><p>Three.js could not be downloaded from either CDN. Connect to the internet, then reload the page. GitHub Pages requires an active internet connection for the 3D engine.</p></div>'; throw e2; } }

// ALAMIN APEX RIDE — procedural 3D mobile motorcycle game.
// All runtime geometry is generated here; the supplied player portrait is used in the UI.

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const isMobile = matchMedia('(max-width: 700px)').matches;
const clock = new THREE.Clock();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

let renderer, scene, camera, world, bikeRoot, riderRoot, bikeParts = {}, traffic = [], scenery = [];
let gameState = 'menu', route = 'coastal', targetLane = 0, speed = 0, score = 0, runCoins = 0, boostFuel = 100;
let bestScore = Number(localStorage.getItem('alamin_best') || 0);
let bankCoins = Number(localStorage.getItem('alamin_coins') || 0);
let rides = Number(localStorage.getItem('alamin_rides') || 0);
let topSpeed = 0, spawnTimer = 1.2, roadScroll = 0, crashTimer = 0, nitroOn = false, brakeOn = false;
let playerX = 0, bikeLean = 0, garageAngle = 0, garageDrag = false, lastPointerX = 0;
let audioCtx = null, soundEnabled = true, toastTimer = null;
const lanes = [-3.35, 0, 3.35];
const wheelSpin = [];
const routeStyles = {
  coastal: { sky: 0x82b5d4, fog: 0x9ebac8, ground: 0x536f5c, road: 0x272d35, light: 0xffd09a, label: 'COASTAL HIGHWAY' },
  alpine: { sky: 0x8ca9ca, fog: 0x9bafbd, ground: 0x536b5d, road: 0x292f38, light: 0xffd4a4, label: 'ALPINE RIDGE RUN' },
  midnight: { sky: 0x101a32, fog: 0x25334c, ground: 0x101c24, road: 0x171b24, light: 0xff7948, label: 'MIDNIGHT EXPRESS' }
};

function mat(color, roughness=.55, metalness=.05, extra={}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
const M = {
  tire: mat(0x090b0f,.96), rubber: mat(0x171a20,.92), rim: mat(0xb8c3cc,.3,.8), darkMetal: mat(0x242b34,.38,.78), steel: mat(0x929da8,.28,.82),
  black: mat(0x10151e,.48,.18), carbon: mat(0x1b222c,.4,.38), frame: mat(0x343e4a,.35,.72), red: mat(0xd92c3d,.32,.35), orange: mat(0xff693c,.3,.25), white: mat(0xe7edf2,.34,.12),
  glass: new THREE.MeshPhysicalMaterial({color:0x6d9bb3,roughness:.12,metalness:.22,transparent:true,opacity:.52,clearcoat:1}),
  skin: mat(0xb97f60,.78,0), skinLight: mat(0xd49a78,.72,0), hair: mat(0x17161b,.82,0), beard: mat(0x242027,.92,0),
  jacket: mat(0x121923,.7,.08), pants: mat(0x171c25,.8,.02), glove: mat(0x090e15,.8,.05), boot: mat(0x10151d,.6,.18),
  carGlass: new THREE.MeshPhysicalMaterial({color:0x172d42,roughness:.18,metalness:.3,transparent:true,opacity:.84,clearcoat:1}),
  lane: mat(0xe4e7e7,.8,0), asphalt: mat(0x282e37,.96,0), barrier: mat(0x9aa3ae,.48,.65)
};

function addMesh(parent, geometry, material, pos=[0,0,0], rot=[0,0,0], scale=null, name='') {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(...pos); o.rotation.set(...rot); if (scale) o.scale.set(...scale); o.castShadow = true; o.receiveShadow = true; if(name)o.name=name; parent.add(o); return o;
}
function sphere(parent, pos, scale, material, segments=24, name='') {
  return addMesh(parent, new THREE.SphereGeometry(1,segments,Math.max(12,Math.floor(segments*.7))), material, pos, [0,0,0], scale, name);
}
function rod(parent, a, b, radius, material, radius2=radius, radial=14) {
  const av=Array.isArray(a)?V(...a):a, bv=Array.isArray(b)?V(...b):b;
  const d=bv.clone().sub(av), len=d.length();
  const o=addMesh(parent,new THREE.CylinderGeometry(radius2,radius,len,radial,2),material,[0,0,0]);
  o.position.copy(av).add(bv).multiplyScalar(.5); o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize()); return o;
}
function torus(parent, radius, tube, material, pos, rot=[0,0,0], tubular=48) {
  return addMesh(parent,new THREE.TorusGeometry(radius,tube,12,tubular),material,pos,rot);
}
function roundedBox(parent, size, radius, material, pos, rot=[0,0,0]) {
  // Rounded-looking manufactured component with bevel-like edge treatment using a subdivided box.
  const g = new THREE.BoxGeometry(size[0],size[1],size[2],2,2,2);
  const mesh = addMesh(parent,g,material,pos,rot); return mesh;
}
function canvasLabel(text, color='#fff', bg='#111923', width=512, height=128) {
  const c=document.createElement('canvas'); c.width=width;c.height=height; const x=c.getContext('2d');
  x.clearRect(0,0,width,height); x.fillStyle=bg; x.globalAlpha=.92; x.beginPath(); x.roundRect(6,6,width-12,height-12,18); x.fill(); x.globalAlpha=1;
  x.fillStyle=color; x.font='900 56px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,width/2,height/2+2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, isMobile?1.7:2));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.22;
  scene = new THREE.Scene(); scene.background=new THREE.Color(0x17263d); scene.fog=new THREE.FogExp2(0x879eae,.008);
  camera = new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,500); camera.position.set(4.2,2.65,5.1);
  const hemi=new THREE.HemisphereLight(0xc9e4ff,0x33404d,2.05);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffdfbd,3.5);key.position.set(-7,11,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=20;key.shadow.camera.bottom=-20;key.shadow.bias=-.00018;scene.add(key);
  const fill=new THREE.DirectionalLight(0x6d9bdb,2.3);fill.position.set(6,5,-8);scene.add(fill);
  const rim=new THREE.PointLight(0xff653c,26,16,2);rim.position.set(-3,3,-4);scene.add(rim);
  window.addEventListener('resize',onResize);
}
function onResize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1.7:2));renderer.setSize(innerWidth,innerHeight,false)}

function makeWheel(parent, z, isFront=false) {
  const g=new THREE.Group();g.position.set(0,.48,z);parent.add(g);
  // Tire and sidewall, with rim well inside the tire.
  torus(g,.385,.078,M.tire,[0,0,0],[0,Math.PI/2,0],64);
  torus(g,.318,.018,M.rubber,[0,0,0],[0,Math.PI/2,0],64);
  addMesh(g,new THREE.CylinderGeometry(.285,.285,.115,40),M.darkMetal,[0,0,0],[0,0,Math.PI/2]);
  addMesh(g,new THREE.CylinderGeometry(.247,.247,.123,40),M.rim,[0,0,0],[0,0,Math.PI/2]);
  addMesh(g,new THREE.CylinderGeometry(.205,.205,.129,40),mat(0x303942,.34,.86),[0,0,0],[0,0,Math.PI/2]);
  for(const s of [-1,1]){
    addMesh(g,new THREE.CylinderGeometry(.235,.235,.012,48),M.steel,[s*.067,0,0],[0,0,Math.PI/2]);
    torus(g,.205,.012,M.darkMetal,[s*.076,0,0],[0,Math.PI/2,0]);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6, r=.245;
      rod(g,[s*.09,Math.cos(a)*.055,Math.sin(a)*.055],[s*.09,Math.cos(a)*r,Math.sin(a)*r],.009,M.steel,.006,6);
    }
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5; const p=[s*.084,Math.cos(a)*.205,Math.sin(a)*.205];
      addMesh(g,new THREE.CylinderGeometry(.008,.008,.09,6),M.darkMetal,[p[0],p[1],p[2]],[0,0,a]);
    }
  }
  addMesh(g,new THREE.CylinderGeometry(.072,.072,.17,24),M.darkMetal,[0,0,0],[0,0,Math.PI/2]);
  if(isFront){
    const cal=addMesh(g,new THREE.BoxGeometry(.11,.18,.17),M.red,[.12,.08,.18]);
  }
  wheelSpin.push(g); return g;
}

function makeBike() {
  const root=new THREE.Group();root.name='ALAMIN_R01_APEX';
  const frame=new THREE.Group();root.add(frame);bikeParts.frame=frame;
  const rearWheel=makeWheel(root,.98,false), frontAssembly=new THREE.Group();frontAssembly.position.set(0,0,-.92);root.add(frontAssembly);const frontWheel=makeWheel(frontAssembly,-.13,true);frontWheel.position.z=-.13;bikeParts.frontWheel=frontWheel;bikeParts.rearWheel=rearWheel;
  // Main structural frame and swing arm.
  rod(frame,[-.12,.69,.85],[0,.96,-.18],.065,M.frame,.052);
  rod(frame,[.12,.69,.85],[0,.96,-.18],.065,M.frame,.052);
  rod(frame,[-.12,.7,.85],[0,.58,-.18],.055,M.frame,.045);
  rod(frame,[.12,.7,.85],[0,.58,-.18],.055,M.frame,.045);
  rod(frame,[-.45,.48,.98],[0,.56,.14],.07,M.darkMetal,.055);
  rod(frame,[.45,.48,.98],[0,.56,.14],.07,M.darkMetal,.055);
  // Engine block — multi-part, finned alloy engine rather than a single cube.
  sphere(frame,[0,.73,.28],[.34,.32,.37],mat(0x3b4651,.42,.72),32,'engine-core');
  for(let i=0;i<7;i++){
    const z=.02+i*.075; rod(frame,[-.31,.58,z],[-.31,.88,z],.022,M.steel,.022,10);rod(frame,[.31,.58,z],[.31,.88,z],.022,M.steel,.022,10);
  }
  sphere(frame,[0,.56,.42],[.25,.19,.27],M.darkMetal,24);
  torus(frame,.09,.018,M.steel,[.32,.71,.2],[0,Math.PI/2,0]);
  // Exhaust canister on right side.
  rod(frame,[.28,.54,.4],[.46,.62,1.05],.075,M.darkMetal,.065,24);
  rod(frame,[.46,.62,1.02],[.49,.64,1.22],.082,M.steel,.07,24);
  torus(frame,.07,.012,M.black,[.49,.64,1.23],[0,Math.PI/2,0]);
  // Rear shock.
  rod(frame,[.18,.51,.87],[.13,.91,.34],.045,M.red,.04);
  // Rear tail and sculpted seat.
  sphere(frame,[0,1.0,.68],[.34,.15,.53],M.black,32,'seat');
  sphere(frame,[0,1.09,.88],[.28,.12,.33],M.carbon,28,'tail-cowl');
  sphere(frame,[0,1.07,1.15],[.27,.07,.13],M.red,24,'tail-light');
  // Fuel tank and shoulder sculpt.
  sphere(frame,[0,1.10,.02],[.42,.29,.55],mat(0x171e28,.34,.32),40,'fuel-tank');
  sphere(frame,[0,1.24,-.06],[.32,.12,.34],M.carbon,32);
  // Side tank accent and branded side fairings.
  for(const s of [-1,1]){
    sphere(frame,[s*.31,.89,-.33],[.22,.35,.58],M.black,32,'upper-fairing');
    sphere(frame,[s*.39,.72,-.42],[.11,.23,.48],M.red,28,'red-fairing');
    sphere(frame,[s*.405,.65,-.58],[.065,.13,.28],M.white,24,'fairing-wing');
    sphere(frame,[s*.35,.93,-.79],[.12,.16,.26],M.carbon,24);
    // Aerodynamic side vents and winglet.
    for(let j=0;j<3;j++){
      rod(frame,[s*.455,.76-j*.055,-.53],[s*.455,.79-j*.055,-.30],.012,M.steel,.009,6);
    }
    // Tank knee grip.
    sphere(frame,[s*.385,.95,.18],[.05,.17,.22],M.rubber,18);
  }
  // Front nose / windscreen / headlight.
  sphere(frame,[0,1.05,-.84],[.39,.37,.38],M.black,36,'front-nose');
  sphere(frame,[0,1.36,-.88],[.245,.22,.18],M.glass,28,'windscreen');
  const lightMat=new THREE.MeshStandardMaterial({color:0xe9f7ff,emissive:0xaedbff,emissiveIntensity:1.6,roughness:.18});
  sphere(frame,[0,1.0,-1.12],[.24,.115,.055],lightMat,24,'headlight');
  for(const s of [-1,1]) sphere(frame,[s*.31,.96,-1.04],[.055,.045,.035],M.orange,16);
  // Clip-on handlebars and mirrors.
  const steer=new THREE.Group();steer.position.set(0,1.22,-.70);frame.add(steer);bikeParts.steer=steer;
  rod(steer,[-.56,0,-.02],[.56,0,-.02],.026,M.darkMetal,.026,12);
  for(const s of [-1,1]){
    rod(steer,[s*.30,0,-.02],[s*.50,-.02,-.08],.033,M.steel,.026);
    rod(steer,[s*.49,-.02,-.08],[s*.56,-.02,-.10],.04,M.glove,.03);
    rod(steer,[s*.4,.06,.01],[s*.55,.29,.14],.02,M.darkMetal,.016);
    sphere(steer,[s*.57,.30,.14],[.12,.075,.08],M.black,16);
  }
  // Front fork tubes, axle details and fender.
  for(const s of [-1,1]){
    rod(frame,[s*.23,1.18,-.68],[s*.25,.48,-1.05],.047,M.steel,.043,18);
    rod(frame,[s*.26,1.12,-.66],[s*.26,.56,-1.04],.072,M.darkMetal,.06,18);
    sphere(frame,[s*.26,.49,-1.05],[.065,.065,.065],M.red,16);
  }
  sphere(frame,[0,.72,-1.00],[.28,.10,.44],M.red,24,'front-fender');
  // Branded tank badge and fairing mark as canvas textures.
  const labelMat=new THREE.MeshBasicMaterial({map:canvasLabel('A  ALAMIN','#f5f7fb','#171d28'),transparent:true,side:THREE.DoubleSide});
  addMesh(frame,new THREE.PlaneGeometry(.37,.10),labelMat,[.414,1.06,-.02],[0,Math.PI/2,0]);
  const sideLogo=new THREE.MeshBasicMaterial({map:canvasLabel('A','#ffffff','#d62f3d',256,256),transparent:true,side:THREE.DoubleSide});
  addMesh(frame,new THREE.PlaneGeometry(.19,.19),sideLogo,[.475,.78,-.45],[0,Math.PI/2,0]);
  // rear plate and foot pegs.
  for(const s of [-1,1]){
    rod(frame,[s*.28,.62,.38],[s*.53,.43,.42],.024,M.steel,.022,10);
    rod(frame,[s*.46,.44,.42],[s*.60,.44,.42],.045,M.darkMetal,.045,12);
  }
  // Rider attached at actual saddle location.
  riderRoot=createRider();root.add(riderRoot);
  root.userData.fairingMaterials=[M.red,M.black,M.white];root.userData.currentPaint=0x111821;
  return root;
}

function makeBoneSegment(parent,name,length,dir,radius,material,endRadius=radius*.78) {
  const bone=new THREE.Bone();bone.name=name;parent.add(bone);
  const d=V(...dir).normalize();bone.quaternion.setFromUnitVectors(V(0,1,0),d);
  const geo=new THREE.CylinderGeometry(endRadius,radius,length,18,2,false);
  const limb=addMesh(bone,geo,material,[0,length*.5,0]);
  const cap1=sphere(bone,[0,.035,0],[radius,radius*1.03,radius],material,16);
  const cap2=sphere(bone,[0,length-.035,0],[endRadius,endRadius*1.02,endRadius],material,16);
  return {bone,length,limb,cap1,cap2};
}
function makeFoot(parent,pos,side,material) {
  const g=new THREE.Group();g.position.set(...pos);parent.add(g);
  sphere(g,[0,0,.09],[.09,.085,.22],material,20);
  sphere(g,[0,-.025,.20],[.095,.07,.09],M.black,16);
  rod(g,[-.06,.045,.02],[.06,.045,.02],.012,M.steel,.012,8);
  return g;
}
function createRider() {
  const root=new THREE.Group();root.name='ALAMIN_BONE_RIG';
  const hips=new THREE.Bone();hips.name='Hips';hips.position.set(0,1.0,.43);root.add(hips);
  // Pelvis and tapered jacket torso, leaned into a riding stance.
  sphere(hips,[0,0,0],[.25,.17,.23],M.pants,28,'pelvis');
  const spine=new THREE.Bone();spine.name='Spine';spine.position.set(0,.04,-.01);spine.rotation.x=-.27;hips.add(spine);
  const torsoProfile=[new THREE.Vector2(.16,0),new THREE.Vector2(.205,.08),new THREE.Vector2(.27,.22),new THREE.Vector2(.255,.39),new THREE.Vector2(.19,.56),new THREE.Vector2(.16,.60)];
  const torso=addMesh(spine,new THREE.LatheGeometry(torsoProfile,32),M.jacket,[0,.02,0]);torso.scale.set(1,1,1);
  // White chest panel and red shoulder trim.
  const chest=addMesh(spine,new THREE.PlaneGeometry(.26,.39),M.white,[0,.31,-.238],[0,Math.PI,0]);
  for(const s of [-1,1]){
    sphere(spine,[s*.225,.47,0],[.12,.10,.17],M.red,20);
    rod(spine,[s*.17,.51,-.14],[s*.27,.45,-.08],.025,M.white,.025,10);
    sphere(spine,[s*.275,.41,-.025],[.07,.09,.10],M.jacket,18);
  }
  // Neck and head hierarchy.
  const neck=new THREE.Bone();neck.name='Neck';neck.position.set(0,.57,0);spine.add(neck);
  rod(neck,[0,0,0],[0,.13,0],.095,M.skin,.085,18);
  const headBone=new THREE.Bone();headBone.name='Head';headBone.position.set(0,.12,-.012);neck.add(headBone);
  sphere(headBone,[0,.10,0],[.185,.235,.17],M.skin,32,'head-shape');
  sphere(headBone,[-.185,.10,-.005],[.038,.075,.045],M.skin,20);sphere(headBone,[.185,.10,-.005],[.038,.075,.045],M.skin,20);
  // Face details face towards -Z (forward direction).
  for(const s of [-1,1]){
    sphere(headBone,[s*.071,.135,-.151],[.039,.028,.018],M.white,18);
    sphere(headBone,[s*.071,.135,-.168],[.018,.019,.012],mat(0x29201d,.45),16);
    sphere(headBone,[s*.071,.135,-.179],[.008,.009,.006],mat(0x0b0e13,.35),12);
    rod(headBone,[s*.112,.19,-.151],[s*.035,.205,-.166],.016,M.hair,.013,10);
  }
  sphere(headBone,[0,.075,-.178],[.028,.05,.035],M.skinLight,16);
  sphere(headBone,[0,-.002,-.155],[.095,.03,.035],M.beard,20);
  sphere(headBone,[0,-.06,-.13],[.14,.075,.065],M.beard,20);
  sphere(headBone,[0,.04,-.183],[.08,.022,.021],M.beard,18);
  // Hair: swept-up dark textured silhouette, based on ALAMIN's photo.
  sphere(headBone,[0,.245,.015],[.19,.105,.18],M.hair,28);
  const quiff=sphere(headBone,[-.035,.29,-.03],[.18,.105,.16],M.hair,28);quiff.rotation.z=-.16;
  for(let i=0;i<5;i++){
    const t=i/4; const tuft=sphere(headBone,[-.12+t*.22,.31+Math.sin(t*Math.PI)*.045,-.05],[.07,.048,.11],M.hair,16);tuft.rotation.z=-.24;
  }
  // Arms, elbows and hands — bone-driven articulated hierarchy, posed to reach the clip-ons.
  const arms=[];
  for(const s of [-1,1]){
    const shoulder=new THREE.Bone();shoulder.name=s<0?'Shoulder_L':'Shoulder_R';shoulder.position.set(s*.255,.48,-.005);spine.add(shoulder);
    const upper=makeBoneSegment(shoulder,s<0?'UpperArm_L':'UpperArm_R',.42,[s*.10,-.23,-.97],.102,M.jacket,.084);
    const elbow=s<0?'Elbow_L':'Elbow_R';
    const fore=makeBoneSegment(upper.bone,s<0?'Forearm_L':'Forearm_R',.50,[s*.06,-.12,-.99],.078,M.jacket,.063);
    fore.bone.position.set(0,upper.length,0);
    const glove=sphere(fore.bone,[0,.49,0],[.09,.075,.095],M.glove,18);
    const knuckle=sphere(fore.bone,[0,.51,-.035],[.064,.04,.06],M.darkMetal,16);
    arms.push({shoulder,upper,fore,glove});
  }
  // Legs bent around the tank and feet on pegs.
  const legs=[];
  for(const s of [-1,1]){
    const hipLeg=new THREE.Bone();hipLeg.name=s<0?'ThighRoot_L':'ThighRoot_R';hipLeg.position.set(s*.16,-.02,.04);hips.add(hipLeg);
    const thigh=makeBoneSegment(hipLeg,s<0?'UpperLeg_L':'UpperLeg_R',.47,[s*.48,-.72,-.50],.125,M.pants,.105);
    const shin=makeBoneSegment(thigh.bone,s<0?'LowerLeg_L':'LowerLeg_R',.55,[s*.10,-.84,.53],.088,M.pants,.07);
    shin.bone.position.set(0,thigh.length,0);
    makeFoot(shin.bone,[0,.55,0],s,M.boot);
    legs.push({hipLeg,thigh,shin});
  }
  // Spine badge and back print.
  const chestLabel=new THREE.MeshBasicMaterial({map:canvasLabel('A','#111923','#ffffff',256,256),transparent:true,side:THREE.DoubleSide});
  addMesh(spine,new THREE.PlaneGeometry(.12,.13),chestLabel,[0,.33,-.251],[0,Math.PI,0]);
  const backLabel=new THREE.MeshBasicMaterial({map:canvasLabel('A  ALAMIN','#f0f2f6','#131b25'),transparent:true,side:THREE.DoubleSide});
  addMesh(spine,new THREE.PlaneGeometry(.30,.10),backLabel,[0,.28,.245]);
  // subtle jacket zip and cuffs
  rod(spine,[0,.08,-.21],[0,.48,-.205],.009,M.steel,.009,6);
  root.userData={hips,spine,neck,headBone,arms,legs};
  return root;
}

function makeCar(color=0xdbe3ea, type='sedan') {
  const g=new THREE.Group();g.userData.type=type;
  const bodyMat=mat(color,.32,.28), trim=mat(0x111820,.48,.25), glass=M.carGlass;
  const length=type==='suv'?4.3:type==='van'?4.6:3.9, width=type==='van'?1.82:1.78;
  // Lower sculpted body with rounded shoulders and front/rear tapers.
  sphere(g,[0,.62,0],[width*.52,.36,length*.48],bodyMat,32,'car-body');
  sphere(g,[0,.78,-.12],[width*.48,.20,length*.34],bodyMat,28);
  // Roof/cabin volume.
  const cabinLen=type==='suv'?2.18:type==='van'?2.45:1.95;
  sphere(g,[0,.99,.04],[width*.39,.34,cabinLen*.50],bodyMat,28,'cabin');
  // Dark side windows and windscreen panes.
  for(const s of [-1,1]){
    sphere(g,[s*width*.37,1.04,-.08],[.025,.22,cabinLen*.42],glass,20);
    sphere(g,[s*width*.39,.69,-.05],[.018,.105,length*.27],M.darkMetal,16);
    for(const z of [-length*.28,length*.28]){
      const wheel=makeCarWheel(g,s*.79,z);
    }
    addMesh(g,new THREE.BoxGeometry(.12,.055,.22),M.black,[s*width*.48,1.12,-.03],[0,0,s*.22]);
    sphere(g,[s*.88,.75,-length*.44],[.09,.07,.04],M.white,14);
    sphere(g,[s*.88,.75,length*.44],[.09,.07,.04],M.red,14);
  }
  // Front and rear windshield glass on sloped surfaces.
  sphere(g,[0,1.08,-length*.28],[width*.36,.20,.055],glass,20).rotation.x=-.33;
  sphere(g,[0,1.08,length*.29],[width*.36,.20,.055],glass,20).rotation.x=.33;
  // Bumpers, grille, lights and roof detail.
  roundedBox(g,[width*.94,.14,.16],.06,trim,[0,.48,-length*.48]);
  roundedBox(g,[width*.94,.13,.14],.05,trim,[0,.47,length*.48]);
  roundedBox(g,[.55,.12,.025],.02,trim,[0,.61,-length*.491]);
  for(const s of [-1,1]){
    sphere(g,[s*.61,.72,-length*.49],[.18,.085,.045],mat(0xeaf5ff,.2,.08,{emissive:0x9ebfff,emissiveIntensity:.45}),16);
    sphere(g,[s*.61,.72,length*.49],[.17,.07,.04],M.red,16);
  }
  // Roof rails and mirrors for SUV/van variation.
  if(type!=='sedan'){
    rod(g,[-.59,1.32,-.78],[.59,1.32,-.78],.018,M.darkMetal,.018,8);
    rod(g,[-.59,1.32,.78],[.59,1.32,.78],.018,M.darkMetal,.018,8);
  }
  return g;
}
function makeCarWheel(parent,x,z){
  const wh=new THREE.Group();wh.position.set(x,.39,z);parent.add(wh);
  torus(wh,.25,.062,M.tire,[0,0,0],[0,Math.PI/2,0],32);
  addMesh(wh,new THREE.CylinderGeometry(.19,.19,.12,24),M.rim,[0,0,0],[0,0,Math.PI/2]);
  torus(wh,.12,.015,M.steel,[0,0,0],[0,Math.PI/2,0],24);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(wh,[0,Math.cos(a)*.04,Math.sin(a)*.04],[0,Math.cos(a)*.16,Math.sin(a)*.16],.008,M.darkMetal,.008,6)}
  return wh;
}

function makeEnvironment(){
  world=new THREE.Group();scene.add(world);
  const ground=addMesh(world,new THREE.PlaneGeometry(500,500),mat(0x52635b,1,0),[0,-.13,-100],[-Math.PI/2,0,0]);ground.receiveShadow=true;
  // Track surface.
  const road=addMesh(world,new THREE.PlaneGeometry(13.2,310),M.asphalt,[0,-.015,-118],[-Math.PI/2,0,0]);road.receiveShadow=true;
  const shoulderMat=mat(0x555c64,.9,.1);
  for(const s of [-1,1]){
    addMesh(world,new THREE.PlaneGeometry(1.1,310),shoulderMat,[s*7.15,-.005,-118],[-Math.PI/2,0,0]);
    // Guard rail posts, horizontal rails.
    for(let z=16;z>-265;z-=12){
      rod(world,[s*7.42,.08,z],[s*7.42,1.02,z],.055,M.barrier,.045,8);
      sphere(world,[s*7.42,1.05,z],[.075,.075,.075],M.orange,10);
    }
    rod(world,[s*7.42,.82,18],[s*7.42,.82,-270],.065,M.steel,.065,10);
    rod(world,[s*7.42,.45,18],[s*7.42,.45,-270],.045,M.barrier,.045,8);
  }
  // Animated lane dashes are stored and recycled by the game loop.
  const dashes=[];
  for(const x of [-2.2,2.2])for(let z=18;z>-255;z-=10){
    const dash=addMesh(world,new THREE.BoxGeometry(.075,.025,4.3),M.lane,[x,.005,z]);dashes.push(dash);
  }
  world.userData.dashes=dashes;
  // Distant terrain and stylized skyline, with a coherent scale.
  const mountainMat=mat(route==='midnight'?0x1a2b3c:0x607c8b,1,0);
  for(let i=0;i<20;i++){
    const s=i%2?1:-1, z=-35-(i*17), x=s*(15+(i%4)*4), h=8+(i%5)*3, r=7+(i%3)*2;
    const m=addMesh(world,new THREE.ConeGeometry(r,h,7),mountainMat,[x,h*.48,z],[0,(i%3)*.7,0]);m.castShadow=false;
  }
  // Roadside trees and light poles.
  for(let i=0;i<52;i++){
    const s=i%2?1:-1,z=14-i*5.2,x=s*(10+(i%4)*1.3), scale=.72+(i%5)*.14;
    const tree=new THREE.Group();tree.position.set(x,0,z);world.add(tree);
    rod(tree,[0,0,0],[0,1.7*scale,0],.13*scale,mat(0x584533,.95),.1*scale,8);
    sphere(tree,[0,2.05*scale,0],[.8*scale,1.05*scale,.72*scale],mat(i%3?0x244638:0x315543,1),16);
    sphere(tree,[.25*scale,2.4*scale,.12],[.53*scale,.65*scale,.5*scale],mat(0x345d47,1),14);
    scenery.push(tree);
  }
  // Street lamps with warm emissive head, placed on both sides.
  for(let i=0;i<22;i++){
    const s=i%2?1:-1,z=12-i*12.5,x=s*7.8;
    const pole=new THREE.Group();pole.position.set(x,0,z);world.add(pole);
    rod(pole,[0,0,0],[0,4.5,0],.045,M.darkMetal,.035,8);
    rod(pole,[0,4.5,0],[-s*.85,4.5,-.2],.035,M.darkMetal,.025,8);
    sphere(pole,[-s*.86,4.42,-.2],[.16,.07,.22],mat(0xffd5a2,.2,.1,{emissive:0xffa34d,emissiveIntensity:1.2}),12);
    const lamp=new THREE.PointLight(0xffa15b,3,9,2);lamp.position.set(-s*.86,4.3,-.2);pole.add(lamp);
  }
  // Distant skyline blocks for coastal / midnight routes.
  for(let i=0;i<24;i++){
    const s=i%2?1:-1,z=-45-Math.floor(i/2)*18,x=s*(23+(i%3)*3),w=3+(i%4)*1.2,h=5+(i%6)*2;
    const b=addMesh(world,new THREE.BoxGeometry(w,h,4),mat(route==='midnight'?0x26344a:0x627483,.92,.08),[x,h/2,z]);b.castShadow=false;
    for(let y=1;y<h-1;y+=1.6){for(let xx=-w/2+.5;xx<w/2;xx+=1){const win=addMesh(b,new THREE.PlaneGeometry(.24,.35),mat(0xffcb82,.3,.05,{emissive:0xffb65b,emissiveIntensity:.5}),[xx,y-h/2-.05,2.01]);}}
  }
}

function makeTrafficVehicle(){
  const colors=[0xe1e7ed,0xb62f42,0x356fa2,0xd28a3c,0x374654,0xebe0ca];
  const typeRoll=Math.random();const type=typeRoll>.84?'suv':typeRoll>.68?'van':'sedan';
  const color=colors[Math.floor(Math.random()*colors.length)];
  const car=makeCar(color,type);
  const lane=lanes[Math.floor(Math.random()*lanes.length)];
  car.position.set(lane,0,-115-Math.random()*28);
  car.userData={lane,speedFactor:.84+Math.random()*.33,type};
  world.add(car);traffic.push(car);
}

function updateRouteLook(){
  const style=routeStyles[route]; scene.background.setHex(style.sky);scene.fog.color.setHex(style.fog);
  M.asphalt.color.setHex(style.road); $('rideHint').textContent=style.label+' · STAY ALIVE';
  // A route hue on horizon lights and the scenery floor.
  world?.children?.forEach(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.position.y<-.1)o.material.color.setHex(style.ground)});
}

function showToast(text){const el=$('toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),1900)}
function showOnly(panelId){for(const id of ['startPanel','garagePanel','profilePanel','pausePanel','gameOverPanel'])$(id).classList.add('hidden');if(panelId)$(panelId).classList.remove('hidden')}
function updateStats(){ $('coins').textContent=bankCoins.toLocaleString(); $('bestScore').textContent=bestScore.toLocaleString(); $('totalCoins').textContent=bankCoins.toLocaleString(); $('rides').textContent=rides.toLocaleString(); }
function setState(s){gameState=s;document.getElementById('hud').classList.toggle('hidden',s!=='ride');$('pausedTag').classList.toggle('hidden',s!=='pause');}
function startRide(){
  if(world?.userData?.platform)world.userData.platform.visible=false;
  showOnly(null);setState('ride');speed=48;score=0;runCoins=0;boostFuel=100;topSpeed=48;targetLane=0;playerX=0;bikeRoot.position.set(0,0,0);bikeRoot.rotation.set(0,0,0);traffic.forEach(v=>world.remove(v));traffic=[];spawnTimer=.8;crashTimer=0;nitroOn=false;brakeOn=false;rides++;localStorage.setItem('alamin_rides',rides);updateStats();$('speed').textContent='48';$('score').textContent='0';
  $('rideName').textContent='ALAMIN R-01 APEX';
}
function finishRide(){
  if(gameState!=='ride')return;setState('gameover');
  const earned=Math.max(1,Math.floor(score/90));runCoins=earned;bankCoins+=earned;bestScore=Math.max(bestScore,Math.floor(score));
  localStorage.setItem('alamin_best',bestScore);localStorage.setItem('alamin_coins',bankCoins);updateStats();
  $('runScore').textContent=Math.floor(score).toLocaleString();$('runCoins').textContent=earned;$('runSpeed').textContent=Math.round(topSpeed);$('runResult').textContent=`You rode through traffic and banked ${earned} coins. Best score: ${bestScore.toLocaleString()}.`;
  showOnly('gameOverPanel');
}
function pauseRide(){if(gameState==='ride'){setState('pause');showOnly('pausePanel')}}
function resumeRide(){if(gameState==='pause'){setState('ride');showOnly(null)}}
function toMenu(){setState('menu');speed=0;targetLane=0;bikeRoot.position.x=0;if(world?.userData?.platform)world.userData.platform.visible=true;showOnly('startPanel')}
function moveLane(d){if(gameState!=='ride')return;targetLane=clamp(targetLane+d,-1,1);playTone(320,.04,'sine',.015)}
function tone(freq,duration=.08,type='sine',gain=.03){if(!soundEnabled)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch{}}
function playTone(freq,dur,type,gain){tone(freq,dur,type,gain)}

function animate(dt,time){
  // Ambient turntable movement in menu / garage / profile.
  if(gameState!=='ride'&&gameState!=='pause'&&gameState!=='gameover'){
    garageAngle+=dt*.16;bikeRoot.rotation.y= Math.sin(garageAngle)*.10;
    bikeRoot.position.y=Math.sin(time*1.1)*.018;
    camera.position.lerp(V(4.8,2.8,5.4),1-Math.pow(.001,dt));camera.lookAt(0,1.0,-.1);
    return;
  }
  if(gameState==='pause'||gameState==='gameover'){
    camera.position.lerp(V(bikeRoot.position.x*.4,2.75,6.8),1-Math.pow(.001,dt));camera.lookAt(bikeRoot.position.x*.65,1.0,-1.3);return;
  }
  const targetX=lanes[targetLane+1];playerX=lerp(playerX,targetX,1-Math.pow(.0004,dt));
  bikeRoot.position.x=playerX;const steerDiff=(targetX-playerX);bikeLean=lerp(bikeLean,clamp(-((targetLane+1)-(playerX/3.35+1))*.6,-.34,.34),1-Math.pow(.002,dt));
  bikeRoot.rotation.z=lerp(bikeRoot.rotation.z,-(targetLane-(playerX/3.35))*.13,1-Math.pow(.003,dt));
  bikeParts.steer.rotation.y=lerp(bikeParts.steer.rotation.y,-bikeRoot.rotation.z*.85,1-Math.pow(.004,dt));
  bikeRoot.position.y=.018+Math.sin(time*17)*.012+(nitroOn?.025:0);
  // Speed management.
  if(nitroOn&&boostFuel>0){speed=lerp(speed,248,dt*1.2);boostFuel=Math.max(0,boostFuel-22*dt)}else if(brakeOn){speed=Math.max(28,speed-115*dt)}else{speed=lerp(speed,92,dt*.15);boostFuel=Math.min(100,boostFuel+6*dt)}
  topSpeed=Math.max(topSpeed,speed);score+=speed*dt*.18;
  $('speed').textContent=Math.round(speed);$('score').textContent=Math.floor(score).toLocaleString();
  // Rolling road markings.
  roadScroll+=dt*(speed/3.6)*.88;
  for(const dash of world.userData.dashes){dash.position.z+=dt*(speed/3.6)*.92;if(dash.position.z>22)dash.position.z=-258}
  // Traffic moves toward the chase camera.
  spawnTimer-=dt;if(spawnTimer<=0){makeTrafficVehicle();spawnTimer=Math.max(.82,1.62-speed/350)+Math.random()*.42}
  for(let i=traffic.length-1;i>=0;i--){const c=traffic[i];c.position.z+=dt*(speed/3.6)*(.92-c.userData.speedFactor*.12);if(c.position.z>13){world.remove(c);traffic.splice(i,1);continue;}
    if(Math.abs(c.position.z)<1.85&&Math.abs(c.position.x-bikeRoot.position.x)<1.22){finishRide();tone(95,.32,'sawtooth',.08);return;}
  }
  // Wheel rotation / suspension / rider movement.
  for(const w of wheelSpin)w.rotation.x-=dt*(speed/3.6)/.385;
  const rig=riderRoot.userData;rig.hips.position.y=1.0+Math.sin(time*2.1)*.008;rig.spine.rotation.x=-.27+(nitroOn?-.055:0)+Math.sin(time*2.1)*.012;rig.headBone.rotation.y=Math.sin(time*1.3)*.018;rig.neck.rotation.z=-bikeRoot.rotation.z*.28;
  for(const arm of rig.arms){arm.shoulder.rotation.z=clamp(-bikeRoot.rotation.z*.15,-.08,.08)}
  // Smooth cinematic chase camera with modest lean and speed FOV.
  const camTarget=V(bikeRoot.position.x*.55,2.78,7.5+(speed>190?-0.5:0));camera.position.lerp(camTarget,1-Math.pow(.001,dt));
  camera.fov=lerp(camera.fov,58+(nitroOn?5:Math.max(0,(speed-100)*.025)),dt*2);camera.updateProjectionMatrix();
  camera.lookAt(bikeRoot.position.x*.72,1.12,-4.4);
  if(nitroOn&&Math.random()<.12)spawnBoostParticle();
}
function spawnBoostParticle(){
  const p=sphere(scene,[playerX+(Math.random()-.5)*.28,.65,1.2],[.035,.035,.10],mat(0xff8942,.25,.05,{emissive:0xff5125,emissiveIntensity:2}),8);
  const start=performance.now();const tick=()=>{const k=(performance.now()-start)/320;if(k>1){scene.remove(p);p.geometry.dispose();p.material.dispose();return;}p.position.z+=.18;p.scale.multiplyScalar(.97);requestAnimationFrame(tick)};requestAnimationFrame(tick);
}

function buildScene(){
  setupRenderer();makeEnvironment();bikeRoot=makeBike();scene.add(bikeRoot);
  // Display platform in menu and garage.
  const platform=new THREE.Group();scene.add(platform);world.userData.platform=platform;
  addMesh(platform,new THREE.CylinderGeometry(3.6,3.8,.22,72),mat(0x141d2b,.42,.5),[0,-.11,0]);
  torus(platform,3.34,.035,M.red,[0,-.095,0]);torus(platform,3.55,.018,M.steel,[0,-.09,0]);
  const backPanel=addMesh(platform,new THREE.BoxGeometry(9,3,.22),mat(0x0b1420,.7,.2),[0,1.45,-2.95]);
  for(let x=-4;x<=4;x+=2){rod(platform,[x,0,-3],[x,2.5,-3],.035,M.darkMetal,.035,8)}
  // Emissive stage strips.
  torus(platform,2.2,.018,mat(0xff7040,.25,.1,{emissive:0xf04c2d,emissiveIntensity:1.5}),[0,.02,0]);
  bikeRoot.position.y=0;
  updateRouteLook();
}

// Input and UI wiring.
$('startRide').addEventListener('click',startRide);$('garageRide').addEventListener('click',startRide);$('retryRide').addEventListener('click',startRide);
$('openGarage').addEventListener('click',()=>{if(world?.userData?.platform)world.userData.platform.visible=true;showOnly('garagePanel');setState('garage')});$('openProfile').addEventListener('click',()=>{if(world?.userData?.platform)world.userData.platform.visible=true;showOnly('profilePanel');setState('profile');updateStats()});
$('resumeRide').addEventListener('click',resumeRide);$('quitRide').addEventListener('click',toMenu);$('gameToMenu').addEventListener('click',toMenu);$('pauseBtn').addEventListener('click',pauseRide);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{if(world?.userData?.platform)world.userData.platform.visible=true;showOnly('startPanel');setState('menu')}));
document.querySelectorAll('.route').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.route').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');route=b.dataset.route;updateRouteLook();showToast(routeStyles[route].label)}));
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');repaintBike(b.dataset.paint)}));
function repaintBike(hex){const c=new THREE.Color(hex);for(const o of bikeRoot.getObjectByName('fuel-tank')?[bikeRoot.getObjectByName('fuel-tank')]:[]){o.material.color.copy(c)}for(const o of bikeRoot.children[0].children){if(o.name==='upper-fairing'||o.name==='red-fairing'||o.name==='front-nose'){if(o.material===M.red||o.name==='red-fairing')o.material.color.copy(c)}}showToast('PAINT UPDATED')}
$('left').addEventListener('pointerdown',e=>{e.preventDefault();$('left').classList.add('active');moveLane(-1)});$('right').addEventListener('pointerdown',e=>{e.preventDefault();$('right').classList.add('active');moveLane(1)});
for(const id of ['left','right'])$(id).addEventListener('pointerup',()=>$(id).classList.remove('active'));
$('boost').addEventListener('pointerdown',e=>{e.preventDefault();nitroOn=true;$('boost').classList.add('active');tone(680,.12,'sawtooth',.025)});$('boost').addEventListener('pointerup',()=>{nitroOn=false;$('boost').classList.remove('active')});$('boost').addEventListener('pointercancel',()=>{nitroOn=false;$('boost').classList.remove('active')});
$('brake').addEventListener('pointerdown',e=>{e.preventDefault();brakeOn=true;$('brake').classList.add('active')});$('brake').addEventListener('pointerup',()=>{brakeOn=false;$('brake').classList.remove('active')});$('brake').addEventListener('pointercancel',()=>{brakeOn=false;$('brake').classList.remove('active')});
window.addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')moveLane(-1);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')moveLane(1);if(e.code==='Space'&&gameState==='ride')nitroOn=true;if(e.key==='ArrowDown'&&gameState==='ride')brakeOn=true;if(e.key==='Escape'){if(gameState==='ride')pauseRide();else if(gameState==='pause')resumeRide()}});
window.addEventListener('keyup',e=>{if(e.code==='Space')nitroOn=false;if(e.key==='ArrowDown')brakeOn=false});
// Rotate the garage bike with touch / mouse drag.
canvas.addEventListener('pointerdown',e=>{if(gameState==='garage'){garageDrag=true;lastPointerX=e.clientX;canvas.setPointerCapture(e.pointerId)}});
canvas.addEventListener('pointermove',e=>{if(garageDrag&&gameState==='garage'){const dx=e.clientX-lastPointerX;bikeRoot.rotation.y+=dx*.009;lastPointerX=e.clientX}});
canvas.addEventListener('pointerup',()=>garageDrag=false);canvas.addEventListener('pointercancel',()=>garageDrag=false);

function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.045),time=clock.elapsedTime;animate(dt,time);renderer.render(scene,camera)}
try{buildScene();setState('menu');updateStats();tick();}catch(err){console.error(err);document.body.innerHTML=`<div style="padding:24px;color:white;font:16px system-ui">The 3D game could not start. Please open this project from a web server or GitHub Pages and check that the Three.js CDN is reachable.<br><pre style="white-space:pre-wrap;color:#ff9675">${String(err.stack||err)}</pre></div>`}
