/**
 * TypeScript adaptation of the user-supplied Stripe-style MiniGl gradient.
 * Keeps the subdivided plane, simplex-noise deformation, and four color layers.
 * Animation and WebGL resources have one owner and are released on disconnect.
 * Simplex noise: Ian McEwan / Ashima Arts, MIT (see NOTICES.md).
 */
export interface GradientConfig {
  freqX?: number;
  freqY?: number;
  amp?: number;
  seed?: number;
  density?: [number, number];
  fps?: number;
  cursorSpeed?: number;
  timeScale?: number;
  pixelRatio?: number;
}

type Vec3 = [number, number, number];
export function normalizeColor(hexCode: string | number): Vec3 {
  let value: number;
  if (typeof hexCode === 'string') {
    let hex = hexCode.trim().replace(/^(#|0x)/i, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return [1, 1, 1];
    value = Number.parseInt(hex, 16);
  } else value = hexCode;
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const noise = `
// Copyright (C) 2011 Ashima Arts. MIT License.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0,1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i = floor(v + dot(v,C.yyy));
  vec3 x0 = v - i + dot(i,C.xxx);
  vec3 g = step(x0.yzx,x0.xyz);
  vec3 l = 1.0-g;
  vec3 i1 = min(g.xyz,l.zxy), i2 = max(g.xyz,l.zxy);
  vec3 x1 = x0-i1+C.xxx, x2 = x0-i2+C.yyy, x3 = x0-D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0,i1.z,i2.z,1.0))
    + i.y + vec4(0.0,i1.y,i2.y,1.0))
    + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j*ns.z), y_ = floor(j-7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy, y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0-abs(x)-abs(y);
  vec4 b0 = vec4(x.xy,y.xy), b1 = vec4(x.zw,y.zw);
  vec4 s0 = floor(b0)*2.0+1.0, s1 = floor(b1)*2.0+1.0;
  vec4 sh = -step(h,vec4(0.0));
  vec4 a0 = b0.xzyw+s0.xzyw*sh.xxyy, a1 = b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x), p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z), p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m = max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uvNorm;
uniform mat4 projectionMatrix;
uniform vec2 resolution;
uniform vec2 u_frequency;
uniform float u_time;
uniform float u_amplitude;
uniform float u_seed;
uniform vec2 u_cursor;
uniform vec3 u_colors[4];
uniform vec4 u_active_colors;
varying vec3 v_color;
${noise}
void main() {
  float time = u_time * 0.000008;
  vec2 noiseCoord = resolution * uvNorm * u_frequency;
  float displacement = snoise(vec3(noiseCoord * vec2(3.0, 4.0) + u_cursor * 0.1, time * 8.0 + u_seed));
  displacement *= u_amplitude * (1.0 - pow(abs(uvNorm.y), 2.0));
  vec3 pos = position;
  pos.y += displacement + pos.x * 0.04;
  v_color = u_active_colors.x > 0.5 ? u_colors[0] : vec3(0.06);
  for (int i=0; i<3; i++) {
    float layer = float(i);
    float field = snoise(vec3(
      noiseCoord.x * (2.0 + layer * 0.7) + time * (4.0 + layer * 0.4) + u_cursor.x,
      noiseCoord.y * (3.0 + layer * 0.7) + u_cursor.y,
      time * (8.0 + layer * 0.3) + u_seed + layer * 15.0
    )) * 0.5 + 0.5;
    float strength = pow(smoothstep(0.12, 0.78 + layer * 0.04, field), 2.8);
    if (u_active_colors[i+1] > 0.5) v_color = mix(v_color, u_colors[i+1], strength);
  }
  gl_Position = projectionMatrix * vec4(pos,1.0);
}`;
const fragmentShader = `
precision mediump float;
varying vec3 v_color;
void main() { gl_FragColor = vec4(v_color, 1.0); }
`;

type UniformValue =
  | { type: 'float'; value: number }
  | { type: 'vec2' | 'vec3' | 'vec4' | 'mat4'; value: Float32Array };

export class Uniform {
  readonly location: WebGLUniformLocation | null;
  constructor(private gl: WebGLRenderingContext, program: WebGLProgram, name: string, public data: UniformValue) {
    this.location = gl.getUniformLocation(program, name);
  }
  update(): void {
    const { gl, location, data } = this;
    if (location === null) return;
    switch (data.type) {
      case 'float': gl.uniform1f(location, data.value); break;
      case 'vec2': gl.uniform2fv(location, data.value); break;
      case 'vec3': gl.uniform3fv(location, data.value); break;
      case 'vec4': gl.uniform4fv(location, data.value); break;
      case 'mat4': gl.uniformMatrix4fv(location, false, data.value); break;
    }
  }
}

export class Material {
  readonly program: WebGLProgram;
  readonly uniforms = new Map<string, Uniform>();
  constructor(private gl: WebGLRenderingContext, vertex: string, fragment: string) {
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program.');
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Unable to create WebGL shader.');
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed.');
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program linking failed.');
      this.program = program;
    } catch (error) { gl.deleteProgram(program); throw error; }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  set(name: string, data: UniformValue): void {
    const existing = this.uniforms.get(name);
    if (existing) existing.data = data;
    else this.uniforms.set(name, new Uniform(this.gl, this.program, name, data));
  }
  use(): void { this.gl.useProgram(this.program); this.uniforms.forEach(uniform => uniform.update()); }
  dispose(): void { this.gl.deleteProgram(this.program); this.uniforms.clear(); }
}

export class PlaneGeometry {
  private position: WebGLBuffer;
  private uv: WebGLBuffer;
  private index: WebGLBuffer;
  private indexCount = 0;
  constructor(private gl: WebGLRenderingContext) {
    const position = gl.createBuffer(), uv = gl.createBuffer(), index = gl.createBuffer();
    if (!position || !uv || !index) {
      gl.deleteBuffer(position); gl.deleteBuffer(uv); gl.deleteBuffer(index);
      throw new Error('Unable to allocate WebGL geometry.');
    }
    this.position = position; this.uv = uv; this.index = index;
  }
  resize(width: number, height: number, density: [number, number]): void {
    // Keep every index inside Uint16 and cap geometry cost on large displays.
    const columns = Math.min(180, Math.max(12, Math.ceil(width * density[0])));
    const rows = Math.min(120, Math.max(12, Math.ceil(height * density[1])));
    const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
    const uvs = new Float32Array((columns + 1) * (rows + 1) * 2);
    const indices = new Uint16Array(columns * rows * 6);
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const i = y * (columns + 1) + x, nx = x / columns * 2 - 1, ny = y / rows * 2 - 1;
      positions.set([nx * width * 0.58, ny * height * 0.78, 0], i * 3);
      uvs.set([nx, ny], i * 2);
      if (x < columns && y < rows) indices.set([i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2], (y * columns + x) * 6);
    }
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.position); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uv); gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.indexCount = indices.length;
  }
  draw(program: WebGLProgram): void {
    const { gl } = this;
    for (const [name, buffer, size] of [['position', this.position, 3], ['uvNorm', this.uv, 2]] as const) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }
  dispose(): void { [this.position, this.uv, this.index].forEach(buffer => this.gl.deleteBuffer(buffer)); }
}

export class MiniGl {
  readonly gl: WebGLRenderingContext;
  readonly material: Material;
  readonly geometry: PlaneGeometry;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL is unavailable.');
    this.gl = gl;
    this.material = new Material(gl, vertexShader, fragmentShader);
    try { this.geometry = new PlaneGeometry(gl); }
    catch (error) { this.material.dispose(); throw error; }
  }
  resize(width: number, height: number, ratio: number, density: [number, number]): void {
    this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(height * ratio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.geometry.resize(width, height, density);
    this.material.set('resolution', { type: 'vec2', value: new Float32Array([width, height]) });
    this.material.set('projectionMatrix', { type: 'mat4', value: new Float32Array([2 / width,0,0,0,0,2 / height,0,0,0,0,-0.001,0,0,0,0,1]) });
  }
  render(): void {
    this.gl.clearColor(0.063, 0.063, 0.071, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.material.use(); this.geometry.draw(this.material.program);
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}

const positive = (value: number | undefined, fallback: number) => Number.isFinite(value) && value! > 0 ? value! : fallback;

export class Gradient {
  readonly config: Required<GradientConfig>;
  private el: HTMLCanvasElement | null = null;
  private minigl: MiniGl | null = null;
  private frame = 0;
  private time = 1253106;
  private lastFrame = 0;
  private playing = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private motion: MediaQueryList | null = null;
  private cursor = new Float32Array(2);
  private target = new Float32Array(2);
  private activeColors = new Float32Array([1, 1, 1, 1]);
  constructor(config: GradientConfig = {}) {
    this.config = {
      freqX: positive(config.freqX, 0.00014), freqY: positive(config.freqY, 0.00029),
      amp: Math.max(0, Number.isFinite(config.amp) ? config.amp! : 220),
      seed: Number.isFinite(config.seed) ? config.seed! : 15,
      density: [positive(config.density?.[0], 0.045), positive(config.density?.[1], 0.085)],
      fps: Math.min(60, positive(config.fps, 30)), cursorSpeed: positive(config.cursorSpeed, 0.3),
      timeScale: positive(config.timeScale, 0.55), pixelRatio: Math.min(2, positive(config.pixelRatio, 1.25)),
    };
  }
  initGradient(selector: string | HTMLCanvasElement): Gradient {
    this.disconnect();
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Gradient requires a canvas element.');
    this.el = element;
    try { this.setupRenderer(); }
    catch { this.el.dataset.gradient = 'fallback'; return this; }
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change', this.syncPlayback);
    this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.syncPlayback(); });
    this.observer.observe(element);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(element);
    element.addEventListener('pointermove', this.handlePointer);
    element.addEventListener('pointerleave', this.handlePointerLeave);
    element.addEventListener('webglcontextlost', this.handleContextLost);
    element.addEventListener('webglcontextrestored', this.handleContextRestored);
    document.addEventListener('visibilitychange', this.syncPlayback);
    this.syncPlayback();
    return this;
  }
  private setupRenderer(): void {
    if (!this.el) return;
    const renderer = new MiniGl(this.el);
    this.minigl = renderer;
    const style = getComputedStyle(this.el);
    const defaults = ['#191318', '#854b58', '#c28c73', '#352337'];
    const colors = defaults.flatMap((fallback, i) => normalizeColor(style.getPropertyValue(`--gradient-color-${i + 1}`).trim() || fallback));
    renderer.material.set('u_colors[0]', { type: 'vec3', value: new Float32Array(colors) });
    renderer.material.set('u_frequency', { type: 'vec2', value: new Float32Array([this.config.freqX, this.config.freqY]) });
    renderer.material.set('u_amplitude', { type: 'float', value: this.config.amp });
    renderer.material.set('u_seed', { type: 'float', value: this.config.seed });
    renderer.material.set('u_active_colors', { type: 'vec4', value: this.activeColors });
    renderer.material.set('u_cursor', { type: 'vec2', value: this.cursor });
    this.resize();
    this.el.dataset.gradient = 'ready';
  }
  private resize = (): void => {
    if (!this.el || !this.minigl) return;
    const rect = this.el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.minigl.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, this.config.pixelRatio), this.config.density);
    this.draw();
  };
  private draw(): void {
    if (!this.minigl || this.minigl.gl.isContextLost()) return;
    this.minigl.material.set('u_time', { type: 'float', value: this.time });
    this.minigl.render();
  }
  private animate = (now: number): void => {
    this.frame = 0;
    if (!this.playing) return;
    const elapsed = now - this.lastFrame;
    if (elapsed >= 1000 / this.config.fps) {
      this.time += Math.min(elapsed, 64) * this.config.timeScale;
      this.lastFrame = now;
      this.cursor[0] += (this.target[0] - this.cursor[0]) * 0.035;
      this.cursor[1] += (this.target[1] - this.cursor[1]) * 0.035;
      this.draw();
    }
    this.frame = requestAnimationFrame(this.animate);
  };
  private handlePointer = (event: PointerEvent): void => {
    if (!this.el) return;
    const rect = this.el.getBoundingClientRect();
    this.target[0] = ((event.clientX - rect.left) / rect.width - 0.5) * this.config.cursorSpeed;
    this.target[1] = ((event.clientY - rect.top) / rect.height - 0.5) * this.config.cursorSpeed;
  };
  private handlePointerLeave = (): void => { this.target.fill(0); };
  private syncPlayback = (): void => {
    if (!this.visible || document.hidden || this.motion?.matches) { this.pause(); this.draw(); }
    else this.play();
  };
  private handleContextLost = (event: Event): void => { event.preventDefault(); this.pause(); if (this.el) this.el.dataset.gradient = 'fallback'; };
  private handleContextRestored = (): void => {
    this.minigl?.dispose(); this.minigl = null;
    try { this.setupRenderer(); this.syncPlayback(); }
    catch { if (this.el) this.el.dataset.gradient = 'fallback'; }
  };
  play(): void {
    if (this.playing || !this.minigl || this.minigl.gl.isContextLost() || !this.visible || document.hidden || this.motion?.matches) return;
    this.playing = true; this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
  }
  pause(): void { this.playing = false; cancelAnimationFrame(this.frame); this.frame = 0; }
  toggleColor(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    this.activeColors[index] = this.activeColors[index] ? 0 : 1; this.draw();
  }
  disconnect(): void {
    this.pause(); this.observer?.disconnect(); this.resizeObserver?.disconnect();
    this.motion?.removeEventListener('change', this.syncPlayback);
    document.removeEventListener('visibilitychange', this.syncPlayback);
    this.el?.removeEventListener('pointermove', this.handlePointer);
    this.el?.removeEventListener('pointerleave', this.handlePointerLeave);
    this.el?.removeEventListener('webglcontextlost', this.handleContextLost);
    this.el?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.minigl?.dispose();
    this.minigl = null; this.el = null; this.observer = null; this.resizeObserver = null; this.motion = null;
    this.cursor.fill(0); this.target.fill(0); this.visible = true;
  }
}
