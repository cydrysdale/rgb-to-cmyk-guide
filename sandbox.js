(function(){
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return null;
    return [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255];
  }

  function srgbToLinear(c) { return (c <= 0.04045) ? (c/12.92) : Math.pow((c+0.055)/1.055, 2.4); }
  function linearToSrgb(c) { return (c <= 0.0031308) ? (12.92*c) : (1.055*Math.pow(c, 1/2.4) - 0.055); }

  function mul3x3(a,b) {
    return [
      a[0][0]*b[0] + a[0][1]*b[1] + a[0][2]*b[2],
      a[1][0]*b[0] + a[1][1]*b[1] + a[1][2]*b[2],
      a[2][0]*b[0] + a[2][1]*b[1] + a[2][2]*b[2],
    ];
  }

  const M = [
    [ 0.8951,  0.2664, -0.1614],
    [-0.7502,  1.7135,  0.0367],
    [ 0.0389, -0.0685,  1.0296]
  ];
  const Mi = [
    [ 0.9869929, -0.1470543, 0.1599627],
    [ 0.4323053,  0.5183603, 0.0492912],
    [-0.0085287,  0.0400428, 0.9684867]
  ];
  const D65 = [0.95047, 1.00000, 1.08883];
  const D50 = [0.96422, 1.00000, 0.82521];

  function adaptD65toD50(XYZ) {
    const LMS = mul3x3(M, XYZ);
    const LMS_w_src = mul3x3(M, D65);
    const LMS_w_dst = mul3x3(M, D50);
    const scale = [LMS_w_dst[0]/LMS_w_src[0], LMS_w_dst[1]/LMS_w_src[1], LMS_w_dst[2]/LMS_w_src[2]];
    const LMS_c = [LMS[0]*scale[0], LMS[1]*scale[1], LMS[2]*scale[2]];
    return mul3x3(Mi, LMS_c);
  }
  function adaptD50toD65(XYZ) {
    const LMS = mul3x3(M, XYZ);
    const LMS_w_src = mul3x3(M, D50);
    const LMS_w_dst = mul3x3(M, D65);
    const scale = [LMS_w_dst[0]/LMS_w_src[0], LMS_w_dst[1]/LMS_w_src[1], LMS_w_dst[2]/LMS_w_src[2]];
    const LMS_c = [LMS[0]*scale[0], LMS[1]*scale[1], LMS[2]*scale[2]];
    return mul3x3(Mi, LMS_c);
  }

  const M_srgb_to_xyz = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
  ];
  const M_xyz_to_srgb = [
    [ 3.2404542, -1.5371385, -0.4985314],
    [-0.9692660,  1.8760108,  0.0415560],
    [ 0.0556434, -0.2040259,  1.0572252]
  ];

  function f_lab(t) { const eps=216/24389, k=24389/27; return t>eps ? Math.cbrt(t) : ((k*t+16)/116); }
  function xyzD50_to_lab(XYZ) {
    const xr = XYZ[0]/D50[0], yr = XYZ[1]/D50[1], zr = XYZ[2]/D50[2];
    const fx = f_lab(xr), fy = f_lab(yr), fz = f_lab(zr);
    return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
  }
  function finv_lab(t) { const eps=216/24389, k=24389/27; const t3=t*t*t; return t3>eps ? t3 : (116*t-16)/k; }
  function lab_to_xyzD50(Lab){
    const [L,a,b] = Lab;
    const fy = (L+16)/116;
    const fx = fy + a/500;
    const fz = fy - b/200;
    return [finv_lab(fx)*D50[0], finv_lab(fy)*D50[1], finv_lab(fz)*D50[2]];
  }

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
  function cmyk_to_rgb({C,M,Y,K}) {
    const r = (1 - C) * (1 - K);
    const g = (1 - M) * (1 - K);
    const b = (1 - Y) * (1 - K);
    return [r,g,b];
  }

  function intent_perceptual([L,a,b]) { return [L*0.96 + 0.9, a*0.96, b*0.93]; }
  function intent_saturation([L,a,b]) { return [L*0.96 + 1.1, a*1.09, b*1.08]; }
  function intent_relative([L,a,b]) { return [L*0.96 + 0.9, a*1.09, b*1.08]; }
  function intent_absolute([L,a,b]) { return [L*1.11 + 0.2, a*1.17, b*1.05]; }
  function intent_naive(Lab) { return Lab.slice(); }

  function hexToLabD50(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const lin = rgb.map(srgbToLinear);
    const XYZd65 = mul3x3(M_srgb_to_xyz, lin);
    const XYZd50 = adaptD65toD50(XYZd65);
    const Lab = xyzD50_to_lab(XYZd50);
    return {lin, XYZd65, XYZd50, Lab};
  }
  function labToLinearRgbViaD50(Lab) {
    const XYZd50 = lab_to_xyzD50(Lab);
    const XYZd65 = adaptD50toD65(XYZd50);
    const lin = mul3x3(M_xyz_to_srgb, XYZd65);
    return lin.map(v => Math.min(Math.max(v,0),1));
  }

  function fmtPct(x){ return Math.round(x*100); }
  function fmtLab(Lab){ return `L ${Lab[0].toFixed(1)}, a ${Lab[1].toFixed(1)}, b ${Lab[2].toFixed(1)}`; }

  function update(hex){
    const base = hexToLabD50(hex);
    if (!base) return;
    document.getElementById('liveSwatch').style.background = hex;

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

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('hexInput');
    const btn = document.getElementById('convertBtn');
    const go = () => {
      const v = input.value.trim();
      const normalized = v.startsWith('#') ? v : ('#'+v);
      update(normalized);
    };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    update('#629c67');
  });
})();