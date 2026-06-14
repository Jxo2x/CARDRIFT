// --- 1. ENGINE SETUP & GLOBALE VARIABLEN ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a15, 0.002);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500); // Weitsicht für Performance optimiert

const renderer = new THREE.WebGLRenderer({ 
    antialias: false, 
    powerPreference: "high-performance",
    precision: "mediump" 
});
renderer.setSize(window.innerWidth, window.innerHeight);

// SCHATTEN KOMPLETT AUSGESCHALTET FÜR MAXIMALE LAPTOP-PERFORMANCE
renderer.shadowMap.enabled = false; 
document.getElementById('game-container').appendChild(renderer.domElement);

// --- SAFEGUARD: AUTOMATISCHER RETTUNGSRING BEI GRAFIKKARTEN-ABSTURZ ---
renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    // VRAM leeren und Spiel sauber neu starten, bevor der Bildschirm einfriert
    console.warn("Grafikkarte überlastet! Starte Spiel neu...");
    window.location.reload();
}, false);

// Game State
let isPlaying = false;
let isPaused = false;

// UI Elemente holen
const uiMenu = document.getElementById('main-menu');
const uiHud = document.getElementById('hud');
const uiPause = document.getElementById('pause-screen');
const uiSpeed = document.getElementById('ui-speed');
const uiTime = document.getElementById('ui-time');
const nitroBar = document.getElementById('nitro-bar');
const btnPlay = document.getElementById('btn-play');
const uiDrift = document.getElementById('ui-bottom-left');

// --- 2. BELEUCHTUNG & WETTER ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45); // Etwas heller, da Schatten fehlen
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffee, 0.8);
sunLight.position.set(100, 150, 50);
scene.add(sunLight);

let timeOfDay = Math.PI / 4; 

// --- 3. WELT & RENNSTRECKE ---
const groundMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.9, metalness: 0.1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const trackPoints = [
    new THREE.Vector3(0, 0.05, 0),
    new THREE.Vector3(30, 0.05, 180),     
    new THREE.Vector3(150, 0.05, 300),
    new THREE.Vector3(350, 0.05, 250),    
    new THREE.Vector3(400, 0.05, 450),    
    new THREE.Vector3(250, 0.05, 600),
    new THREE.Vector3(50, 0.05, 500),
    new THREE.Vector3(-150, 0.05, 650),   
    new THREE.Vector3(-350, 0.05, 500),
    new THREE.Vector3(-250, 0.05, 300),
    new THREE.Vector3(-500, 0.05, 200),   
    new THREE.Vector3(-600, 0.05, -50),
    new THREE.Vector3(-400, 0.05, -250),  
    new THREE.Vector3(-450, 0.05, -450),
    new THREE.Vector3(-200, 0.05, -550),
    new THREE.Vector3(0, 0.05, -400),     
    new THREE.Vector3(250, 0.05, -500),
    new THREE.Vector3(500, 0.05, -350),   
    new THREE.Vector3(450, 0.05, -100),
    new THREE.Vector3(200, 0.05, -50),
    new THREE.Vector3(100, 0.05, -150)
];
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);

const trackGeometry = new THREE.TubeGeometry(trackCurve, 200, 26, 8, false); // Extrem polygonarm gemacht
const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.6, metalness: 0.2 });
const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
trackMesh.scale.set(1, 0.005, 1); 
scene.add(trackMesh);

// Neon-Barrieren & Lichter (Auf 450 reduziert – schont den Prozessor)
const barrierCount = 450; 
const barrierGeo = new THREE.BoxGeometry(1.5, 1.2, 4);
const barrierMatInner = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });

const leftBarriers = new THREE.InstancedMesh(barrierGeo, barrierMatInner, barrierCount);
const rightBarriers = new THREE.InstancedMesh(barrierGeo, barrierMatInner, barrierCount);

const lightMarkerGeo = new THREE.BoxGeometry(0.4, 0.08, 1.5);
const lightMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); 
const floorMarkersLeft = new THREE.InstancedMesh(lightMarkerGeo, lightMarkerMat, barrierCount);
const floorMarkersRight = new THREE.InstancedMesh(lightMarkerGeo, lightMarkerMat, barrierCount);

const dummyObj = new THREE.Object3D();

for (let i = 0; i < barrierCount; i++) {
    const t = i / barrierCount;
    const pos = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const angle = Math.atan2(-tangent.z, tangent.x);

    let leftPos = pos.clone().add(normal.clone().multiplyScalar(27));
    dummyObj.position.set(leftPos.x, 0.6, leftPos.z);
    dummyObj.rotation.set(0, angle, 0);
    dummyObj.updateMatrix();
    leftBarriers.setMatrixAt(i, dummyObj.matrix);

    let leftLightPos = pos.clone().add(normal.clone().multiplyScalar(24));
    dummyObj.position.set(leftLightPos.x, 0.08, leftLightPos.z);
    dummyObj.updateMatrix();
    floorMarkersLeft.setMatrixAt(i, dummyObj.matrix);

    let rightPos = pos.clone().add(normal.clone().multiplyScalar(-27));
    dummyObj.position.set(rightPos.x, 0.6, rightPos.z);
    dummyObj.rotation.set(0, angle, 0);
    dummyObj.updateMatrix();
    rightBarriers.setMatrixAt(i, dummyObj.matrix);

    let rightLightPos = pos.clone().add(normal.clone().multiplyScalar(-24));
    dummyObj.position.set(rightLightPos.x, 0.08, rightLightPos.z);
    dummyObj.updateMatrix();
    floorMarkersRight.setMatrixAt(i, dummyObj.matrix);
}
scene.add(leftBarriers, rightBarriers, floorMarkersLeft, floorMarkersRight);

// --- 4. FAHRZEUG ---
const carGroup = new THREE.Group();
carGroup.position.y = 0.5;

const carVisualGroup = new THREE.Group();
carGroup.add(carVisualGroup);

const paintMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.6, roughness: 0.3 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.8, roughness: 0.2 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 });
const tailLightMat = new THREE.MeshBasicMaterial({ color: 0x660000 });

const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 5.2), paintMat);
chassis.position.y = 0.6;
carVisualGroup.add(chassis);

const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 3.4), glassMat);
cabin.position.set(0, 1.2, -0.2);
carVisualGroup.add(cabin);

const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.4), paintMat);
spoiler.position.set(0, 1.5, -1.9); spoiler.rotation.x = -0.1;
carVisualGroup.add(spoiler);

const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6);
exhaustGeo.rotateX(Math.PI / 2);
for(let i of [-0.6, 0.6]) { // Auspuffrohre von 4 auf 2 reduziert
    let ex = new THREE.Mesh(exhaustGeo, chromeMat);
    ex.position.set(i, 0.4, -2.65);
    carVisualGroup.add(ex);
}

const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.1), tailLightMat);
tailL.position.set(-0.8, 0.8, -2.6);
const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.1), tailLightMat);
tailR.position.set(0.8, 0.8, -2.6);
carVisualGroup.add(tailL, tailR);

// Scheinwerfer-Lichter (Keine rechenintensiven Spotlights mehr, sondern reine Leuchtflächen)
const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
hlL.position.set(-0.8, 0.8, 2.6);
const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
hlR.position.set(0.8, 0.8, 2.6);
carVisualGroup.add(hlL, hlR);

const wheels = [];
const frontWheels = [];
const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12); // Extrem CPU-schonend
wheelGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7 });
const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.42, 8);
rimGeo.rotateZ(Math.PI / 2);

const wPos = [
    { x: -1.2, z: 1.6, front: true }, { x: 1.2, z: 1.6, front: true },
    { x: -1.2, z: -1.6, front: false }, { x: 1.2, z: -1.6, front: false }
];

wPos.forEach(p => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wGroup.add(tire, rim);
    wGroup.position.set(p.x, 0.45, p.z);
    carVisualGroup.add(wGroup);
    wheels.push(wGroup);
    if(p.front) frontWheels.push(wGroup);
});

scene.add(carGroup);

// --- 5. DRIFT STAUBWOLKEN-SYSTEM ---
const smokeParticlesCount = 35; // Weiter reduziert für flüssiges Rendering
const smokeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x5599cc,
    transparent: true,
    opacity: 0
});
const smokeParticles = [];

for(let i=0; i<smokeParticlesCount; i++) {
    const p = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
    p.position.set(0, -100, 0);
    scene.add(p);
    smokeParticles.push({
        mesh: p,
        life: 0,
        maxLife: 0,
        velocity: new THREE.Vector3()
    });
}
let lastSmokeIndex = 0;

function spawnSmoke(position, carVelocityHeading) {
    const p = smokeParticles[lastSmokeIndex];
    p.mesh.position.copy(position);
    p.mesh.position.y = 0.15;
    p.life = 1.0;
    p.maxLife = 20 + Math.random() * 10;
    
    p.velocity.set(
        -Math.sin(carVelocityHeading) * 0.05 + (Math.random() - 0.5) * 0.05,
        0.02 + Math.random() * 0.01,
        -Math.cos(carVelocityHeading) * 0.05 + (Math.random() - 0.5) * 0.05
    );
    
    p.mesh.scale.set(1, 1, 1);
    lastSmokeIndex = (lastSmokeIndex + 1) % smokeParticlesCount;
}

// --- 6. KAMERA-SYSTEM ---
const cams = [
    { offset: new THREE.Vector3(0, 4.8, -7.5), lookOffset: new THREE.Vector3(0, 0.8, 6) },
    { offset: new THREE.Vector3(0, 3.2, -4.5), lookOffset: new THREE.Vector3(0, 0.8, 10) }
];
let camIndex = 0;

// --- 7. PHYSIK & INPUTS ---
const keys = { w: false, s: false, a: false, d: false, shift: false, space: false };
let speed = 0, heading = 0, steerAngle = 0;
let nitro = 100;
let nitroLocked = false; 

let driftAngle = 0; 
let isDrifting = false;
let currentMovementHeading = 0;

const maxSpeed = 1.75, accel = 0.012, brake = 0.035, drag = 0.982;
let startPos = new THREE.Vector3(0, 0, 0);

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = true;
    if(e.key === 'Shift') keys.shift = true;
    if(e.key === ' ') keys.space = true;
    
    if(k === 'p' && isPlaying) {
        isPaused = !isPaused;
        uiPause.classList.toggle('hidden', !isPaused);
    }
    if(k === 'c') camIndex = (camIndex + 1) % cams.length;
    if(k === 'r') {
        carGroup.position.copy(startPos);
        speed = 0; heading = 0; currentMovementHeading = 0; carGroup.rotation.set(0,0,0);
        driftAngle = 0; carVisualGroup.rotation.y = 0;
    }
    
    if(e.key === 'Escape' && isPlaying) {
        isPlaying = false; isPaused = false;
        uiPause.classList.add('hidden'); uiHud.classList.add('hidden'); uiMenu.classList.remove('hidden'); uiDrift.classList.add('hidden');
        speed = 0; driftAngle = 0;
        keys.w = keys.s = keys.a = keys.d = keys.shift = keys.space = false;
    }
});

window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = false;
    if(e.key === 'Shift') keys.shift = false;
    if(e.key === ' ') keys.space = false;
});

// --- 8. REGEN (Auf 1.200 Partikel herabgesetzt) ---
const rainGeo = new THREE.BufferGeometry();
const rainCount = 1200; 
const rainPos = new Float32Array(rainCount * 3);
for(let i=0; i<rainCount*3; i++) {
    rainPos[i] = (Math.random() - 0.5) * 120;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({color: 0xaaaaaa, size: 0.15, transparent: true, opacity: 0.2});
const rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

btnPlay.addEventListener('click', () => {
    uiMenu.classList.add('hidden'); uiHud.classList.remove('hidden');
    isPlaying = true;
    currentMovementHeading = heading;
});

// --- 9. GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    timeOfDay += 0.0004; 
    let sunY = Math.cos(timeOfDay) * 200;
    
    let isNight = sunY < 10;

    if(isNight) {
        scene.background = new THREE.Color(0x020205); 
        lightMarkerMat.color.setHex(0x00ffff);
        smokeMaterial.color.setHex(0x00bbff);
    } else {
        scene.background = new THREE.Color(0x76a7c2); 
        lightMarkerMat.color.setHex(0x006666);
        smokeMaterial.color.setHex(0x55555a);
    }

    if (!isPlaying) {
        // Kamera steht im Menü fest – das spart enorm viel Rechenkraft
        camera.position.set(0, 70, -200);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        renderer.render(scene, camera);
        return; 
    }

    if (isPaused) return;

    // Nitro
    let useNitro = keys.shift && speed > 0.1 && !nitroLocked && nitro > 0;
    if (useNitro) {
        nitro -= 0.8; 
        if (nitro <= 0) { nitro = 0; nitroLocked = true; nitroBar.style.background = "#555555"; }
    } else if (nitro < 100) {
        nitro += 0.2; 
        if (nitro >= 20 && nitroLocked) { nitroLocked = false; nitroBar.style.background = "#ff0055"; }
    }

    let currentAccel = accel * (useNitro ? 2.2 : 1.0);
    camera.fov = THREE.MathUtils.lerp(camera.fov, useNitro ? 68 : 60, 0.08);
    camera.updateProjectionMatrix();

    if (keys.w) speed += currentAccel;
    else if (keys.s) { speed -= brake; tailLightMat.color.setHex(0xff0000); }
    else { speed *= drag; tailLightMat.color.setHex(0x550000); }
    
    if(keys.space) speed *= 0.94; 
    speed = Math.max(-0.4, Math.min(speed, maxSpeed * (useNitro ? 1.4 : 1)));

    // Drift
    let isSteering = keys.a || keys.d;
    if (Math.abs(speed) > 0.5 && isSteering && (keys.space || Math.abs(steerAngle) > 0.32)) {
        isDrifting = true;
        uiDrift.classList.remove('hidden');
    } else {
        if (Math.abs(driftAngle) < 0.05) {
            isDrifting = false; uiDrift.classList.add('hidden');
        }
    }

    if(Math.abs(speed) > 0.01) {
        if(keys.a) steerAngle = Math.min(steerAngle + 0.06, 0.52);
        else if(keys.d) steerAngle = Math.max(steerAngle - 0.06, -0.52);
        else steerAngle *= 0.75;
        
        let steeringFactor = isDrifting ? 1.8 : 1.0;
        heading += steerAngle * (keys.space ? 0.08 : 0.042) * steeringFactor * (speed > 0 ? 1 : -1);
    } else {
        steerAngle *= 0.7;
    }

    let targetDriftAngle = isDrifting ? -steerAngle * 0.95 : 0;
    driftAngle = THREE.MathUtils.lerp(driftAngle, targetDriftAngle, isDrifting ? 0.15 : 0.08);
    carVisualGroup.rotation.y = driftAngle;

    carVisualGroup.rotation.z = THREE.MathUtils.lerp(carVisualGroup.rotation.z, steerAngle * speed * 0.22, 0.1); 
    carVisualGroup.rotation.x = THREE.MathUtils.lerp(carVisualGroup.rotation.x, (keys.w ? -0.015 : (keys.s ? 0.03 : 0)), 0.1); 

    frontWheels.forEach(w => w.rotation.y = steerAngle - driftAngle * 0.5);
    wheels.forEach(w => w.children.forEach(c => c.rotation.x -= speed * 0.5));

    carGroup.rotation.y = heading;
    let gripSmoothness = isDrifting ? 0.06 : 0.25; 
    currentMovementHeading = THREE.MathUtils.lerp(currentMovementHeading, heading + driftAngle * 0.4, gripSmoothness);

    carGroup.position.x += Math.sin(currentMovementHeading) * speed;
    carGroup.position.z += Math.cos(currentMovementHeading) * speed;

    // Staub
    if (isDrifting && Math.abs(speed) > 0.3) {
        const leftWheelWorld = new THREE.Vector3(-1.2, 0.2, -1.6).applyMatrix4(carVisualGroup.matrixWorld);
        const rightWheelWorld = new THREE.Vector3(1.2, 0.2, -1.6).applyMatrix4(carVisualGroup.matrixWorld);
        if(Math.random() > 0.5) spawnSmoke(leftWheelWorld, currentMovementHeading);
        if(Math.random() > 0.5) spawnSmoke(rightWheelWorld, currentMovementHeading);
    }

    smokeParticles.forEach(p => {
        if (p.life > 0) {
            p.mesh.position.add(p.velocity);
            p.life -= 1 / p.maxLife;
            p.mesh.scale.addScalar(0.03);
            p.mesh.material.opacity = p.life * 0.3;
            if (p.life <= 0) p.mesh.position.set(0, -100, 0);
        }
    });

    // Kamera
    const offset = cams[camIndex].offset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), heading);
    let targetCamPos = carGroup.position.clone().add(offset);
    camera.position.lerp(targetCamPos, 0.15); 
    const lookAtPos = carGroup.position.clone().add(cams[camIndex].lookOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), heading));
    camera.lookAt(lookAtPos);

    // Regen
    const pr = rain.geometry.attributes.position.array;
    for(let i=1; i<rainCount*3; i+=3) {
        pr[i] -= 1.5;
        if(pr[i] < 0) {
            pr[i] = 100;
            pr[i-1] = carGroup.position.x + (Math.random()-0.5)*120;
            pr[i+1] = carGroup.position.z + (Math.random()-0.5)*120;
        }
    }
    rain.geometry.attributes.position.needsUpdate = true;

    // HUD
    uiSpeed.innerText = Math.round(Math.abs(speed * 135)) + ' km/h'; 
    nitroBar.style.width = nitro + '%';
    let hour = Math.floor(((timeOfDay % (Math.PI*2)) / (Math.PI*2)) * 24 + 6) % 24;
    uiTime.innerText = hour.toString().padStart(2, '0') + ':00';

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();