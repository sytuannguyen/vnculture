// Generates the app logo (a glowing Hội An silk lantern under a night sky, with an AI
// sparkle) as SVG and renders the PNG sizes needed for favicons, iOS and Android.
// Usage: npx tsx scripts/gen-icons.ts   (needs Playwright's Chromium: npx playwright install chromium)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve("public/icons");

/** variant: "rounded" (favicon / generic), "full" (iOS, opaque square), "maskable" (Android, safe zone). */
export function logoSvg(variant: "rounded" | "full" | "maskable"): string {
  const scale = variant === "maskable" ? 0.78 : 1;
  const bg = variant === "rounded"
    ? `<rect width="512" height="512" rx="112" fill="url(#sky)"/>`
    : `<rect width="512" height="512" fill="url(#sky)"/>`;
  const stars = [[92, 96, 3], [430, 70, 2.5], [462, 210, 2], [62, 260, 2], [440, 420, 2.5], [78, 430, 3], [150, 40, 2]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF3D6" opacity=".7"/>`).join("");
  const sparkle = (x: number, y: number, s: number, o = 1) =>
    `<path transform="translate(${x} ${y}) scale(${s})" opacity="${o}" fill="url(#gold)" d="M0-20C2-6 6-2 20 0C6 2 2 6 0 20C-2 6-6 2-20 0C-6-2-2-6 0-20Z"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E2266"/><stop offset="1" stop-color="#120E2E"/></linearGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFB547" stop-opacity=".55"/><stop offset=".55" stop-color="#FF7A3D" stop-opacity=".16"/><stop offset="1" stop-color="#FF7A3D" stop-opacity="0"/></radialGradient>
  <radialGradient id="silk" cx=".5" cy=".46" r=".62"><stop offset="0" stop-color="#FFE29A"/><stop offset=".28" stop-color="#FF9A3D"/><stop offset=".62" stop-color="#E5262F"/><stop offset="1" stop-color="#8E0B22"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#E0A124"/></linearGradient>
  <linearGradient id="cap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B9790E"/><stop offset=".45" stop-color="#FFD96B"/><stop offset="1" stop-color="#B9790E"/></linearGradient>
</defs>
${bg}
${stars}
<g transform="translate(256 262) scale(${scale}) translate(-256 -262)">
  <circle cx="256" cy="258" r="210" fill="url(#halo)"/>
  <path d="M256 52V112" stroke="#E8B54A" stroke-width="5" stroke-linecap="round"/>
  <rect x="200" y="108" width="112" height="28" rx="10" fill="url(#cap)"/>
  <path d="M208 134C120 170 120 342 208 378H304C392 342 392 170 304 134Z" fill="url(#silk)"/>
  <g fill="none" stroke="#8E0B22" stroke-opacity=".35" stroke-width="4">
    <path d="M226 136C176 180 176 332 226 376"/><path d="M286 136C336 180 336 332 286 376"/><path d="M256 136V376"/>
  </g>
  <path d="M186 172C160 206 156 262 170 304" fill="none" stroke="#FFF1C9" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"/>
  <rect x="200" y="376" width="112" height="28" rx="10" fill="url(#cap)"/>
  <circle cx="256" cy="414" r="9" fill="#E8B54A"/>
  <path d="M244 420H268L278 470Q256 478 234 470Z" fill="#D7192F"/>
  <path d="M250 422V468M256 422V472M262 422V468" stroke="#8E0B22" stroke-opacity=".45" stroke-width="2"/>
${sparkle(392, 128, 1.9)}${sparkle(124, 168, 0.9, 0.85)}
</g>
</svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const variants = { rounded: logoSvg("rounded"), full: logoSvg("full"), maskable: logoSvg("maskable") };
  writeFileSync(path.join(OUT, "icon.svg"), variants.rounded);
  const targets: [keyof typeof variants, number, string][] = [
    ["rounded", 192, "icon-192.png"], ["rounded", 512, "icon-512.png"], ["rounded", 32, "favicon-32.png"],
    ["maskable", 512, "icon-maskable-512.png"], ["full", 180, "apple-touch-icon.png"],
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [v, size, file] of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${variants[v].replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
    await page.locator("svg").screenshot({ path: path.join(OUT, file), omitBackground: true });
    console.log("wrote", file);
  }
  await browser.close();
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "gen-icons.ts"))) void main();
