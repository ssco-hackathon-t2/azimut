"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { asset } from "@/lib/data";
import { extentKm, flightPose, footprintKm, latLonToVec, sectorOutline, smoothstep, starDirection, subsolarPoint, type FlightSpec, type Vec3 } from "@/lib/geo";

export interface GeoManifest {
  pad: { lat: number; lon: number; accuracy_m: number; label: string; basis: string };
  files: Record<string, { km?: number; bounds_wsen?: [number, number, number, number]; credit: string; license: string; source: string; title?: string; acquired?: string[] }>;
}

interface OsmFeature {
  properties: { kind: string; name?: string | null };
  geometry: { coordinates: [number, number][] };
}

export type Phase = "loading" | "erde" | "nordeuropa" | "nordnorwegen" | "andoya" | "pad";

export interface SceneHandle {
  skip(): void;
  replay(): void;
}

interface Props {
  geo: GeoManifest;
  osm: { features: OsmFeature[] };
  sector: { min: number; max: number };
  reducedMotion: boolean;
  durationMs?: number;
  /** Bildmitte des Ziels (0..1 der Breite); Platz für Text links. */
  focusX?: number;
  onPhase?: (p: Phase) => void;
  onProgress?: (t: number) => void;
  onArrive?: () => void;
  onFail?: (reason: string) => void;
  /** Bildschirmpositionen für HTML-Beschriftungen (Pad, Sektorende). */
  onLabels?: (l: { pad?: [number, number]; sector?: [number, number]; visible: number }) => void;
  /** Steuergriff (überspringen, wiederholen). next/dynamic reicht `ref` nicht durch, daher als Prop. */
  handle?: React.MutableRefObject<SceneHandle | null>;
  /** Überspringen wurde angefordert (auch vor dem Laden der Szene). */
  skipped?: boolean;
}

const FOV = 32;

/** Licht und Sternhimmel zum ersten Spectrum-Start: 30.03.2025, 12:30 MESZ (Andøya Space, Euronews). */
export const LIGHT_MOMENT = new Date("2025-03-30T10:30:00Z");

export const STAR_VS = /* glsl */ `
  attribute float size; attribute float bright; attribute vec3 tint;
  uniform float dpr; varying vec3 vTint; varying float vA;
  void main(){
    vTint = tint; vA = bright;
    gl_PointSize = size * dpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const STAR_FS = /* glsl */ `
  uniform float fade; varying vec3 vTint; varying float vA;
  void main(){
    vec2 d = gl_PointCoord - 0.5; float r = dot(d, d);
    float a = smoothstep(0.25, 0.0, r) * vA * fade;
    gl_FragColor = vec4(vTint * a, a);
    #include <colorspace_fragment>
  }`;

/** Sternfarbe aus dem B-V-Farbindex (grobe Näherung blau → weiß → orange). */
export function bvTint(bv: number | null): [number, number, number] {
  const t = Math.min(1, Math.max(0, ((bv ?? 0.6) + 0.3) / 1.9));
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  return t < 0.45
    ? [lerp(0.72, 1, t / 0.45), lerp(0.82, 0.98, t / 0.45), 1]
    : [1, lerp(0.98, 0.78, (t - 0.45) / 0.55), lerp(1, 0.58, (t - 0.45) / 0.55)];
}

export const GLOBE_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

export const GLOBE_FS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN);
    float ndl = dot(n, sunDir);
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    float l = dot(day, vec3(0.299,0.587,0.114));
    // Polarnacht-Grading: Tagseite gedämpft und kühl, Nachtseite mit echten Nachtlichtern.
    vec3 dayG = mix(vec3(l), day, 0.48) * vec3(0.76,0.88,1.05) * (0.14 + 0.70*max(ndl,0.0));
    vec3 nightG = pow(night, vec3(1.35)) * vec3(1.05,0.86,0.62) * 1.7 + vec3(0.006,0.012,0.028);
    float m = smoothstep(-0.12, 0.22, ndl);
    vec3 col = mix(nightG, dayG, m);
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    col += vec3(0.42,0.66,0.95) * fres * (0.10 + 0.45*smoothstep(-0.25,0.5,ndl));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export const ATMO_FS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDir; uniform float strength;
  varying vec3 vN; varying vec3 vW;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
    float rim = pow(clamp(1.0 + dot(n, v), 0.0, 1.0), 5.0);
    float lit = smoothstep(-0.35, 0.6, dot(n, sunDir));
    gl_FragColor = vec4(vec3(0.45,0.72,1.0) * rim * (0.25 + 0.9*lit) * strength, 1.0);
    #include <colorspace_fragment>
  }`;

const PATCH_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  #include <logdepthbuf_vertex>
  }`;

const PATCH_FS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map; uniform float opacity; uniform float feather;
  varying vec2 vUv;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 c = texture2D(map, vUv).rgb;
    float l = dot(c, vec3(0.299,0.587,0.114));
    // Dieselbe Abstimmung wie die Tagseite des Globus, leicht dunkler für Text darüber.
    // Polarnacht-Grading: stark entsättigt, kühl, Schwärzen zum Navy-Grund angehoben,
    // damit Globus, Region und Pad als ein Raum wirken.
    vec3 g = mix(vec3(l), c, 0.38) * vec3(0.74,0.86,1.04);
    g = pow(g, vec3(1.18)) * 0.82;
    vec3 navy = vec3(0.0036, 0.0060, 0.0144);
    g = navy + g * (1.0 - navy);
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    // Pixel ohne Daten (0,0,0) außerhalb des Sentinel-Schwads durchsichtig lassen.
    float valid = smoothstep(0.0002, 0.0012, max(max(c.r, c.g), c.b));
    float a = opacity * smoothstep(0.0, feather, e) * valid;
    gl_FragColor = vec4(g, a);
    #include <colorspace_fragment>
  }`;

/** Lokales Koordinatensystem am Punkt: Ost, Nord, Oben. */
function frame(lat: number, lon: number) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const up = new THREE.Vector3(...latLonToVec(lat, lon));
  const east = new THREE.Vector3(-Math.sin(lo), 0, -Math.cos(lo));
  const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
  return { up, east, north };
}

/** Geometrie relativ zu einem Ursprung (Präzision im Meterbereich trotz float32). */
function relative(points: Vec3[], origin: THREE.Vector3): Float32Array {
  const a = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    a[i * 3] = p[0] - origin.x;
    a[i * 3 + 1] = p[1] - origin.y;
    a[i * 3 + 2] = p[2] - origin.z;
  });
  return a;
}

function patchMesh(bounds: [number, number, number, number], tex: THREE.Texture, lift: number) {
  const [w, s, e, n] = bounds;
  const N = 40;
  const center = new THREE.Vector3(...latLonToVec((s + n) / 2, (w + e) / 2, 1 + lift));
  const pts: Vec3[] = [];
  const uvs: number[] = [];
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      pts.push(latLonToVec(s + ((n - s) * j) / N, w + ((e - w) * i) / N, 1 + lift));
      uvs.push(i / N, j / N);
    }
  const idx: number[] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(relative(pts, center), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: PATCH_VS,
    fragmentShader: PATCH_FS,
    uniforms: { map: { value: tex }, opacity: { value: 0 }, feather: { value: 0.08 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.copy(center);
  mesh.frustumCulled = false;
  return mesh;
}

function lineObject(coords: [number, number][], origin: THREE.Vector3, color: string, opacity: number, lift = 2e-8) {
  const pts = coords.map(([lon, lat]) => latLonToVec(lat, lon, 1 + lift));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(relative(pts, origin), 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
  const l = new THREE.Line(g, m);
  l.position.copy(origin);
  l.frustumCulled = false;
  l.userData.baseOpacity = opacity;
  return l;
}

export function OrbitScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<{ skip: () => void; replay: () => void } | null>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    if (!props.handle) return;
    props.handle.current = { skip: () => ctl.current?.skip(), replay: () => ctl.current?.replay() };
    const h = props.handle;
    return () => {
      h.current = null;
    };
  }, [props.handle]);

  useEffect(() => {
    if (props.skipped) ctl.current?.skip();
  }, [props.skipped]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { geo, osm, sector } = cb.current;
    const probe = document.createElement("canvas");
    const probeCtx = probe.getContext("webgl2");
    // Prüfkontext sofort freigeben, sonst sammeln sich Kontexte bei wiederholten Besuchen.
    probeCtx?.getExtension("WEBGL_lose_context")?.loseContext();
    if (!probeCtx) {
      cb.current.onFail?.("WebGL2 nicht verfügbar");
      return;
    }
    let disposed = false;

    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    } catch {
      cb.current.onFail?.("WebGL konnte nicht gestartet werden");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1e-6, 10);
    const sunDir = new THREE.Vector3(...latLonToVec(...subsolarPoint(LIGHT_MOMENT))).normalize();
    renderer.autoClear = false;
    // Sternhimmel als eigene Szene mit Kamera im Ursprung: keine Parallaxe, nie vom Fernpunkt abgeschnitten.
    const sky = new THREE.Scene();
    const skyCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: { dpr: { value: renderer.getPixelRatio() }, fade: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    fetch(asset("geo/stars_bsc5.json"))
      .then((r) => (r.ok ? (r.json() as Promise<[number, number, number, number | null][]>) : []))
      .then((rows) => {
        if (disposed || !rows.length) return;
        const pos = new Float32Array(rows.length * 3);
        const size = new Float32Array(rows.length);
        const bright = new Float32Array(rows.length);
        const tint = new Float32Array(rows.length * 3);
        rows.forEach(([ra, dec, v, bv], i) => {
          const d = starDirection(ra, dec, LIGHT_MOMENT);
          pos.set([d[0] * 100, d[1] * 100, d[2] * 100], i * 3);
          // Größe und Helligkeit nach V-Magnitude; schwache Sterne bleiben sichtbar, aber zurückhaltend.
          size[i] = Math.min(5, Math.max(1.5, 4.6 - 0.5 * v));
          bright[i] = Math.min(1, Math.max(0.38, 1.05 - 0.11 * v));
          tint.set(bvTint(bv), i * 3);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("size", new THREE.BufferAttribute(size, 1));
        g.setAttribute("bright", new THREE.BufferAttribute(bright, 1));
        g.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
        const pts = new THREE.Points(g, starMat);
        pts.frustumCulled = false;
        sky.add(pts);
        if (ready) draw();
      })
      .catch(() => undefined);
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const load = (name: string) => {
      const t = loader.load(asset(`geo/${name}`));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, maxAniso);
      return t;
    };

    // Globus
    // SphereGeometry: u=0 liegt bei (−1,0,0) = Länge ±180°, u=0,25 bei Länge −90°; das entspricht latLonToVec
    // und der equirectangularen NASA-Karte ohne Drehung.
    const globeGeo = new THREE.SphereGeometry(1, 160, 96);
    const globeMat = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VS,
      fragmentShader: GLOBE_FS,
      uniforms: { dayMap: { value: load("globe_day.jpg") }, nightMap: { value: load("globe_night.jpg") }, sunDir: { value: sunDir } },
    });
    scene.add(new THREE.Mesh(globeGeo, globeMat));
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VS,
      fragmentShader: ATMO_FS,
      uniforms: { sunDir: { value: sunDir }, strength: { value: 1 } },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.028, 96, 64), atmoMat);
    scene.add(atmo);

    // Detailstufen (Sentinel-2), grob nach fein
    const lods = Object.entries(geo.files)
      .filter(([, f]) => f.km && f.bounds_wsen)
      .sort((a, b) => (b[1].km ?? 0) - (a[1].km ?? 0))
      .map(([name, f], i) => {
        const mesh = patchMesh(f.bounds_wsen!, load(name), 1e-7 * (i + 1));
        mesh.renderOrder = 10 + i;
        scene.add(mesh);
        return { km: f.km!, mesh };
      });

    // OSM-Geometrie und Startsektor am Pad
    const pad = frame(geo.pad.lat, geo.pad.lon);
    const padOrigin = pad.up.clone();
    const overlay = new THREE.Group();
    overlay.renderOrder = 100;
    const style: Record<string, [string, number]> = {
      coastline: ["#8fd3ff", 0.55],
      road: ["#a9b4c4", 0.42],
      building: ["#e9edf2", 0.5],
      tank: ["#e9edf2", 0.6],
      fence: ["#8794a8", 0.3],
      water: ["#8fd3ff", 0.3],
      launchpad: ["#8fd3ff", 1],
    };
    for (const f of osm.features) {
      const s = style[f.properties.kind];
      if (!s) continue;
      if (f.properties.kind === "coastline" && extentKm(f.geometry.coordinates) < 0.25) continue;
      const l = lineObject(f.geometry.coordinates, padOrigin, s[0], s[1]);
      l.renderOrder = f.properties.kind === "launchpad" ? 102 : 101;
      overlay.add(l);
    }
    const sectorRadiusKm = 2.6;
    const sectorPts = sectorOutline(geo.pad.lat, geo.pad.lon, sector.min, sector.max, sectorRadiusKm, 64).map(([la, lo]) => [lo, la] as [number, number]);
    const sectorLine = lineObject(sectorPts, padOrigin, "#7ee0b5", 0.85, 3e-8);
    sectorLine.renderOrder = 103;
    overlay.add(sectorLine);
    // Fächerfläche, sehr zart
    {
      const fan = sectorPts.map(([lo, la]) => latLonToVec(la, lo, 1 + 2.5e-8));
      const pos: number[] = [];
      for (let i = 1; i < fan.length - 2; i++) pos.push(...fan[0], ...fan[i], ...fan[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(relative(chunk(pos), padOrigin), 3));
      const m = new THREE.MeshBasicMaterial({ color: "#7ee0b5", transparent: true, opacity: 0.07, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(padOrigin);
      mesh.renderOrder = 99;
      mesh.userData.baseOpacity = 0.07;
      mesh.frustumCulled = false;
      overlay.add(mesh);
    }
    scene.add(overlay);
    const sectorMid = sectorOutline(geo.pad.lat, geo.pad.lon, sector.min, sector.max, sectorRadiusKm * 1.08, 2)[2];
    const sectorLabelVec = new THREE.Vector3(...latLonToVec(sectorMid[0], sectorMid[1]));

    // Kamerafahrt
    const spec: FlightSpec = {
      start: { lat: 36, lon: -30, alt: 3.4 },
      // Endeinstellung: etwa 7 km Bodenbreite am Desktop, damit Pad und ganzer Sektor im Bild liegen.
      target: { lat: geo.pad.lat, lon: geo.pad.lon, alt: isSmall ? 0.0034 : 0.00125, tilt: 38, heading: 322 },
    };
    const duration = cb.current.durationMs ?? 9500;
    let start = -1;
    let t = 0;
    let arrived = false;
    let ready = false;
    let visible = true;
    let raf = 0;
    let lastPhase: Phase = "loading";
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

    const setPhase = (p: Phase) => {
      if (p !== lastPhase) {
        lastPhase = p;
        cb.current.onPhase?.(p);
      }
    };

    const size = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      const fx = isSmall ? 0.5 : cb.current.focusX ?? 0.5;
      // Zielpunkt nach rechts verschieben, ohne die Perspektive zu verzerren.
      camera.setViewOffset(w, h, (0.5 - fx) * w, 0, w, h);
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(() => {
      size();
      draw();
    });
    ro.observe(el);

    const place = () => {
      const p = flightPose(spec, t);
      const f = frame(p.lat, p.lon);
      const tilt = ((p.tilt + parallax.y * 3) * Math.PI) / 180;
      const hd = ((p.heading + parallax.x * 6) * Math.PI) / 180;
      const dirH = f.north.clone().multiplyScalar(Math.cos(hd)).add(f.east.clone().multiplyScalar(Math.sin(hd)));
      const target = f.up.clone();
      const pos = target
        .clone()
        .add(f.up.clone().multiplyScalar(p.alt * Math.cos(tilt)))
        .add(dirH.clone().multiplyScalar(-p.alt * Math.sin(tilt)));
      camera.position.copy(pos);
      const k = smoothstep(0, 12, p.tilt);
      camera.up.copy(f.north.clone().multiplyScalar(1 - k).add(f.up.clone().multiplyScalar(k)).normalize());
      camera.lookAt(target);
      camera.near = Math.max(p.alt * 0.02, 1e-7);
      camera.far = p.alt + 2.5;
      camera.updateProjectionMatrix();

      const fp = footprintKm(p.alt, FOV, camera.aspect);
      for (const lod of lods) {
        const o = smoothstep(lod.km * 9, lod.km * 2.4, fp);
        (lod.mesh.material as THREE.ShaderMaterial).uniforms.opacity.value = o;
        lod.mesh.visible = o > 0.001;
      }
      atmoMat.uniforms.strength.value = smoothstep(0.004, 0.08, p.alt);
      starMat.uniforms.fade.value = smoothstep(0.03, 0.5, p.alt);
      const ov = smoothstep(22, 10, fp);
      overlay.visible = ov > 0.001;
      overlay.children.forEach((c) => {
        const m = (c as THREE.Line).material as THREE.Material & { opacity: number };
        m.opacity = (c.userData.baseOpacity ?? 1) * ov;
      });
      setPhase(fp > 4200 ? "erde" : fp > 900 ? "nordeuropa" : fp > 110 ? "nordnorwegen" : fp > 14 ? "andoya" : "pad");

      // Bildschirmpositionen für HTML-Beschriftungen
      if (cb.current.onLabels) {
        const proj = (v: THREE.Vector3): [number, number] => {
          const q = v.clone().project(camera);
          return [((q.x + 1) / 2) * el.clientWidth, ((1 - q.y) / 2) * el.clientHeight];
        };
        cb.current.onLabels({ pad: proj(padOrigin), sector: proj(sectorLabelVec), visible: ov });
      }
    };

    const draw = () => {
      place();
      renderer.clear();
      skyCam.copy(camera);
      skyCam.position.set(0, 0, 0);
      skyCam.near = 0.1;
      skyCam.far = 1000;
      skyCam.updateProjectionMatrix();
      renderer.render(sky, skyCam);
      renderer.render(scene, camera);
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed || !visible || !ready) return;
      if (!arrived) {
        if (start < 0) start = now;
        t = Math.min(1, (now - start) / duration);
        cb.current.onProgress?.(t);
        if (t >= 1) {
          arrived = true;
          cb.current.onArrive?.();
        }
      }
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      draw();
      const moving = !arrived || Math.abs(parallax.tx - parallax.x) > 1e-4 || Math.abs(parallax.ty - parallax.y) > 1e-4;
      if (moving) raf = requestAnimationFrame(loop);
    };
    let paused = true;
    const kick = () => {
      if (disposed || raf || !visible || !ready) return;
      // Nach einer Pause (verdeckt, gescrollt) dort weiterfahren, wo die Fahrt stand, statt zu springen.
      if (paused && !arrived && start >= 0) start = performance.now() - t * duration;
      paused = false;
      raf = requestAnimationFrame(loop);
    };

    manager.onLoad = () => {
      if (disposed) return;
      ready = true;
      if (cb.current.reducedMotion) {
        t = 1;
        arrived = true;
        cb.current.onProgress?.(1);
        cb.current.onArrive?.();
        draw();
      } else kick();
    };
    manager.onError = (url) => {
      if (!disposed) cb.current.onFail?.(`Kartendatei fehlt: ${url.split("/").pop()}`);
    };

    const onMove = (e: PointerEvent) => {
      if (!arrived || cb.current.reducedMotion || e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      parallax.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      parallax.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let intersecting = true;
    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      visible = intersecting && document.visibilityState === "visible";
      if (visible) kick();
      else paused = true;
    });
    io.observe(el);
    const onVis = () => {
      visible = intersecting && document.visibilityState === "visible";
      if (visible) kick();
      else paused = true;
    };
    document.addEventListener("visibilitychange", onVis);

    ctl.current = {
      skip: () => {
        t = 1;
        if (!arrived) {
          arrived = true;
          cb.current.onProgress?.(1);
          cb.current.onArrive?.();
        }
        if (ready) draw();
      },
      replay: () => {
        if (cb.current.reducedMotion) return;
        arrived = false;
        start = -1;
        t = 0;
        kick();
      },
    };

    if (cb.current.skipped) ctl.current.skip();
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      [scene, sky].forEach((sc) => sc.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values((x as THREE.ShaderMaterial).uniforms ?? {}).forEach((u) => (u.value as THREE.Texture)?.dispose?.());
          x.dispose();
        });
      }));
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      ctl.current = null;
    };
  }, []);

  return <div ref={host} className="absolute inset-0" />;
}

function chunk(flat: number[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]);
  return out;
}
