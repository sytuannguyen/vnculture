import { useEffect, useRef } from "react";

// A night sky over Hội An. Every lantern the community lights rises from the river
// and settles in the sky; learned Vietnamese words drift like constellations.

type Area = [number, number, number, number]; // x0, y0, x1, y1 as fractions of the canvas
interface Props { lanterns: number; words?: { w: string; n: number }[]; dim?: boolean; onLaunch?: () => void; area?: Area }

const rand = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const HUES = ["#FF5A3C", "#FF8A3D", "#FFB547", "#F25670", "#FF6F61", "#FFC861"];
const MAX = 700;

interface Flying { i: number; t0: number; x0: number; launched?: boolean }

export function LanternSky({ lanterns, words = [], dim = false, onLaunch, area = [0.03, 0.08, 0.97, 0.7] }: Props) {
  const areaRef = useRef<Area>(area);
  areaRef.current = area;
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = useRef<number | null>(null);
  const flying = useRef<Flying[]>([]);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const launchRef = useRef(onLaunch);
  launchRef.current = onLaunch;

  useEffect(() => {
    if (shown.current === null) { shown.current = lanterns; return; }
    const from = shown.current;
    if (lanterns > from) {
      const n = Math.min(lanterns - from, 40);
      for (let k = 0; k < n; k++) {
        const i = lanterns - n + k;
        flying.current.push({ i, t0: performance.now() + k * 180, x0: 0.15 + rand(i * 3.3) * 0.7 });
      }
    }
    shown.current = lanterns;
  }, [lanterns]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, W = 0, H = 0, dpr = 1;
    const stars = Array.from({ length: 160 }, (_, i) => ({ x: rand(i + 0.1), y: rand(i + 0.7) * 0.75, r: 0.4 + rand(i + 0.3) * 1.3, p: rand(i + 0.9) * 6 }));
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const rest = (i: number) => {
      // scatter naturally inside the free sky area of the current screen
      const [x0, y0, x1, y1] = areaRef.current;
      return { x: x0 + rand(i * 1.7 + 0.31) * (x1 - x0), y: y0 + rand(i * 2.9 + 1.13) * (y1 - y0) };
    };

    const lantern = (x: number, y: number, s: number, color: string, glow: number, sway: number) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(sway);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3.2);
      g.addColorStop(0, `rgba(255,190,90,${0.35 * glow})`); g.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 3.2, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createLinearGradient(0, -s, 0, s);
      body.addColorStop(0, "#FFE29A"); body.addColorStop(0.35, color); body.addColorStop(1, "#B3261E");
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.78, s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5A1A0A";
      ctx.fillRect(-s * 0.42, -s * 1.08, s * 0.84, s * 0.2);
      ctx.fillRect(-s * 0.42, s * 0.9, s * 0.84, s * 0.2);
      ctx.strokeStyle = "rgba(255,230,160,.35)"; ctx.lineWidth = Math.max(0.6, s * 0.08);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.95, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const skyline = (t: number) => {
      const base = H * 0.86;
      ctx.fillStyle = "#0B0820";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, base);
      // Hội An rooftops: low houses with curved tiled roofs, a pagoda
      const step = W / 16;
      for (let k = 0; k < 16; k++) {
        const x = k * step, h = 26 + rand(k + 40) * 36;
        if (k === 9) { // Japanese covered bridge / pagoda
          ctx.lineTo(x, base - 40); ctx.quadraticCurveTo(x + step * 0.5, base - 95, x + step, base - 40);
          continue;
        }
        ctx.lineTo(x + step * 0.08, base - h);
        ctx.quadraticCurveTo(x + step * 0.5, base - h - 22, x + step * 0.92, base - h);
        ctx.lineTo(x + step, base - h * 0.6);
      }
      ctx.lineTo(W, base); ctx.lineTo(W, H); ctx.fill();
      // windows
      for (let k = 0; k < 16; k++) {
        if (rand(k + 90) > 0.55) continue;
        const x = k * step + step * 0.4;
        ctx.fillStyle = `rgba(255,190,90,${0.5 + 0.3 * Math.sin(t / 900 + k)})`;
        ctx.fillRect(x, base - 14, 7, 9);
      }
      // river
      const rg = ctx.createLinearGradient(0, base, 0, H);
      rg.addColorStop(0, "#1A1240"); rg.addColorStop(1, "#07051A");
      ctx.fillStyle = rg; ctx.fillRect(0, base + 4, W, H - base);
      for (let k = 0; k < 26; k++) {
        const y = base + 12 + rand(k + 7) * (H - base - 14);
        const x = ((rand(k + 3) * W + t * 0.012 * (1 + rand(k))) % (W + 80)) - 40;
        ctx.fillStyle = `rgba(255,170,80,${0.12 + 0.1 * Math.sin(t / 600 + k)})`;
        ctx.fillRect(x, y, 26 + rand(k) * 40, 2);
      }
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0E0B2A"); sky.addColorStop(0.55, "#2B1D4F"); sky.addColorStop(0.85, "#5A2E57");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t / 700 + s.p)})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill(); }
      // moon
      const mx = W * (areaRef.current[2] - 0.07), my = H * 0.13, mr = Math.min(W, H) * 0.045;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 4);
      mg.addColorStop(0, "rgba(255,240,200,.35)"); mg.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF3D0"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

      // drifting words
      const ws = wordsRef.current.slice(0, 28);
      const maxN = Math.max(1, ...ws.map((w) => w.n));
      ws.forEach((w, k) => {
        const size = 15 + (w.n / maxN) * 26;
        const x = ((rand(k + 200) * W + t * 0.008 * (0.5 + rand(k + 1))) % (W + 300)) - 150;
        const y = H * (0.1 + rand(k + 300) * 0.6);
        ctx.font = `700 ${size}px "Be Vietnam Pro", system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255,236,190,${0.18 + 0.25 * (w.n / maxN)})`;
        ctx.fillText(w.w, x, y);
      });

      const settled = (shown.current ?? 0);
      const flyingSet = new Set(flying.current.map((f) => f.i));
      const scale = Math.max(5, Math.min(13, W / 130) - settled / 70);
      const count = Math.min(settled, MAX);
      for (let i = 0; i < count; i++) {
        if (flyingSet.has(i)) continue;
        const p = rest(i);
        const bob = Math.sin(t / 1300 + i) * 3;
        lantern(p.x * W, p.y * H + bob, scale * (0.75 + rand(i + 9) * 0.45), HUES[i % HUES.length], 0.7 + 0.3 * Math.sin(t / 500 + i * 2), Math.sin(t / 1600 + i) * 0.08);
      }
      skyline(t);
      // flying lanterns rise from the river
      flying.current = flying.current.filter((f) => {
        const k = (t - f.t0) / 4200;
        if (k < 0) return true;
        if (k >= 1) return false;
        if (!f.launched) { f.launched = true; launchRef.current?.(); }
        const e = 1 - Math.pow(1 - k, 3);
        const p = rest(Math.min(f.i, MAX - 1));
        const x = (f.x0 + (p.x - f.x0) * e) * W + Math.sin(k * 9 + f.i) * 18 * (1 - k);
        const y = (0.92 + (p.y - 0.92) * e) * H;
        lantern(x, y, scale * (1.8 - 0.8 * e), HUES[f.i % HUES.length], 1.4, Math.sin(k * 12) * 0.15);
        return true;
      });
      if (dim) { ctx.fillStyle = "rgba(10,8,30,.35)"; ctx.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dim]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
