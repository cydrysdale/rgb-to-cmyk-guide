/*
  sandbox.js — interactive color sandbox for the RGB → CMYK guide

  What this does
  --------------
  • Accepts a HEX color input and previews it (live swatch).
  • Converts the color along a simplified pipeline:
      HEX (sRGB) → linear sRGB → XYZ (D65) → Bradford-adapted XYZ (D50) → Lab (D50)
  • Applies *approximate* rendering-intent transforms in Lab to illustrate why different
    intents produce different printed colors (educational only — not a true ICC CMM).
  • Converts back to linear sRGB and to an *approximate* CMYK (device-independent,
    K-under-color-removal with simple GCR). This is just for demo—not press-ready.

  Safe to include anywhere
  ------------------------
  The DOM wiring is guard-railed: if the expected elements aren’t on the page
  (#hexInput, #convertBtn, #intentTable tbody, #liveSwatch), the script no-ops.

  Key DOM hooks
  -------------
  #hexInput           <input> where users type a HEX color (e.g., #629c67)
  #convertBtn         <button> to trigger conversion; Enter on input also works
  #liveSwatch         <div> the background is set to the current color
  #intentTable tbody  <tbody> rows are populated for each rendering intent
*/

(function(){
  // Utility: clamp a value into the closed interval [lo, hi]
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // Parse #RRGGBB → normalized sRGB triplet in [0..1]; returns null on invalid
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return null;
    return [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255];
  }

  // IEC 61966-2-1 sRGB electro‑optical transfer function (EOTF) — companding removal
  function srgbToLinear(c) { return (c <= 0.04045) ? (c/12.92) : Math.pow((c+0.055)/1.055, 2.4); }
  // sRGB inverse transfer function — companding to display space
  function linearToSrgb(c) { return (c <= 0.0031308) ? (12.92*c) : (1.055*Math.pow(c, 1/2.4) - 0.055); }

  // Multiply a 3×3 matrix by a 3×1 vector (column-major math)
  function mul3x3(a,b) {
    return [
      a[0][0]*b[0] + a[0][1]*b[1] + a[0][2]*b[2],
      a[1][0]*b[0] + a[1][1]*b[1] + a[1][2]*b[2],
      a[2][0]*b[0] + a[2][1]*b[1] + a[2][2]*b[2]
    ];
  }

  // Bradford cone-response matrix (for chromatic adaptation)
  const M = [
    [ 0.8951000,  0.2664000, -0.1614000],
    [-0.7502000,  1.7135000,  0.0367000],
    [ 0.0389000, -0.0685000,  1.0296000]
  ];
  // Inverse Bradford matrix
  const Mi = [
    [ 0.9869929, -0.1470543, 0.1599627],
    [ 0.4323053,  0.5183603, 0.0492912],
    [-0.0085287,  0.0400428, 0.9684867]
  ];
  // Reference white tristimulus values for D65 and D50 (normalized Y=1)
  const D65 = [0.95047, 1.00000, 1.08883];
  const D50 = [0.96422, 1.00000, 0.82521];

  // Adapt XYZ from D65 white to D50 using Bradford adaptation
  function adaptD65toD50(XYZ) {
    const LMS = mul3x3(M, XYZ);
    const LMS_w_src = mul3x3(M, D65);
    const LMS_w_dst = mul3x3(M, D50);
    const scale = [LMS_w_dst[0]/LMS_w_src[0], LMS_w_dst[1]/LMS_w_src[1], LMS_w_dst[2]/LMS_w_src[2]];
    const LMS_c = [LMS[0]*scale[0], LMS[1]*scale[1], LMS[2]*scale[2]];
    return mul3x3(Mi, LMS_c);
  }
  // Adapt XYZ from D50 white back to D65 (inverse Bradford)
  function adaptD50toD65(XYZ) {
    const LMS = mul3x3(M, XYZ);
    const LMS_w_src = mul3x3(M, D50);
    const LMS_w_dst = mul3x3(M, D65);
    const scale = [LMS_w_dst[0]/LMS_w_src[0], LMS_w_dst[1]/LMS_w_src[1], LMS_w_dst[2]/LMS_w_src[2]];
    const LMS_c = [LMS[0]*scale[0], LMS[1]*scale[1], LMS[2]*scale[2]];
    return mul3x3(Mi, LMS_c);
  }

  // Linear sRGB → XYZ (D65) matrix per IEC 61966-2-1
  const M_srgb_to_xyz = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
  ];
  // XYZ (D65) → linear sRGB (inverse matrix)
  const M_xyz_to_srgb = [
    [ 3.2404542, -1.5371385, -0.4985314],
    [-0.9692660,  1.8760108,  0.0415560],
    [ 0.0556434, -0.2040259,  1.0572252]
  ];

  // Helper f(t) defined by CIE Lab (handles linear segment below epsilon)
  function f_lab(t) { const eps=216/24389, k=24389/27; return t>eps ? Math.cbrt(t) : ((k*t+16)/116); }
  // Convert XYZ (assumed D50) to CIE Lab (D50)
  function xyzD50_to_lab([X,Y,Z]){
    const xr = X/D50[0], yr = Y/D50[1], zr = Z/D50[2];
    const fx = f_lab(xr), fy = f_lab(yr), fz = f_lab(zr);
    const L = 116*fy - 16, a = 500*(fx - fy), b = 200*(fy - fz);
    return [L,a,b];
  }
  // Inverse of f(t) used for Lab → XYZ
  function finv_lab(t) { const eps=216/24389, k=24389/27; const t3=t*t*t; return (t3>eps) ? t3 : ((116*t-16)/k); }
  // Convert CIE Lab (D50) back to XYZ (D50)
  function lab_to_xyzD50([L,a,b]){
    const fy = (L + 16)/116, fx = fy + (a/500), fz = fy - (b/200);
    return [finv_lab(fx)*D50[0], finv_lab(fy)*D50[1], finv_lab(fz)*D50[2]];
  }

  // Educational CMYK: convert linear RGB → display RGB, then to CMYK with simple GCR
  // Note: This is device-independent & for illustration only — not using an ICC printer profile.
  function rgbLinear_to_cmyk(lin) {
    const sr = Math.min(Math.max((lin[0] <= 0.0031308) ? (12.92*lin[0]) : (1.055*Math.pow(lin[0],1/2.4)-0.055),0),1);
    const sg = Math.min(Math.max((lin[1] <= 0.0031308) ? (12.92*lin[1]) : (1.055*Math.pow(lin[1],1/2.4)-0.055),0),1);
    const sb = Math.min(Math.max((lin[2] <= 0.0031308) ? (12.92*lin[2]) : (1.055*Math.pow(lin[2],1/2.4)-0.055),0),1);
    let C = 1 - sr, M = 1 - sg, Y = 1 - sb;
    const K = Math.min(C, M, Y);
    if (K >= 1.0 - 1e-6) return {C:0,M:0,Y:0,K:1};
    C = (C - K) / (1 - K);
    M = (M - K) / (1 - K);
    Y = (Y - K) / (1 - K);
    return {C,M,Y,K};
  }
  // Convert CMYK back to display RGB (naïve inversion used for preview swatch)
  function cmyk_to_rgb({C,M,Y,K}) {
    const r = (1 - C) * (1 - K);
    const g = (1 - M) * (1 - K);
    const b = (1 - Y) * (1 - K);
    return [r,g,b];
  }

  // Intent: Perceptual (approximate) — compress gamut softly in L and chroma
  function intent_perceptual([L,a,b]) { return [L*0.96 + 0.9, a*0.96, b*0.93]; }
  // Intent: Saturation (approximate) — favor punchy chroma, less tone accuracy
  function intent_saturation([L,a,b]) { return [L*0.96 + 1.1, a*1.09, b*1.08]; }
  // Intent: Relative Colorimetric (approximate) — clip out-of-gamut, white-point scaled
  function intent_relative([L,a,b]) { return [L*0.96 + 0.9, a*1.09, b*1.08]; }
  // Intent: Absolute Colorimetric (approximate) — preserve in-gamut, absolute white point
  function intent_absolute([L,a,b]) { return [L*1.11 + 0.2, a*1.17, b*1.05]; }
  // Intent: Naive — no transform, just show the baseline Lab
  function intent_naive(Lab) { return Lab.slice(); }

  // HEX → Lab (D50) via: HEX→sRGB→linear→XYZ(D65)→Bradford→XYZ(D50)→Lab(D50)
  function hexToLabD50(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const lin = rgb.map(srgbToLinear);
    const XYZd65 = mul3x3(M_srgb_to_xyz, lin);
    const XYZd50 = adaptD65toD50(XYZd65);
    const Lab = xyzD50_to_lab(XYZd50);
    return {lin, XYZd65, XYZd50, Lab};
  }
  // Lab (D50) → linear sRGB via: Lab→XYZ(D50)→Bradford→XYZ(D65)→linear sRGB
  function labToLinearRgbViaD50(Lab) {
    const XYZd50 = lab_to_xyzD50(Lab);
    const XYZd65 = adaptD50toD65(XYZd50);
    const lin = mul3x3(M_xyz_to_srgb, XYZd65);
    return lin.map(v => Math.min(Math.max(v,0),1));
  }

  // Helper: percent formatter for 0..1 → 0..100 (unused in current table)
  function fmtPct(x){ return Math.round(x*100); }
  // Helper: format Lab as "L 00.0, a 00.0, b 00.0"
  function fmtLab(Lab){ return `L ${Lab[0].toFixed(1)}, a ${Lab[1].toFixed(1)}, b ${Lab[2].toFixed(1)}`; }

  // Render the table for all intents and update the live swatch
  function update(hex){
    const base = hexToLabD50(hex);
    if (!base) return;
    document.getElementById('liveSwatch').style.background = hex;

    // NOTE: Rendering intents below are heuristic approximations to illustrate
    // differences in tone/chroma handling. For production press work, use a
    // real ICC CMM (e.g., LittleCMS via WASM) with the printer profile.
    const intents = [
      {name:'Perceptual', fn:intent_perceptual},
      {name:'Relative colorimetric', fn:intent_relative},
      {name:'Saturation', fn:intent_saturation},
      {name:'Absolute colorimetric', fn:intent_absolute},
      {name:'Naive math', fn:intent_naive},
    ];

    const tbody = document.querySelector('#intentTable tbody');
    tbody.innerHTML = '';
    intents.forEach(entry => {
      const Lab_t = entry.fn(base.Lab.slice());
      const linRGB = labToLinearRgbViaD50(Lab_t);
      const cmyk = rgbLinear_to_cmyk(linRGB);
      const dispRGB = cmyk_to_rgb(cmyk).map(v => Math.min(Math.max(v,0),1));
      const hexOut = '#'+dispRGB.map(v => ('0'+Math.round(v*255).toString(16)).slice(-2)).join('');

      const tr = document.createElement('tr');
      const td0 = document.createElement('td'); td0.textContent = entry.name;
      const td1 = document.createElement('td');
      const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = hexOut; td1.appendChild(sw);
      const td3 = document.createElement('td'); td3.textContent = fmtLab(Lab_t);
      tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td3);
      tbody.appendChild(tr);
    });
  }

  // DOM wiring — guarded so the file is safe to include site‑wide
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('hexInput');
    const btn   = document.getElementById('convertBtn');
    const tbody = document.querySelector('#intentTable tbody');
    const swatch= document.getElementById('liveSwatch');

    // If the sandbox UI isn’t present, do nothing.
    if (!input || !btn || !tbody || !swatch) return;

    // Hook up events
    const go = () => {
      const v = (input.value || '').trim();
      const normalized = v.startsWith('#') ? v : ('#' + v);
      update(normalized);
    };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

    // Seed example color
    update('#629c67');
  });
})();
