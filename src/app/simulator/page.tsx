'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  Shield,
  ShieldAlert,
  Crosshair,
  Eye,
  Camera,
  Moon,
  Flame,
  Layers,
  ChevronRight,
  Maximize2,
  Anchor,
  Radio,
  Zap,
  Info,
  Sliders,
  Terminal,
  Activity,
  ArrowLeft
} from 'lucide-react';

// Target types matching the desktop application
type TargetType = 'ENEMY_CORVETTE' | 'ENEMY_PATROL' | 'ENEMY_BUOY' | 'CIVILIAN_CARGO' | 'FRIENDLY_BOAT';

interface SimTarget {
  id: string;
  name: string;
  type: TargetType;
  isHostile: boolean;
  x: number; // meters in world coordinates
  y: number;
  heading: number; // degrees (0 = North, 90 = East)
  speed: number; // knots
  health: number;
  destroyed: boolean;
  trail: { x: number; y: number }[];
  aiConfidence: number;
}

interface Obstacle {
  name: string;
  x: number;
  y: number;
  radius: number;
}

export default function SimulatorPage() {
  const [lang, setLang] = useState<'tr' | 'az' | 'en'>('tr');

  // Simulation State
  const [isRunning, setIsRunning] = useState(true);
  const [isArmed, setIsArmed] = useState(false);
  const [isSubmerged, setIsSubmerged] = useState(false); // Semi-submersible mode (-1.8m)
  const [isSwarmActive, setIsSwarmActive] = useState(false); // 3x Wolfpack
  const [cameraMode, setCameraMode] = useState<'optical' | 'flir' | 'starlight'>('optical');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [targetSpeedKnots, setTargetSpeedKnots] = useState(32); // Max 42

  // Interaction Mode on Radar
  const [interactionMode, setInteractionMode] = useState<'SELECT' | 'DRAW_ROUTE' | 'SPAWN_TARGET'>('SELECT');
  const [spawnType, setSpawnType] = useState<TargetType>('ENEMY_PATROL');

  // Telemetry
  const [metSeconds, setMetSeconds] = useState(0);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [impactHappened, setImpactHappened] = useState(false);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // References for Canvas
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulation physics ref (mutable without triggering rerender on every tick)
  const simRef = useRef({
    boat: {
      x: 0,
      y: -550,
      heading: 0,
      speed: 0, // knots
      rudder: 0, // degrees
      depth: 0, // meters (0 to 1.8)
      trail: [] as { x: number; y: number }[],
      battery: 98.4
    },
    swarm: [
      { id: 'bravo', offsetAngle: -45, offsetDist: 50, x: -35, y: -585, heading: 0, trail: [] as { x: number; y: number }[] },
      { id: 'charlie', offsetAngle: 45, offsetDist: 50, x: 35, y: -585, heading: 0, trail: [] as { x: number; y: number }[] }
    ],
    targets: [
      {
        id: 'tgt-1',
        name: 'Düşman Korvet (T-22)',
        type: 'ENEMY_CORVETTE',
        isHostile: true,
        x: 180,
        y: 420,
        heading: 260,
        speed: 14,
        health: 100,
        destroyed: false,
        trail: [],
        aiConfidence: 96.4
      },
      {
        id: 'tgt-2',
        name: 'Düşman Hücumbot (Fast-Attack)',
        type: 'ENEMY_PATROL',
        isHostile: true,
        x: -420,
        y: 260,
        heading: 110,
        speed: 22,
        health: 100,
        destroyed: false,
        trail: [],
        aiConfidence: 93.1
      },
      {
        id: 'tgt-3',
        name: 'Sivil Konteyner (MSC Bosphorus)',
        type: 'CIVILIAN_CARGO',
        isHostile: false,
        x: -250,
        y: -120,
        heading: 30,
        speed: 11,
        health: 100,
        destroyed: false,
        trail: [],
        aiConfidence: 98.7
      },
      {
        id: 'tgt-4',
        name: 'Dost Balıkçı Teknesi',
        type: 'FRIENDLY_BOAT',
        isHostile: false,
        x: 460,
        y: -210,
        heading: 190,
        speed: 7,
        health: 100,
        destroyed: false,
        trail: [],
        aiConfidence: 95.2
      }
    ] as SimTarget[],
    obstacles: [
      { name: 'Fener Kayalıkları', x: 260, y: 150, radius: 65 },
      { name: 'Batık Sığlık Resifi', x: -280, y: 80, radius: 75 }
    ] as Obstacle[],
    waypoints: [
      { x: 0, y: -300 },
      { x: 200, y: 0 },
      { x: 0, y: 300 }
    ] as { x: number; y: number }[],
    sweepAngle: 0,
    radarRange: 1400, // meters view range
    missionState: 'PATROL' as 'PATROL' | 'INTERCEPT' | 'TERMINAL_STRIKE' | 'DESTROYED',
    explosionAnim: 0 // 0 to 1
  });

  // MET Timer
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setMetSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Main Simulation Loop (60 FPS)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const sim = simRef.current;

      if (isRunning) {
        // 1. Radar Beam sweep
        sim.sweepAngle = (sim.sweepAngle + 120 * dt) % 360;

        // 2. Update Boat Physics
        const boat = sim.boat;
        const targetSpeed = targetSpeedKnots;

        // Depth control (0.0 to 1.8m)
        const targetDepth = isSubmerged ? 1.8 : 0.0;
        boat.depth += (targetDepth - boat.depth) * 1.5 * dt;

        // Speed ramp up/down
        if (!sim.explosionAnim) {
          boat.speed += (targetSpeed - boat.speed) * 0.8 * dt;
        } else {
          boat.speed = Math.max(0, boat.speed - 30 * dt);
        }

        // 3. Autonomous Guidance & Autopilot
        let targetCourse = boat.heading;
        const lockedTarget = sim.targets.find(t => t.id === selectedTargetId && !t.destroyed);

        if (lockedTarget) {
          // Intercept mode (Proportional Guidance)
          sim.missionState = isArmed ? 'TERMINAL_STRIKE' : 'INTERCEPT';
          const dx = lockedTarget.x - boat.x;
          const dy = lockedTarget.y - boat.y;
          const dist = Math.hypot(dx, dy);

          // Lead angle intercept
          const bearingRad = Math.atan2(dx, dy);
          targetCourse = (bearingRad * 180 / Math.PI + 360) % 360;

          // Impact detection
          if (dist < 18) {
            if (isArmed) {
              lockedTarget.destroyed = true;
              lockedTarget.health = 0;
              sim.missionState = 'DESTROYED';
              sim.explosionAnim = 1.0;
              setImpactHappened(true);
            }
          }
        } else if (sim.waypoints.length > 0) {
          // Waypoint following
          sim.missionState = 'PATROL';
          const wp = sim.waypoints[0];
          const dx = wp.x - boat.x;
          const dy = wp.y - boat.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 35) {
            // Reached waypoint, cycle to next
            const finished = sim.waypoints.shift();
            if (finished) sim.waypoints.push(finished);
          } else {
            const bearingRad = Math.atan2(dx, dy);
            targetCourse = (bearingRad * 180 / Math.PI + 360) % 360;
          }
        }

        // Steer heading smoothly towards targetCourse
        let headingDiff = (targetCourse - boat.heading + 540) % 360 - 180;
        const turnRate = Math.min(Math.abs(headingDiff), 42 * dt);
        boat.heading = (boat.heading + Math.sign(headingDiff) * turnRate + 360) % 360;
        boat.rudder = Math.max(-35, Math.min(35, headingDiff));

        // Move boat forward
        const speedMps = boat.speed * 0.514444;
        const rad = (boat.heading * Math.PI) / 180;
        boat.x += Math.sin(rad) * speedMps * dt;
        boat.y += Math.cos(rad) * speedMps * dt;

        // Record boat wake trail
        if (boat.trail.length === 0 || Math.hypot(boat.x - boat.trail[0].x, boat.y - boat.trail[0].y) > 6) {
          boat.trail.unshift({ x: boat.x, y: boat.y });
          if (boat.trail.length > 70) boat.trail.pop();
        }

        // 4. Update Swarm Formations (Wolfpack)
        if (isSwarmActive) {
          sim.swarm.forEach(sw => {
            const offsetRad = ((boat.heading + sw.offsetAngle) * Math.PI) / 180;
            const targetX = boat.x + Math.sin(offsetRad) * sw.offsetDist;
            const targetY = boat.y + Math.cos(offsetRad) * sw.offsetDist;

            sw.x += (targetX - sw.x) * 2.5 * dt;
            sw.y += (targetY - sw.y) * 2.5 * dt;
            sw.heading = boat.heading;

            if (sw.trail.length === 0 || Math.hypot(sw.x - sw.trail[0].x, sw.y - sw.trail[0].y) > 8) {
              sw.trail.unshift({ x: sw.x, y: sw.y });
              if (sw.trail.length > 35) sw.trail.pop();
            }
          });
        }

        // 5. Update Targets
        sim.targets.forEach(tgt => {
          if (tgt.destroyed) return;

          // Target evasion if hostile & boat is close
          const distToBoat = Math.hypot(tgt.x - boat.x, tgt.y - boat.y);
          if (tgt.isHostile && distToBoat < 350) {
            tgt.speed = Math.min(26, tgt.speed + 4 * dt);
            const escapeBearing = (Math.atan2(tgt.x - boat.x, tgt.y - boat.y) * 180 / Math.PI + 360) % 360;
            let diff = (escapeBearing - tgt.heading + 540) % 360 - 180;
            tgt.heading = (tgt.heading + Math.sign(diff) * Math.min(Math.abs(diff), 30 * dt) + 360) % 360;
          }

          const tgtSpeedMps = tgt.speed * 0.514444;
          const tgtRad = (tgt.heading * Math.PI) / 180;
          tgt.x += Math.sin(tgtRad) * tgtSpeedMps * dt;
          tgt.y += Math.cos(tgtRad) * tgtSpeedMps * dt;

          if (tgt.trail.length === 0 || Math.hypot(tgt.x - tgt.trail[0].x, tgt.y - tgt.trail[0].y) > 10) {
            tgt.trail.unshift({ x: tgt.x, y: tgt.y });
            if (tgt.trail.length > 30) tgt.trail.pop();
          }
        });

        // 6. Check Collateral Damage Warning (Civilian proximity)
        let alertMsg: string | null = null;
        if (lockedTarget) {
          sim.targets.forEach(other => {
            if (!other.isHostile && !other.destroyed) {
              const d = Math.hypot(lockedTarget.x - other.x, lockedTarget.y - other.y);
              if (d < 280) {
                alertMsg = `⚠ DİKKAT: Sivil unsur yakın (${other.name} - ${Math.round(d)}m) // İkincil Hasar Riski!`;
              }
            }
          });
        }
        setActiveAlert(alertMsg);

        // Explosion animation decay
        if (sim.explosionAnim > 0) {
          sim.explosionAnim = Math.max(0, sim.explosionAnim - 0.5 * dt);
        }
      }

      // Render Canvases
      renderRadar();
      renderHud();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isArmed, isSubmerged, isSwarmActive, targetSpeedKnots, selectedTargetId, cameraMode, zoomLevel]);

  // ---------------- RADAR RENDERING ----------------
  const renderRadar = () => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const sim = simRef.current;
    const scale = (width * 0.45) / sim.radarRange; // meters to canvas pixels

    // Clear background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    // World to Radar Screen Transform
    const toScreen = (wx: number, wy: number) => {
      // Boat is centered on radar
      const relX = wx - sim.boat.x;
      const relY = wy - sim.boat.y;
      return {
        x: cx + relX * scale,
        y: cy - relY * scale
      };
    };

    // Draw Range Rings (500m, 1000m, 1400m)
    [400, 800, 1200].forEach(rMeters => {
      const rPx = rMeters * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#12253d';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Range label
      ctx.fillStyle = '#3a587d';
      ctx.font = '10px monospace';
      ctx.fillText(`${rMeters}m`, cx + 6, cy - rPx + 12);
    });

    // Radar Crosshairs & Compass Rose
    ctx.beginPath();
    ctx.moveTo(cx, 15);
    ctx.lineTo(cx, height - 15);
    ctx.moveTo(15, cy);
    ctx.lineTo(width - 15, cy);
    ctx.strokeStyle = '#12253d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Compass cardinal markers
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N (000°)', cx, 22);
    ctx.fillText('S (180°)', cx, height - 8);
    ctx.fillText('E (090°)', width - 26, cy + 4);
    ctx.fillText('W (270°)', 26, cy + 4);

    // Rotating Radar Sweep Beam
    const sweepRad = (sim.sweepAngle * Math.PI) / 180;
    const beamRadius = width * 0.46;
    const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, beamRadius);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, beamRadius, sweepRad - 0.45, sweepRad);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Obstacles (Kayalıklar)
    sim.obstacles.forEach(obs => {
      const p = toScreen(obs.x, obs.y);
      const r = obs.radius * scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#facc15';
      ctx.font = '10px sans-serif';
      ctx.fillText(obs.name, p.x, p.y + r + 12);
    });

    // Draw Planned Waypoints Route
    if (sim.waypoints.length > 0) {
      ctx.beginPath();
      const first = toScreen(sim.waypoints[0].x, sim.waypoints[0].y);
      ctx.moveTo(first.x, first.y);
      sim.waypoints.forEach((wp, idx) => {
        const p = toScreen(wp.x, wp.y);
        ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint flags
      sim.waypoints.forEach((wp, idx) => {
        const p = toScreen(wp.x, wp.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff';
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText(`WP${idx + 1}`, p.x + 8, p.y + 4);
      });
    }

    // Draw Swarm (Wolfpack wingmen)
    if (isSwarmActive) {
      sim.swarm.forEach(sw => {
        const sp = toScreen(sw.x, sw.y);
        // Wingman wake
        ctx.beginPath();
        sw.trail.forEach((tp, i) => {
          const s = toScreen(tp.x, tp.y);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Icon
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '9px monospace';
        ctx.fillText(sw.id.toUpperCase(), sp.x + 8, sp.y);
      });
    }

    // Draw Boat Wake Trail
    ctx.beginPath();
    sim.boat.trail.forEach((tp, i) => {
      const s = toScreen(tp.x, tp.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.strokeStyle = isSubmerged ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Targets
    sim.targets.forEach(tgt => {
      const tp = toScreen(tgt.x, tgt.y);

      // Collateral damage safe bubble for civilian/friendly ships
      if (!tgt.isHostile && !tgt.destroyed) {
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 280 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (tgt.destroyed) {
        // Destroyed marker (X)
        ctx.beginPath();
        ctx.moveTo(tp.x - 7, tp.y - 7);
        ctx.lineTo(tp.x + 7, tp.y + 7);
        ctx.moveTo(tp.x + 7, tp.y - 7);
        ctx.lineTo(tp.x - 7, tp.y + 7);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.fillText(`[İMHA] ${tgt.name}`, tp.x, tp.y + 14);
        return;
      }

      const isSelected = tgt.id === selectedTargetId;
      const color = tgt.isHostile ? '#ef4444' : '#10b981';

      // Selection ring if locked
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Target Symbol
      ctx.beginPath();
      if (tgt.isHostile) {
        // Diamond for hostile
        ctx.moveTo(tp.x, tp.y - 7);
        ctx.lineTo(tp.x + 7, tp.y);
        ctx.lineTo(tp.x, tp.y + 7);
        ctx.lineTo(tp.x - 7, tp.y);
        ctx.closePath();
      } else {
        // Circle / Square for civilian
        ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2);
      }
      ctx.fillStyle = color;
      ctx.fill();

      // Velocity vector line (30s future course)
      const vDist = (tgt.speed * 0.514444 * 25) * scale;
      const vRad = (tgt.heading * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(tp.x + Math.sin(vRad) * vDist, tp.y - Math.cos(vRad) * vDist);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Target Label
      ctx.fillStyle = isSelected ? '#00f0ff' : '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.fillText(tgt.name, tp.x, tp.y - 12);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(`${tgt.speed.toFixed(0)}kt • %${tgt.aiConfidence.toFixed(0)}`, tp.x, tp.y + 16);
    });

    // Draw Own Boat (Alpha Kamikaze USV at center)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((sim.boat.heading * Math.PI) / 180);

    // USV Hull Icon
    ctx.beginPath();
    ctx.moveTo(0, -14); // Bow
    ctx.lineTo(6, 4);
    ctx.lineTo(5, 12);
    ctx.lineTo(-5, 12);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fillStyle = isSubmerged ? '#0284c7' : '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Boat heading vector line
    const bVecDist = (sim.boat.speed * 0.514444 * 25) * scale;
    const bRad = (sim.boat.heading * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(bRad) * bVecDist, cy - Math.cos(bRad) * bVecDist);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Explosion animation overlay
    if (sim.explosionAnim > 0) {
      const maxR = 90 * (1 - sim.explosionAnim);
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${sim.explosionAnim * 0.7})`;
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  // ---------------- FPV HUD RENDERING ----------------
  const renderHud = () => {
    const canvas = hudCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const sim = simRef.current;

    // Camera palettes
    if (cameraMode === 'optical') {
      // Daylight marine palette
      const skyGrad = ctx.createLinearGradient(0, 0, 0, cy);
      skyGrad.addColorStop(0, '#0c1a2f');
      skyGrad.addColorStop(1, '#1b3252');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, cy);

      const seaGrad = ctx.createLinearGradient(0, cy, 0, height);
      seaGrad.addColorStop(0, '#0a2136');
      seaGrad.addColorStop(1, '#05111c');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, cy, width, height - cy);
    } else if (cameraMode === 'flir') {
      // Thermal FLIR White-Hot Palette (Greenscale military)
      ctx.fillStyle = '#05120b';
      ctx.fillRect(0, 0, width, height);

      // FLIR Horizon
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
      ctx.stroke();
    } else {
      // Starlight Night Vision Mode
      ctx.fillStyle = '#020e06';
      ctx.fillRect(0, 0, width, height);

      // Starlight noise grain simulation
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
      }
    }

    // Submersible Periscope Overlay
    if (isSubmerged) {
      // Deep underwater bluish/green tint
      ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Vignette periscope mask
      const vigGrad = ctx.createRadialGradient(cx, cy, width * 0.25, cx, cy, width * 0.55);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0, 10, 25, 0.85)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, width, height);

      // Periscope Depth Indicator
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`🤿 YARI-BATARLI PERİSKOP MODU: -${sim.boat.depth.toFixed(1)}m`, 20, 35);
    }

    // Pitch Ladder / Artificial Horizon
    const hudColor = cameraMode === 'flir' ? '#4ade80' : cameraMode === 'starlight' ? '#22c55e' : '#00f0ff';

    ctx.strokeStyle = hudColor;
    ctx.lineWidth = 1.5;

    // Pitch ticks
    [-20, -10, 0, 10, 20].forEach(deg => {
      const yPos = cy - deg * 3.5;
      if (yPos > 40 && yPos < height - 40) {
        ctx.beginPath();
        ctx.moveTo(cx - 45, yPos);
        ctx.lineTo(cx - 20, yPos);
        ctx.moveTo(cx + 20, yPos);
        ctx.lineTo(cx + 45, yPos);
        ctx.stroke();

        ctx.fillStyle = hudColor;
        ctx.font = '9px monospace';
        ctx.fillText(`${deg}°`, cx - 58, yPos + 3);
        ctx.fillText(`${deg}°`, cx + 48, yPos + 3);
      }
    });

    // Center Aiming Reticle (Crosshair)
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.moveTo(cx - 28, cy);
    ctx.lineTo(cx - 18, cy);
    ctx.moveTo(cx + 18, cy);
    ctx.lineTo(cx + 28, cy);
    ctx.moveTo(cx, cy - 28);
    ctx.lineTo(cx, cy - 18);
    ctx.moveTo(cx, cy + 18);
    ctx.lineTo(cx, cy + 28);
    ctx.stroke();

    // Render 3D Projected Targets on FPV HUD
    sim.targets.forEach(tgt => {
      if (tgt.destroyed) return;

      // Project target relative to boat heading
      const dx = tgt.x - sim.boat.x;
      const dy = tgt.y - sim.boat.y;
      const dist = Math.hypot(dx, dy);

      // Bearing relative to boat heading (-180 to +180)
      const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      let relBearing = (bearing - sim.boat.heading + 540) % 360 - 180;

      // Camera Horizontal FOV ~ 60 degrees (adjusted by zoom)
      const fov = 60 / zoomLevel;
      if (Math.abs(relBearing) < fov / 2 && dist > 10 && dist < 1600) {
        // Target is inside camera FOV!
        const screenX = cx + (relBearing / (fov / 2)) * (width / 2);
        const screenY = cy + 10; // horizon
        const boxSize = Math.max(16, (width * 0.12 * zoomLevel * 300) / dist);

        const isLocked = tgt.id === selectedTargetId;
        const boxColor = isLocked ? '#ef4444' : hudColor;

        // Bounding Box
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = isLocked ? 2 : 1.5;
        ctx.strokeRect(screenX - boxSize / 2, screenY - boxSize / 2, boxSize, boxSize);

        // Corner bracket accents
        const cLen = Math.min(8, boxSize * 0.25);
        ctx.beginPath();
        // Top-left
        ctx.moveTo(screenX - boxSize / 2, screenY - boxSize / 2 + cLen);
        ctx.lineTo(screenX - boxSize / 2, screenY - boxSize / 2);
        ctx.lineTo(screenX - boxSize / 2 + cLen, screenY - boxSize / 2);
        // Top-right
        ctx.moveTo(screenX + boxSize / 2 - cLen, screenY - boxSize / 2);
        ctx.lineTo(screenX + boxSize / 2, screenY - boxSize / 2);
        ctx.lineTo(screenX + boxSize / 2, screenY - boxSize / 2 + cLen);
        ctx.stroke();

        // AI Vision Classification Tag
        ctx.fillStyle = boxColor;
        ctx.font = 'bold 10px monospace';
        const label = `[AI: ${tgt.name.split(' ')[0]} %${tgt.aiConfidence.toFixed(0)}]`;
        ctx.fillText(label, screenX - boxSize / 2, screenY - boxSize / 2 - 6);

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(`Menzil: ${Math.round(dist)}m`, screenX - boxSize / 2, screenY + boxSize / 2 + 14);

        if (isLocked) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('▶ KİLİTLENDİ (LOCKED) ◀', screenX - 60, screenY - boxSize / 2 - 18);
        }
      }
    });

    // Top HUD Telemetry Strip
    ctx.fillStyle = hudColor;
    ctx.font = '11px monospace';
    ctx.fillText(`Pruva: ${Math.round(sim.boat.heading)}°`, width - 110, 24);
    ctx.fillText(`Sürat: ${sim.boat.speed.toFixed(1)} kt`, width - 110, 40);
    ctx.fillText(`Sensör: ${cameraMode.toUpperCase()} ${zoomLevel.toFixed(1)}X`, 20, height - 20);

    // Armed / Safe watermark
    if (isArmed) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⚡ HARBİYE MODU: SİLAH AKTİF (ARMED)', width / 2 - 120, height - 20);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('🔒 EMNİYET MANDALI KAPALI (SAFE)', width / 2 - 110, height - 20);
    }
  };

  // Radar Click Handler (Select target, spawn target, or draw waypoints)
  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = canvas.width;
    const cx = width / 2;
    const cy = width / 2;
    const sim = simRef.current;
    const scale = (width * 0.45) / sim.radarRange;

    // Convert click pixel to world coords
    const worldX = sim.boat.x + (clickX - cx) / scale;
    const worldY = sim.boat.y - (clickY - cy) / scale;

    if (interactionMode === 'SPAWN_TARGET') {
      const isHostile = spawnType.startsWith('ENEMY');
      const newTarget: SimTarget = {
        id: `custom-${Date.now()}`,
        name:
          spawnType === 'ENEMY_CORVETTE' ? 'Düşman Korvet' :
          spawnType === 'ENEMY_PATROL' ? 'Düşman Hücumbot' :
          spawnType === 'CIVILIAN_CARGO' ? 'Sivil Kargo' : 'Dost Tekne',
        type: spawnType,
        isHostile,
        x: worldX,
        y: worldY,
        heading: Math.random() * 360,
        speed: isHostile ? 18 : 10,
        health: 100,
        destroyed: false,
        trail: [],
        aiConfidence: 94.0
      };
      sim.targets.push(newTarget);
      setSelectedTargetId(newTarget.id);
    } else if (interactionMode === 'DRAW_ROUTE') {
      sim.waypoints.push({ x: worldX, y: worldY });
    } else {
      // Find closest target
      let closestId: string | null = null;
      let minDist = 30; // pixel threshold

      sim.targets.forEach(tgt => {
        if (tgt.destroyed) return;
        const relX = tgt.x - sim.boat.x;
        const relY = tgt.y - sim.boat.y;
        const scrX = cx + relX * scale;
        const scrY = cy - relY * scale;
        const d = Math.hypot(clickX - scrX, clickY - scrY);
        if (d < minDist) {
          minDist = d;
          closestId = tgt.id;
        }
      });

      setSelectedTargetId(closestId);
    }
  };

  const handleReset = () => {
    const sim = simRef.current;
    sim.boat = {
      x: 0,
      y: -550,
      heading: 0,
      speed: 0,
      rudder: 0,
      depth: 0,
      trail: [],
      battery: 98.4
    };
    sim.targets.forEach((t, i) => {
      t.destroyed = false;
      t.health = 100;
      t.trail = [];
      if (i === 0) { t.x = 180; t.y = 420; }
      if (i === 1) { t.x = -420; t.y = 260; }
    });
    sim.waypoints = [
      { x: 0, y: -300 },
      { x: 200, y: 0 },
      { x: 0, y: 300 }
    ];
    sim.missionState = 'PATROL';
    sim.explosionAnim = 0;
    setSelectedTargetId(null);
    setImpactHappened(false);
    setIsArmed(false);
    setIsSubmerged(false);
  };

  const formatMET = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none">
      {/* TOP MILITARY C2 OPERATIONS HEADER */}
      <header className="border-b border-[#1b3152] bg-[#0d1626] px-4 py-2.5 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Title & Back */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-[#111f36] border border-[#1b3152] text-slate-400 hover:text-emerald-400 transition-colors"
              title="Başvuru Sayfasına Dön"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider text-white flex items-center gap-2">
                <span>AzTU KAMİKAZE İDA</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  C2 TAKTİK SİMÜLATÖR V2.0
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Uçta Yapay Zekâ (Edge AI) & Otonom Güdüm Konsolu
              </div>
            </div>
          </div>

          {/* Realtime Telemetry Strip */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            {/* Mission Time */}
            <div className="bg-[#111f36] border border-[#1b3152] rounded-md px-3 py-1">
              <span className="text-slate-400 mr-1.5">⏱ MET:</span>
              <span className="text-cyan-300 font-bold">{formatMET(metSeconds)}</span>
            </div>

            {/* Sürat */}
            <div className="bg-[#111f36] border border-[#1b3152] rounded-md px-3 py-1">
              <span className="text-slate-400 mr-1.5">HIZ:</span>
              <span className="text-emerald-400 font-bold">{targetSpeedKnots} kt</span>
              <span className="text-slate-500 text-[10px] ml-1">({(targetSpeedKnots * 1.852).toFixed(0)} km/h)</span>
            </div>

            {/* Dalış Derinliği */}
            <div className="bg-[#111f36] border border-[#1b3152] rounded-md px-3 py-1">
              <span className="text-slate-400 mr-1.5">DALIŞ:</span>
              <span className={`font-bold ${isSubmerged ? 'text-sky-400' : 'text-slate-300'}`}>
                {isSubmerged ? '-1.8m (Batarlı)' : '0.0m (Su Üstü)'}
              </span>
            </div>

            {/* Batarya */}
            <div className="bg-[#111f36] border border-[#1b3152] rounded-md px-3 py-1">
              <span className="text-slate-400 mr-1.5">⚡ BAT:</span>
              <span className="text-amber-400 font-bold">98.4%</span>
            </div>

            {/* Arm Switch Status */}
            <div className={`rounded-md px-3 py-1 border font-bold flex items-center gap-1.5 ${
              isArmed ? 'bg-red-950/70 border-red-500/60 text-red-300 animate-pulse' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
            }`}>
              {isArmed ? <Flame className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              <span>{isArmed ? 'ARMED (SİLAH AÇIK)' : 'SAFE (EMNİYETLİ)'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ALERT STRIP */}
      {activeAlert && (
        <div className="bg-red-950/90 border-b border-red-500/50 py-1.5 px-4 text-center text-xs font-mono font-bold text-red-200 flex items-center justify-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>{activeAlert}</span>
        </div>
      )}

      {/* MAIN DUAL DISPLAY CONSOLE */}
      <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-4">
        {/* TOP INTERACTIVE CANVASES (RADAR + FPV HUD) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT: 2D TACTICAL RADAR */}
          <div className="bg-[#0d1626] border border-[#1b3152] rounded-xl p-3 flex flex-col shadow-xl">
            {/* Header info */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b3152]/60 text-xs">
              <div className="flex items-center gap-2 font-mono font-bold text-cyan-400">
                <Radio className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>2D TAKTİK RADAR (ARPA / WGS-84)</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Menzil: 1400m • Sweep: 120°/s
              </div>
            </div>

            {/* Radar Canvas */}
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-[#1b3152] flex items-center justify-center bg-[#060a12]">
              <canvas
                ref={radarCanvasRef}
                width={560}
                height={560}
                onClick={handleRadarClick}
                className="w-full h-full cursor-crosshair"
              />

              {/* Mode indicator badge */}
              <div className="absolute top-2 left-2 bg-[#0d1626]/90 border border-cyan-500/40 px-2.5 py-1 rounded text-[11px] font-mono text-cyan-300">
                Mod: {
                  interactionMode === 'SELECT' ? '🧭 Hedef Seç / Kilitlen' :
                  interactionMode === 'DRAW_ROUTE' ? '📍 Serbest Rota Çiz (Tıkla)' :
                  '🎯 Haritaya Hedef Ekle'
                }
              </div>
            </div>
          </div>

          {/* RIGHT: FPV CAMERA HUD (OPTICAL / FLIR / STARLIGHT) */}
          <div className="bg-[#0d1626] border border-[#1b3152] rounded-xl p-3 flex flex-col shadow-xl">
            {/* Header info */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b3152]/60 text-xs">
              <div className="flex items-center gap-2 font-mono font-bold text-emerald-400">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>FPV KAMERA HUD & NPU HEDEF TANIMA</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {/* Camera Mode Toggles */}
                <button
                  onClick={() => setCameraMode('optical')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${cameraMode === 'optical' ? 'bg-cyan-600 text-white' : 'bg-[#111f36] text-slate-400'}`}
                >
                  OPTİK
                </button>
                <button
                  onClick={() => setCameraMode('flir')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${cameraMode === 'flir' ? 'bg-green-600 text-white' : 'bg-[#111f36] text-slate-400'}`}
                >
                  TERMAL FLIR
                </button>
                <button
                  onClick={() => setCameraMode('starlight')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${cameraMode === 'starlight' ? 'bg-emerald-700 text-white' : 'bg-[#111f36] text-slate-400'}`}
                >
                  STARLIGHT
                </button>
              </div>
            </div>

            {/* FPV Canvas */}
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-[#1b3152] flex items-center justify-center bg-[#060a12]">
              <canvas
                ref={hudCanvasRef}
                width={560}
                height={560}
                className="w-full h-full"
              />

              {/* Zoom Buttons overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {[1.0, 2.0, 4.0].map(z => (
                  <button
                    key={z}
                    onClick={() => setZoomLevel(z)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      zoomLevel === z ? 'bg-cyan-600 text-white' : 'bg-[#111f36]/80 text-slate-400'
                    }`}
                  >
                    {z.toFixed(1)}X
                  </button>
                ))}
              </div>

              {/* Success Banner on Impact */}
              {impactHappened && (
                <div className="absolute inset-0 bg-red-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 flex items-center justify-center mb-3 animate-pulse">
                    <Flame className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white tracking-wide mb-1 font-mono">
                    💥 HEDEF TAM İSABETLE İMHA EDİLDİ!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mb-4">
                    Oransal seyrüsefer ve görüntü işleme algoritmaları başarıyla angaje oldu.
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono transition-colors shadow-lg"
                  >
                    YENİDEN BAŞLAT / SIFIRLA
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM TACTICAL CONTROL BAR */}
        <div className="bg-[#0d1626] border border-[#1b3152] rounded-xl p-4 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b3152]/70">
            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Play / Pause */}
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
                  isRunning
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md'
                }`}
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isRunning ? 'DURDUR' : 'BAŞLAT'}</span>
              </button>

              {/* Arm / Disarm */}
              <button
                onClick={() => setIsArmed(!isArmed)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                  isArmed
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50'
                    : 'bg-[#111f36] border border-[#1b3152] text-slate-300 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>{isArmed ? '💥 MANDAL AÇIK (ARMED)' : '🔒 EMNİYETLİ (SAFE)'}</span>
              </button>

              {/* Submersible Dive Mode (-1.8m) */}
              <button
                onClick={() => setIsSubmerged(!isSubmerged)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
                  isSubmerged
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-[#111f36] border border-[#1b3152] text-slate-300 hover:text-sky-300'
                }`}
              >
                <Anchor className="w-4 h-4" />
                <span>{isSubmerged ? '🤿 YARI-BATARLI (-1.8m)' : 'SU ÜSTÜ (0.0m)'}</span>
              </button>

              {/* Swarm Wolfpack 3x */}
              <button
                onClick={() => setIsSwarmActive(!isSwarmActive)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
                  isSwarmActive
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-[#111f36] border border-[#1b3152] text-slate-300 hover:text-purple-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isSwarmActive ? '🐺 SÜRÜ: AKTİF (3x İDA)' : '🐺 SÜRÜ MODU'}</span>
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#111f36] border border-[#1b3152] text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>SIFIRLA</span>
            </button>
          </div>

          {/* SECOND ROW: INTERACTIVE MODES & SPEED SLIDER */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Radar Interaction Modes */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Radar Modu:</span>
              <button
                onClick={() => setInteractionMode('SELECT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  interactionMode === 'SELECT'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#111f36] text-slate-400 hover:text-white'
                }`}
              >
                🧭 Hedef Seç / Kilitlen
              </button>
              <button
                onClick={() => setInteractionMode('DRAW_ROUTE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  interactionMode === 'DRAW_ROUTE'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#111f36] text-slate-400 hover:text-white'
                }`}
              >
                📍 Rota Çiz (Waypoints)
              </button>

              <div className="flex items-center gap-1.5 bg-[#111f36] border border-[#1b3152] rounded-lg p-1">
                <button
                  onClick={() => setInteractionMode('SPAWN_TARGET')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                    interactionMode === 'SPAWN_TARGET'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🎯 Hedef Ekle:
                </button>
                <select
                  value={spawnType}
                  onChange={(e) => {
                    setSpawnType(e.target.value as TargetType);
                    setInteractionMode('SPAWN_TARGET');
                  }}
                  className="bg-[#070b14] border border-[#1b3152] rounded px-2 py-0.5 text-xs text-white font-mono"
                >
                  <option value="ENEMY_PATROL">Düşman Hücumbot</option>
                  <option value="ENEMY_CORVETTE">Düşman Korvet</option>
                  <option value="CIVILIAN_CARGO">Sivil Kargo (MSC)</option>
                  <option value="FRIENDLY_BOAT">Dost Balıkçı</option>
                </select>
              </div>
            </div>

            {/* Speed (Knot) Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">Gaz (Knot):</span>
              <input
                type="range"
                min="10"
                max="42"
                value={targetSpeedKnots}
                onChange={(e) => setTargetSpeedKnots(Number(e.target.value))}
                className="w-32 accent-cyan-400"
              />
              <span className="text-xs font-mono font-bold text-cyan-300 w-12">{targetSpeedKnots} kt</span>

              {/* Preset buttons */}
              <button
                onClick={() => setTargetSpeedKnots(15)}
                className="px-2 py-1 rounded text-[11px] font-mono bg-[#111f36] text-slate-300 hover:text-white"
              >
                15kt Eko
              </button>
              <button
                onClick={() => setTargetSpeedKnots(42)}
                className="px-2 py-1 rounded text-[11px] font-mono bg-red-950/70 text-red-300 border border-red-500/40 hover:bg-red-900"
              >
                MAX 42kt
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP APP ARCHITECTURE & TECH SPECS (FROM DESKTOP README) */}
        <div className="bg-[#0d1626] border border-[#1b3152] rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base pb-3 border-b border-[#1b3152]">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <span>Masaüstü Python / PyQt5 Taktik İstasyon Mimarisi</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
            <div className="bg-[#070b14] border border-[#1b3152] rounded-lg p-4 space-y-2">
              <div className="font-bold text-cyan-300 uppercase tracking-wide">1. Uçta Yapay Zekâ (Edge AI)</div>
              <p className="text-slate-400">
                Elektronik harp (jamming) altında radyo sessizliğinde (EMCON) harici internet veya uyduya ihtiyaç duymadan
                Orange Pi 5 NPU üzerinde YOLOv8-Nano ile çalışır.
              </p>
            </div>

            <div className="bg-[#070b14] border border-[#1b3152] rounded-lg p-4 space-y-2">
              <div className="font-bold text-cyan-300 uppercase tracking-wide">2. Yarı-Batarlı Dalış (-1.8m)</div>
              <p className="text-slate-400">
                Angajman anında balast tanklarını doldurarak suyun 1.8 metre altına dalar.
                Radar kesit alanını (RCS) sıfıra indirir ve su üstü ağır makineli mermilerinden korunur.
              </p>
            </div>

            <div className="bg-[#070b14] border border-[#1b3152] rounded-lg p-4 space-y-2">
              <div className="font-bold text-cyan-300 uppercase tracking-wide">3. Wolfpack Sürü Koordinasyonu</div>
              <p className="text-slate-400">
                Alpha lider botun etrafında -45° ve +45° kıskaç açısında formasyon alan 3'lü İDA filosu,
                hedefin savunma sistemlerini doyum noktasına ulaştırmak için çok açılı hücum gerçekleştirir.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-[#1b3152]/60">
            <div>
              Masaüstü başlatma komutu: <code className="bg-[#070b14] text-cyan-300 px-2 py-1 rounded font-mono">python main.py</code> veya <code className="bg-[#070b14] text-cyan-300 px-2 py-1 rounded font-mono">baslat.bat</code>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
            >
              <span>Başvuru Formuna Dön</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
