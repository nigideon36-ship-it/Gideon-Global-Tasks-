import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTasks } from '../context/TaskContext';
import { Globe, RotateCw, MapPin, Eye, Compass, Sparkles } from 'lucide-react';

interface CityHub {
  name: string;
  country: string;
  lat: number;
  lng: number;
  bounties: number;
  activeWorkers: number;
  color: number;
}

const GLOBAL_HUBS: CityHub[] = [
  { name: 'Nairobi', country: 'Kenya', lat: -1.286389, lng: 36.817223, bounties: 42, activeWorkers: 1240, color: 0x10b981 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, bounties: 38, activeWorkers: 980, color: 0x3b82f6 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, bounties: 29, activeWorkers: 640, color: 0xf59e0b },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333, bounties: 35, activeWorkers: 810, color: 0xec4899 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, bounties: 56, activeWorkers: 1820, color: 0x8b5cf6 },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842, bounties: 48, activeWorkers: 1430, color: 0x06b6d4 },
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006, bounties: 62, activeWorkers: 2100, color: 0x6366f1 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, bounties: 31, activeWorkers: 790, color: 0x14b8a6 }
];

export const ThreeGlobeHub: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedHub, setSelectedHub] = useState<CityHub>(GLOBAL_HUBS[0]);
  const [isRotating, setIsRotating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.003);

  const { setActiveTab } = useTasks();

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Procedural Earth Texture (Canvas-based to eliminate external 404 risk)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Ocean gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
      oceanGrad.addColorStop(0, '#0a192f');
      oceanGrad.addColorStop(1, '#07101e');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 1024, 512);

      // Procedural continents approximation
      ctx.fillStyle = '#1e293b';
      // Africa / Europe
      ctx.beginPath();
      ctx.ellipse(540, 260, 90, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eurasia
      ctx.beginPath();
      ctx.ellipse(720, 160, 180, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      // Americas
      ctx.beginPath();
      ctx.ellipse(260, 190, 70, 100, -0.2, 0, Math.PI * 2);
      ctx.ellipse(320, 360, 60, 110, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Australia
      ctx.beginPath();
      ctx.ellipse(840, 370, 50, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Grid lat/long coordinates lines
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1024; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 0; y < 512; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Composite Earth Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // Part 1: Main Globe Sphere
    const globeGeo = new THREE.SphereGeometry(2.8, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.15,
      bumpScale: 0.05
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    earthGroup.add(globeMesh);

    // Part 2: Atmosphere Glow Rim
    const atmosGeo = new THREE.SphereGeometry(2.95, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // Part 3: Equatorial Telemetry Orbit Ring
    const ringGeo = new THREE.RingGeometry(3.6, 3.65, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    earthGroup.add(ringMesh);

    // Helper: lat/long to 3D Cartesian coordinates
    const latLngToVector3 = (lat: number, lng: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    // Part 4: Plotted City Task Beacons
    GLOBAL_HUBS.forEach((hub) => {
      const pos = latLngToVector3(hub.lat, hub.lng, 2.82);

      // Pin base dot
      const pinGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: hub.color });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pos);
      earthGroup.add(pinMesh);

      // Vertical beacon beam
      const beamGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: hub.color,
        transparent: true,
        opacity: 0.8
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.copy(pos.clone().multiplyScalar(1.05));
      beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      earthGroup.add(beamMesh);
    });

    // Part 5: Procedural Satellite Probe Group (7 distinct parts)
    const satelliteGroup = new THREE.Group();
    // Chassis
    const chassisGeo = new THREE.BoxGeometry(0.18, 0.18, 0.28);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    satelliteGroup.add(chassis);

    // Left Solar Wing
    const wingGeo = new THREE.BoxGeometry(0.5, 0.02, 0.2);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.3 });
    const wingLeft = new THREE.Mesh(wingGeo, wingMat);
    wingLeft.position.x = 0.35;
    satelliteGroup.add(wingLeft);

    // Right Solar Wing
    const wingRight = new THREE.Mesh(wingGeo, wingMat);
    wingRight.position.x = -0.35;
    satelliteGroup.add(wingRight);

    // Golden Antenna Dish
    const dishGeo = new THREE.SphereGeometry(0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.1 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.z = 0.16;
    dish.rotation.x = Math.PI / 2;
    satelliteGroup.add(dish);

    scene.add(satelliteGroup);

    // 4. Studio PBR Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(10, 8, 12);
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x6366f1, 0x090d16, 1.2);
    scene.add(fillLight);

    // Mouse drag controls for interactive inspection
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      earthGroup.rotation.y += deltaX * 0.005;
      earthGroup.rotation.x += deltaY * 0.005;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 5. 60fps Render Loop
    let animationFrameId: number;
    let orbitAngle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (isRotating && !isDragging) {
        earthGroup.rotation.y += rotationSpeed;
      }

      // Orbit satellite around the globe
      orbitAngle += 0.015;
      const orbitRadius = 4.2;
      satelliteGroup.position.x = Math.cos(orbitAngle) * orbitRadius;
      satelliteGroup.position.z = Math.sin(orbitAngle) * orbitRadius;
      satelliteGroup.position.y = Math.sin(orbitAngle * 1.5) * 1.2;
      satelliteGroup.rotation.y = -orbitAngle;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRotating, rotationSpeed]);

  return (
    <div className="relative w-full h-[580px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Top Header (<= 15% footprint) */}
      <div className="relative z-10 p-6 flex items-start justify-between pointer-events-none">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/60 backdrop-blur-md rounded-lg border border-indigo-700/50 text-[11px] font-semibold text-indigo-200">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Interactive 3D Three.js Telemetry Scene</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-2 drop-shadow-md">
            Gideon Global Task Orbit
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mt-0.5">
            Click & drag to rotate the globe. Real-time task nodes active across 140+ countries.
          </p>
        </div>

        {/* Orbit Controls Dock */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 text-xs text-white">
          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              isRotating ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Toggle Auto Rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-semibold">{isRotating ? 'Spinning' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom Hub Inspection Strip */}
      <div className="relative z-10 p-6 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 p-4 max-w-3xl mx-auto shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
              style={{ backgroundColor: `#${selectedHub.color.toString(16).padStart(6, '0')}` }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-white font-bold">
                <span>{selectedHub.name}, {selectedHub.country}</span>
                <span className="text-emerald-400 font-mono">({selectedHub.bounties} Active Bounties)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {selectedHub.activeWorkers.toLocaleString()} Verified Contributors Online Today
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            {GLOBAL_HUBS.map((hub) => (
              <button
                key={hub.name}
                type="button"
                onClick={() => setSelectedHub(hub)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedHub.name === hub.name
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {hub.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap"
          >
            Browse Regional Bounties →
          </button>
        </div>
      </div>
    </div>
  );
};
