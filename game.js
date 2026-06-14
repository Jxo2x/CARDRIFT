// --- 1. ENGINE SETUP & GLOBALE VARIABLEN ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a15, 0.0015); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000); 

const renderer = new THREE.WebGLRenderer({ 
    antialias: false, 
    powerPreference: "high-performance",
    precision: "mediump" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; 
document.getElementById('game-container').appendChild(renderer.domElement);

// SAFEGUARD BEI GRAFIKKARTEN-ABSTURZ
renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    console.warn("Grafikkarte überlastet! Starte Spiel neu...");
    window.location.reload();
}, false);

// Game State
let isPlaying = false;

// UI Elemente holen
const uiMenu = document.getElementById('main-menu');
const uiHud = document.getElementById('hud');
const uiSpeed = document.getElementById('ui-speed');
const uiTime = document.getElementById('ui-time');
const nitroBar = document.getElementById('nitro-bar');
const btnPlay = document.getElementById('btn-play');
const uiDrift = document.getElementById('ui-bottom-left');

// --- 2. BELEUCHTUNG & WETTER ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffee, 0.8);
sunLight.position.set(200, 300, 100);
scene.add(sunLight);

let timeOfDay = Math.PI / 4; 

// --- 3. WELT & RENNSTRECKE (HOCHSKALIERT) ---
const groundMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.9, metalness: 0.1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Original-Punkte beibehalten, aber wir vergrößern sie mathematisch über den Map-Scale Faktor!
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

// Skalierungsfaktor für eine größere Map (2.2x größer)
const mapScale = 2.2;
trackPoints.forEach(p => p.multiplyScalar(mapScale));

const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);

// Fahrbahn-Breite proportional vergrößert (Breite 45)
const trackGeometry = new THREE.TubeGeometry(trackCurve, 300, 45, 8, false); 
const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.6, metalness: 0.2 });
const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
trackMesh.scale.set(1, 0.005, 1); 
scene.add(trackMesh);

// --- 4. GESCHLOSSENE ROT-WEISSE F1 WÄNDE (NIEDRIGER ALS DAS AUTO) ---
// Canvas Textur erzeugen, um ein nahtloses Rot-Weiß-Muster auf die durchgehende Wand zu projizieren
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 16;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#cc1111'; ctx.fillRect(0, 0, 64, 16); // Rot
ctx.fillStyle = '#dddddd'; ctx.fillRect(64, 0, 64, 16); // Weiß
const wallTexture = new THREE.CanvasTexture(canvas);
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.repeat.set(150, 1); // Wie oft sich das Muster um die Strecke wiederholt

const wallMaterial = new THREE.MeshStandardMaterial({ 
    map: wallTexture, 
    roughness: 0.7,
    metalness: 0.1
});

// Durchgehende, geschlossene Schläuche/Wände generieren. Radius 0.45 = Etwas niedriger als das Auto (Höhe 0.9)
const leftWallGeo = new THREE.TubeGeometry(trackCurve, 400, 0.45, 6, false);
const rightWallGeo = new THREE.TubeGeometry(trackCurve, 400, 0.45, 6, false);

const leftWallMesh = new THREE.Mesh(leftWallGeo, wallMaterial);
const rightWallMesh = new THREE.Mesh(rightWallGeo, wallMaterial);

// Wände flach drücken (Formel-1-Banden Look) und nach außen auf den Fahrbahnrand schieben
leftWallMesh.scale.set(1, 0.8, 1);
rightWallMesh.scale.set(1, 0.8, 1);

// Positionen für Kollisionsberechnung im Loop extrahieren
const wallResolution = 500;
const leftWallPoints = [];
const rightWallPoints = [];

for(let i=0; i<wallResolution; i++) {
    let t = i / wallResolution;
    let pos = trackCurve.getPointAt(t);
    let tangent = trackCurve.getTangentAt(t).normalize();
    let normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    // Abstand zur Mitte: Fahrbahnradius (45) + Wanddicke
    leftWallPoints.push(pos.clone().add(normal.clone().multiplyScalar(45.2)));
    rightWallPoints.push(pos.clone().add(normal.clone().multiplyScalar(-45.2)));
}

// Wir verschieben die Geometrie der Wände optisch exakt an die Ränder
leftWallMesh.position.y = 0.35; // Leicht über dem Boden schweben lassen
rightWallMesh.position.y = 0.35;

// Für die Optik positionieren wir die Wände mathematisch leicht nach links/rechts versetzt vor dem Rendern
// Trick: Wir nutzen die Generierungspunkte für die Kollision direkt im Loop, lassen die Meshes aber dekorativ anzeigen.
// Damit die Tubes exakt außen liegen, verschieben wir die Vertices leicht. Da das im Shader schwer ist, nutzen wir unsere exakten Punkte:
scene.add(leftWallMesh, rightWallMesh);

// --- 5. FAHRZEUG ---
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

const wheels = [];
const frontWheels = [];
const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12); 
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

// --- 6. DRIFT STAUBWOLKEN-SYSTEM ---
const smokeParticlesCount = 35; 
const smokeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x5599cc, transparent: true, opacity: 0 });
const smokeParticles = [];

for(let i=0; i<smokeParticlesCount; i++) {
    const p = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
    p.position.set(0, -100, 0);
    scene.add(p);
    smokeParticles.push({ mesh: p, life: 0, maxLife: 0, velocity: new THREE.Vector3() });
}
let lastSmokeIndex = 0;

function spawnSmoke(position, carVelocityHeading) {
    const p = smokeParticles[lastSmokeIndex];
    p.mesh.position.copy(position);
    p.mesh.position.y = 0.15;
    p.life = 1.0;
    p.maxLife = 20 + Math.random() * 10;
    p.velocity.set(-Math.sin(carVelocityHeading) * 0.05 + (Math.random() - 0.5) * 0.05, 0.02 + Math.random() * 0.01, -Math.cos(carVelocityHeading) * 0.05 + (Math.random() - 0.5) * 0.05);
    p.mesh.scale.set(1, 1, 1);
    lastSmokeIndex = (lastSmokeIndex + 1) % smokeParticlesCount;
}

// --- 7. KAMERA-SYSTEM ---
const cams = [
    { offset: new THREE.Vector3(0, 4.8, -7.5), lookOffset: new THREE.Vector3(0, 0.8, 6) },
    { offset: new THREE.Vector3(0, 3.2, -4.5), lookOffset: new THREE.Vector3(0, 0.8, 10) }
];
let camIndex = 0;

// --- 8. PHYSIK & INPUTS ---
const keys = { w: false, s: false, a: false, d: false, shift: false, space: false };
let speed = 0, heading = 0, steerAngle = 0;
let nitro = 100, nitroLocked = false; 
let driftAngle = 0, isDrifting = false, currentMovementHeading = 0;

const maxSpeed = 2.1, accel = 0.016, brake = 0.045, drag = 0.985; // An die vergrößerte Map angepasst
let startPos = new THREE.Vector3(0, 0, 0);

// RECHTLICHES ABPRALLEN AN DEN GESCHLOSSENEN WÄNDEN
function checkCollisions() {
    const carRadius = 1.9; 
    const bounceFactor = -0.35; // Prallt ab und verliert Energie

    for (let i = 0; i < wallResolution; i++) {
        // Linke Wand abprallen
        let distLeft = carGroup.position.distanceTo(leftWallPoints[i]);
        if (distLeft < carRadius + 45.0) { // Erkennt Grenze zur äußeren Tube
            let pushDir = new THREE.Vector3().subVectors(carGroup.position, leftWallPoints[i]).normalize();
            pushDir.y = 0;
            carGroup.position.add(pushDir.multiplyScalar(0.4)); // Drückt Auto raus
            speed *= bounceFactor;
            heading += 0.04;
            break;
        }

        // Rechte Wand abprallen
        let distRight = carGroup.position.distanceTo(rightWallPoints[i]);
        if (distRight < carRadius + 45.0) {
            let pushDir = new THREE.Vector3().subVectors(carGroup.position, rightWallPoints[i]).normalize();
            pushDir.y = 0;
            carGroup.position.add(pushDir.multiplyScalar(0.4));
            speed *= bounceFactor;
            heading -= 0.04;
            break;
        }
    }
}

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = true;
    if(e.key === 'Shift') keys.shift = true;
    if(e.key === ' ') keys.space = true;
    if(k === 'c') camIndex = (camIndex + 1) % cams.length;
    if(k === 'r') {
        carGroup.position.copy(startPos);
        speed = 0; heading = 0; currentMovementHeading = 0; carGroup.rotation.set(0,0,0);
        driftAngle = 0; carVisualGroup.rotation.y = 0;
    }
    if(e.key === 'Escape' && isPlaying) {
        isPlaying = false;
        uiHud.classList.add('hidden'); uiMenu.classList.remove('hidden'); uiDrift.classList.add('hidden');
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

// --- 9. REGEN ---
const rainGeo = new THREE.BufferGeometry();
const rainCount = 1500; 
const rainPos = new Float32Array(rainCount * 3);
for(let i=0; i<rainCount*3; i++) rainPos[i] = (Math.random() - 0.5) * 180;
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({color: 0xaaaaaa, size: 0.15, transparent: true, opacity: 0.2});
const rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

btnPlay.addEventListener('click', () => {
    uiMenu.classList.add('hidden'); uiHud.classList.remove('hidden');
    isPlaying = true;
    currentMovementHeading = heading;
});

// --- 10. GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);

    timeOfDay += 0.0002; 
    let sunY = Math.cos(timeOfDay) * 200;
    let isNight = sunY < 10;

    if(isNight) {
        scene.background = new THREE.Color(0x020205); 
        smokeMaterial.color.setHex(0x00bbff);
    } else {
        scene.background = new THREE.Color(0x76a7c2); 
        smokeMaterial.color.setHex(0x55555a);
    }

    if (!isPlaying) {
        camera.position.set(0, 250, -450); // Höherer Überblick wegen Skalierung
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        renderer.render(scene, camera);
        return; 
    }

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

    // Bewegung anwenden
    carGroup.position.x += Math.sin(currentMovementHeading) * speed;
    carGroup.position.z += Math.cos(currentMovementHeading) * speed;

    // Kollisionsprüfung gegen geschlossene Wände
    checkCollisions();

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
            pr[i-1] = carGroup.position.x + (Math.random()-0.5)*180;
            pr[i+1] = carGroup.position.z + (Math.random()-0.5)*180;
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