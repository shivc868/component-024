import "./style.css";
import * as THREE from "three";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Mobile browsers fire resize when the address bar collapses/expands;
// without this ScrollTrigger recalculates mid-scroll and the scrub jumps.
ScrollTrigger.config({ ignoreMobileResize: true });

const lenis = new Lenis({
  duration: 1.2,
  smoothWheel: true,
});

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ============================================================
// Config — the final look of the light scene.
// ============================================================

const config = {
  // light
  horizon: 0.42,
  intensity: 1.35,
  spreadMax: 0.92,
  coreGlow: 1.25,
  // motion
  flowSpeed: 0.5,
  waveAmount: 0.22,
  breath: 0.06,
  // color — violet aurora: deep indigo plume, orchid ribbons,
  // pink rim at the source, sky-blue trailing edge
  colorfulness: 0.9,
  colWhite: "#f2efff",
  colOrange: "#8b5cf6",
  colRed: "#4c1d95",
  colCyan: "#38bdf8",
  colMagenta: "#f0abfc",
  colGold: "#ff7ad9",
  // mouse
  parallax: 1.6,
  mouseGlow: 0.3,
  mouseGlowSize: 0.2,
  mouseBend: 0.47,
};

// ============================================================
// Three.js background — light born on the horizon line.
// Left: almost dark. Toward center: brighter, more color.
// Far right: the light flares open above and below.
// ============================================================

const canvas = document.querySelector(".scene__canvas");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2(0, 0) }, // -0.5..0.5, eased (parallax)
  uMouseUV: { value: new THREE.Vector2(0.63, 0.37) }, // cursor in uv space, eased
  uReveal: { value: 1 },

  uHorizon: { value: config.horizon },
  uIntensity: { value: config.intensity },
  uSpreadMax: { value: config.spreadMax },
  uCoreGlow: { value: config.coreGlow },
  uFlowSpeed: { value: config.flowSpeed },
  uWaveAmount: { value: config.waveAmount },
  uBreath: { value: config.breath },
  uColorfulness: { value: config.colorfulness },
  uColWhite: { value: new THREE.Color(config.colWhite) },
  uColOrange: { value: new THREE.Color(config.colOrange) },
  uColRed: { value: new THREE.Color(config.colRed) },
  uColCyan: { value: new THREE.Color(config.colCyan) },
  uColMagenta: { value: new THREE.Color(config.colMagenta) },
  uColGold: { value: new THREE.Color(config.colGold) },
  uParallax: { value: config.parallax },
  uMouseGlow: { value: config.mouseGlow },
  uMouseGlowSize: { value: config.mouseGlowSize },
  uMouseBend: { value: config.mouseBend },
};

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform vec2  uMouseUV;
  uniform float uReveal;

  uniform float uHorizon;
  uniform float uIntensity;
  uniform float uSpreadMax;
  uniform float uCoreGlow;
  uniform float uFlowSpeed;
  uniform float uWaveAmount;
  uniform float uBreath;
  uniform float uColorfulness;
  uniform vec3  uColWhite;
  uniform vec3  uColOrange;
  uniform vec3  uColRed;
  uniform vec3  uColCyan;
  uniform vec3  uColMagenta;
  uniform vec3  uColGold;
  uniform float uParallax;
  uniform float uMouseGlow;
  uniform float uMouseGlowSize;
  uniform float uMouseBend;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes; // y up
    float aspect = uRes.x / uRes.y;

    // subtle parallax from the mouse
    uv += uMouse * vec2(-0.03, -0.02) * uParallax;

    float x = uv.x;
    float d = uv.y - uHorizon; // signed distance to the horizon line

    // ---- flowing noise fields (slow = smooth) ----
    float n1 = fbm(vec2(x * 3.0 - uTime * 0.06, uv.y * 2.0 + uTime * 0.045));
    float n2 = fbm(vec2(x * 7.0 + uTime * 0.05, uv.y * 5.0 - uTime * 0.06));

    // ---- intensity grows left -> right ----
    float grow = smoothstep(0.06, 0.72, x + (n1 - 0.5) * 0.12);
    grow = pow(grow, 1.7);

    // ---- vertical spread widens toward the right ----
    float spread = mix(0.014, uSpreadMax, pow(smoothstep(0.18, 1.05, x), 2.1));

    // wavy displacement so the plume undulates
    float dd = d + (n1 - 0.5) * uWaveAmount * smoothstep(0.25, 0.9, x);

    // ---- mouse interaction: the light bends toward the cursor ----
    vec2 mq = (uv - uMouseUV) * vec2(aspect, 1.0) / max(uMouseGlowSize, 0.01);
    float mGauss = exp(-dot(mq, mq));
    dd -= mGauss * (uMouseUV.y - uHorizon) * uMouseBend;

    float band = exp(-abs(dd) / spread);

    // soft hot core on the line (no razor edge)
    float coreGlow = exp(-abs(d) / 0.028) * grow * uCoreGlow;

    // wide soft halo around the core
    float halo = exp(-abs(dd) / (spread * 2.6)) * 0.35;

    float light = (band + halo) * grow + coreGlow;

    // light visibly STREAMS OUTWARD from the line
    float flow = fbm(vec2(x * 4.5 + n1, abs(dd) * 3.5 - uTime * uFlowSpeed));
    light *= 0.72 + 0.55 * flow;

    // breathing
    light *= 1.0 - uBreath + uBreath * sin(uTime * 0.5 + x * 2.0);

    // cursor halo adds its own luminance
    light += mGauss * uMouseGlow * (0.7 + 0.3 * sin(uTime * 0.8));

    light *= uIntensity;

    // ---- color ----
    float colorAmt = smoothstep(0.25, 0.85, x) * uColorfulness;

    float up = smoothstep(0.0, 0.45, dd);
    float dn = smoothstep(0.0, -0.4, dd);

    vec3 col = uColWhite;
    // golden rim right where light leaves the line
    col = mix(col, uColGold, smoothstep(0.06, 0.16, abs(dd)) *
                             smoothstep(0.35, 0.0, abs(dd)) * colorAmt * 0.8);
    // upper plume: orange deepening to red
    col = mix(col, uColOrange, clamp(up * (1.2 + n2 * 0.6) * colorAmt, 0.0, 1.0));
    col = mix(col, uColRed, clamp((up * 2.4 - 0.9) * colorAmt, 0.0, 1.0));
    // iridescent magenta ribbons woven through the plume
    col = mix(col, uColMagenta,
              clamp((n2 - 0.55) * 2.2, 0.0, 1.0) * (up + dn) * colorAmt * 0.65);
    // far-right trailing edge cools into cyan
    col = mix(col, uColCyan, smoothstep(0.72, 1.0, x + (n2 - 0.5) * 0.08) * 0.85);
    // reflection below: slightly cool
    col = mix(col, mix(uColWhite, uColCyan, 0.35), dn * 0.45);

    vec3 color = col * light;

    // ---- red ember pooling in the water, bottom-right ----
    vec2 ep = (uv - vec2(0.86, 0.0)) * vec2(1.2 * aspect * 0.6, 2.0);
    float ember = exp(-dot(ep, ep)) * smoothstep(0.0, -0.12, d);
    color += uColRed * ember * (0.55 + 0.1 * sin(uTime * 0.7));

    // faint magenta hint bottom-left
    vec2 lp = (uv - vec2(0.02, 0.0)) * vec2(2.2, 2.6);
    color += mix(uColRed, uColMagenta, 0.5)
             * exp(-dot(lp, lp)) * smoothstep(0.0, -0.12, d) * 0.22;

    // ---- dim water sheen below the line ----
    float sheen = smoothstep(0.0, -0.5, d) * 0.05 * grow;
    color += vec3(0.6, 0.68, 0.72) * sheen;

    // ---- stars in the dark upper-left ----
    vec2 sp = uv * vec2(aspect, 1.0) * 90.0;
    vec2 cell = floor(sp);
    vec2 fp = fract(sp) - 0.5;
    float star = step(0.997, hash(cell)) * smoothstep(0.16, 0.0, length(fp));
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.5 + hash(cell + 7.0) * 50.0);
    float darkness = 1.0 - clamp(light * 3.0, 0.0, 1.0);
    color += vec3(0.9) * star * twinkle * darkness
             * smoothstep(0.75, 0.35, x) * smoothstep(0.35, 0.6, uv.y) * 0.5;

    // ---- vignette ----
    float vig = smoothstep(0.0, 0.35, uv.y) * 0.15 + 0.85;
    vig *= 1.0 - 0.45 * pow(1.0 - uv.y, 3.0);
    vig *= 1.0 - 0.35 * pow(uv.y, 4.0);
    vig *= 1.0 - 0.30 * pow(clamp(1.0 - x * 1.4, 0.0, 1.0), 2.0);
    vig *= 1.0 - 0.5 * pow(x, 5.0) * pow(uv.y, 5.0);
    color *= vig;

    // filmic-ish soft rolloff
    color = 1.0 - exp(-color * 1.5);

    gl_FragColor = vec4(color * uReveal, 1.0);
  }
`;

scene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }),
  ),
);

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  uniforms.uRes.value.set(
    w * renderer.getPixelRatio(),
    h * renderer.getPixelRatio(),
  );

  // Portrait screens compress the scene horizontally, so open the
  // light up and center it vertically to keep it prominent.
  const portrait = h > w;
  uniforms.uHorizon.value = portrait ? 0.5 : config.horizon;
  uniforms.uIntensity.value = config.intensity * (portrait ? 1.25 : 1);
  uniforms.uSpreadMax.value = config.spreadMax * (portrait ? 1.25 : 1);
}
resize();
window.addEventListener("resize", resize);

// paint one frame immediately so the scene exists even before rAF ticks
renderer.render(scene, camera);

// Mouse targets eased inside the render loop → buttery motion.
const mouseTarget = new THREE.Vector2(0, 0);
const mouseUVTarget = new THREE.Vector2(0.63, 0.37);

const clock = new THREE.Clock();
gsap.ticker.add(() => {
  uniforms.uTime.value = clock.getElapsedTime();
  uniforms.uMouse.value.lerp(mouseTarget, 0.04);
  uniforms.uMouseUV.value.lerp(mouseUVTarget, 0.06);
  renderer.render(scene, camera);
});

document.body.classList.add("is-ready");

// ============ Entrance ============

const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

tl.fromTo(
  uniforms.uReveal,
  { value: 0 },
  { value: 1, duration: 2.2, ease: "power2.inOut" },
  0,
)
  .from(
    [".nav__logo", ".nav__links a", ".nav__actions .btn"],
    {
      y: -16,
      opacity: 0,
      duration: 0.7,
      stagger: 0.05,
      clearProps: "transform,opacity",
    },
    0.3,
  )
  .from(".hero__badge", { y: 18, opacity: 0, duration: 0.7 }, 0.5)
  .from(".hero__line", { y: 48, opacity: 0, duration: 0.9, stagger: 0.1 }, 0.6)
  .from(".btn--cta", { y: 20, opacity: 0, duration: 0.7 }, 1.0)
  .from(
    [".hero__desc", ".hero__trust"],
    { y: 20, opacity: 0, duration: 0.7, stagger: 0.1 },
    1.1,
  );

// ============ Mouse interaction ============
// Only the shader background reacts to the mouse — the text stays still.

const hero = document.querySelector(".hero");
const fine = window.matchMedia("(pointer: fine)");

hero.addEventListener("mousemove", (e) => {
  if (!fine.matches) return;
  const r = hero.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  mouseTarget.set(px - 0.5, -(py - 0.5));
  mouseUVTarget.set(px, 1.0 - py); // shader uv space (y up)
});

hero.addEventListener("mouseleave", () => {
  mouseTarget.set(0, 0);
  mouseUVTarget.set(0.63, config.horizon);
});
