"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { asset } from "@/lib/data";
import { latLonToVec, starDirection, subsolarPoint } from "@/lib/geo";
import { ATMO_FS, bvTint, GLOBE_FS, GLOBE_VS, LIGHT_MOMENT, STAR_FS, STAR_VS } from "@/components/scene/OrbitScene";

/** Kamera über einem Punkt der Erde; dist in Erdradien vom Erdmittelpunkt. */
export interface View {
  lat: number;
  lon: number;
  dist: number;
}

export interface Pin {
  id: string;
  lat: number;
  lon: number;
}

/** Lage eines Punkts im Globus-Kasten (px), Winkel radial nach außen (Grad, 0 = oben), front = vor dem Horizont. */
export interface PinPos {
  x: number;
  y: number;
  rot: number;
  front: boolean;
}

interface Props {
  /** Ziel der Kamera; ein neues Objekt startet eine neue Fahrt. */
  view: View;
  /** Startansicht für die Einflug-Drehung beim ersten Bild. */
  from?: View;
  pins?: Pin[];
  onPins?: (p: Record<string, PinPos>) => void;
  /** Ziehen zum Drehen; meldet die neue Ansicht. */
  onDrag?: (v: View) => void;
  onFail?: (reason: string) => void;
}

const FOV = 32;
// Zeitkonstante der Kamerafahrt (s): nach rund 3 τ angekommen.
const TAU = 0.32;

/**
 * Drehbarer Globus aus denselben Shadern und Karten wie die OrbitScene (Tag/Nacht, Atmosphäre, Sternhimmel).
 * Beschriftungen und Raketen liegen als HTML darüber; dafür meldet der Globus die Bildschirmlage der Pins.
 */
export function Globe(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(props);
  cb.current = props;
  const ctl = useRef<{ goTo: (v: View) => void; refresh: () => void } | null>(null);

  // Performance: WebGL-Kontext erst anlegen, wenn der Globus bis auf einen Bildschirm herangescrollt ist.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => ctl.current?.goTo(props.view), [props.view]);
  useEffect(() => ctl.current?.refresh(), [props.pins]);

  useEffect(() => {
    const el = host.current;
    if (!el || !near) return;
    const probe = document.createElement("canvas").getContext("webgl2");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    if (!probe) {
      cb.current.onFail?.("WebGL2 not available");
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    } catch {
      cb.current.onFail?.("WebGL could not be started");
      return;
    }
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.001, 10);
    const sky = new THREE.Scene();
    const skyCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
    const sunDir = new THREE.Vector3(...latLonToVec(...subsolarPoint(LIGHT_MOMENT))).normalize();

    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: { dpr: { value: renderer.getPixelRatio() }, fade: { value: 0.8 } },
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
        kick();
      })
      .catch(() => undefined);

    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    const load = (name: string) => {
      const t = loader.load(asset(`geo/${name}`));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return t;
    };
    const globeMat = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VS,
      fragmentShader: GLOBE_FS,
      uniforms: { dayMap: { value: load("globe_day.jpg") }, nightMap: { value: load("globe_night.jpg") }, sunDir: { value: sunDir } },
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), globeMat));
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.028, 96, 64),
        new THREE.ShaderMaterial({
          vertexShader: GLOBE_VS,
          fragmentShader: ATMO_FS,
          uniforms: { sunDir: { value: sunDir }, strength: { value: 1 } },
          side: THREE.BackSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    const target: View = { ...cb.current.view };
    const cur: View = { ...(reduced ? target : cb.current.from ?? target) };
    let ready = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let drag: { x: number; y: number; lat: number; lon: number } | null = null;

    const size = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Vor dem ersten Layout ist der Kasten 0 px groß: sonst NaN im Seitenverhältnis und in den Pin-Lagen.
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const v3 = new THREE.Vector3();
    const v3b = new THREE.Vector3();
    const draw = () => {
      camera.position.set(...latLonToVec(cur.lat, cur.lon, cur.dist));
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.near = Math.max(cur.dist - 1.05, 0.0005);
      camera.far = cur.dist + 1.2;
      camera.updateProjectionMatrix();
      renderer.clear();
      skyCam.copy(camera);
      skyCam.position.set(0, 0, 0);
      skyCam.near = 0.1;
      skyCam.far = 1000;
      skyCam.updateProjectionMatrix();
      renderer.render(sky, skyCam);
      renderer.render(scene, camera);

      const pins = cb.current.pins;
      if (!pins?.length || !cb.current.onPins) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const out: Record<string, PinPos> = {};
      for (const p of pins) {
        v3.set(...latLonToVec(p.lat, p.lon));
        // Auf der Einheitskugel liegt ein Punkt vor dem Horizont, wenn v · Kamera > 1.
        const front = v3.dot(camera.position) > 1;
        v3b.copy(v3).multiplyScalar(1.15).project(camera);
        v3.project(camera);
        out[p.id] = {
          x: ((v3.x + 1) / 2) * w,
          y: ((1 - v3.y) / 2) * h,
          rot: (Math.atan2((v3b.x - v3.x) * w, (v3b.y - v3.y) * h) * 180) / Math.PI,
          front,
        };
      }
      cb.current.onPins(out);
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed || !visible || !ready) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const k = reduced ? 1 : 1 - Math.exp(-dt / TAU);
      const dLon = ((((target.lon - cur.lon) % 360) + 540) % 360) - 180;
      cur.lon += dLon * k;
      cur.lat += (target.lat - cur.lat) * k;
      cur.dist += (target.dist - cur.dist) * k;
      draw();
      const moving = Math.abs(dLon) > 0.02 || Math.abs(target.lat - cur.lat) > 0.02 || Math.abs(target.dist - cur.dist) > 1e-4;
      if (moving || drag) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    const kick = () => {
      if (!raf && !disposed && visible && ready) raf = requestAnimationFrame(loop);
    };

    manager.onLoad = () => {
      if (disposed) return;
      ready = true;
      kick();
    };
    manager.onError = (url) => {
      if (!disposed) cb.current.onFail?.(`Map file missing: ${url.split("/").pop()}`);
    };

    // Ziehen: Erdoberfläche folgt dem Zeiger (Grad je Pixel aus dem sichtbaren Globusradius).
    const degPerPx = () => {
      const r = (Math.tan(Math.asin(1 / cur.dist)) / Math.tan(((FOV / 2) * Math.PI) / 180)) * (el.clientHeight / 2);
      return (180 / Math.PI) / Math.max(r, 1);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, lat: target.lat, lon: target.lon };
      el.setPointerCapture(e.pointerId);
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const s = degPerPx();
      target.lon = drag.lon - (e.clientX - drag.x) * s;
      target.lat = Math.max(-70, Math.min(80, drag.lat + (e.clientY - drag.y) * s));
      cur.lon = target.lon;
      cur.lat = target.lat;
      cb.current.onDrag?.({ ...target });
      kick();
    };
    const onUp = () => {
      drag = null;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    size();
    const ro = new ResizeObserver(() => {
      size();
      if (ready) draw();
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(el);

    ctl.current = {
      goTo: (v) => {
        Object.assign(target, v);
        if (reduced) Object.assign(cur, v);
        kick();
      },
      refresh: () => {
        if (ready) draw();
      },
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      [scene, sky].forEach((sc) =>
        sc.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | undefined;
          Object.values((mat as THREE.ShaderMaterial | undefined)?.uniforms ?? {}).forEach((u) => (u.value as THREE.Texture)?.dispose?.());
          mat?.dispose();
        }),
      );
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      ctl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  return <div ref={host} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" />;
}
