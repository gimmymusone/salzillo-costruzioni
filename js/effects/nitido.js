/* ══════════════════════════════════════════════════════════════
   La torre in WebGL: più nitida, stessa inquadratura.

   Chiesto dal committente il 2026-09-28 («migliora il render»). I
   frame del bake sono 1536×864 e molto compressi, e sugli schermi
   grandi il browser li ingrandiva 1,25–3 volte col filtro bilineare:
   è lì che la torre sembrava sfocata. Rifare il render non si può da
   qui (Cycles, ore), quindi si lavora sulla resa:
   - ingrandimento bicubico (Catmull-Rom) al posto del bilineare;
   - nitidezza adattiva al contrasto (lo schema di AMD CAS): rinforza
     i contorni e lascia in pace le zone piatte, niente aloni;
   - luce e contrasto del fondo (--fondo-luce, --fondo-contrasto)
     fatti qui dentro invece che col filter CSS sui due canvas a tutto
     schermo, che si pagava a ogni fotogramma dello scrub.
   La cover-math resta quella di SEQ (js/scroll.js → metrics): questo
   file riceve già dx, dy e scala, così il match-cut col marchio non
   cambia di un pixel.
   ?nitido=0 torna al disegno 2D di prima (per confrontare dal vivo);
   ?nitido=0.3…1 cambia l'intensità della nitidezza.
   ══════════════════════════════════════════════════════════════ */

window.NITIDO = (function(){

  const q = new URLSearchParams(location.search).get('nitido');
  const SPENTO = q !== null && parseFloat(q) === 0;
  const NITIDEZZA = q !== null && parseFloat(q) > 0 ? Math.min(1, parseFloat(q)) : .55;

  const VS = `
    attribute vec2 a;
    void main(){ gl_Position = vec4(a, 0., 1.); }`;

  const FS = `
    precision highp float;
    uniform sampler2D u_img;
    uniform vec2  u_tex;       /* dimensioni del frame in texel */
    uniform vec2  u_can;       /* dimensioni del canvas in pixel reali */
    uniform float u_dpr;
    uniform vec4  u_box;       /* dx, dy, larghezza, altezza disegnate (px CSS) */
    uniform float u_sharp;
    uniform float u_luce;
    uniform float u_contr;

    /* Catmull-Rom in 9 letture bilineari (Jimenez) */
    vec3 bicubico(vec2 uv){
      vec2 p  = uv * u_tex;
      vec2 t1 = floor(p - .5) + .5;
      vec2 f  = p - t1;
      vec2 w0 = f * (-.5 + f * (1. - .5 * f));
      vec2 w1 = 1. + f * f * (-2.5 + 1.5 * f);
      vec2 w2 = f * (.5 + f * (2. - 1.5 * f));
      vec2 w3 = f * f * (-.5 + .5 * f);
      vec2 w12 = w1 + w2;
      vec2 o12 = w2 / w12;
      vec2 t0 = (t1 - 1.) / u_tex;
      vec2 t3 = (t1 + 2.) / u_tex;
      vec2 t12 = (t1 + o12) / u_tex;
      vec3 c = vec3(0.);
      c += texture2D(u_img, vec2(t0.x,  t0.y)).rgb  * w0.x  * w0.y;
      c += texture2D(u_img, vec2(t12.x, t0.y)).rgb  * w12.x * w0.y;
      c += texture2D(u_img, vec2(t3.x,  t0.y)).rgb  * w3.x  * w0.y;
      c += texture2D(u_img, vec2(t0.x,  t12.y)).rgb * w0.x  * w12.y;
      c += texture2D(u_img, vec2(t12.x, t12.y)).rgb * w12.x * w12.y;
      c += texture2D(u_img, vec2(t3.x,  t12.y)).rgb * w3.x  * w12.y;
      c += texture2D(u_img, vec2(t0.x,  t3.y)).rgb  * w0.x  * w3.y;
      c += texture2D(u_img, vec2(t12.x, t3.y)).rgb  * w12.x * w3.y;
      c += texture2D(u_img, vec2(t3.x,  t3.y)).rgb  * w3.x  * w3.y;
      return c;
    }

    void main(){
      /* dal pixel del canvas al punto del frame, con la y dall'alto
         come nel 2D */
      vec2 px = vec2(gl_FragCoord.x, u_can.y - gl_FragCoord.y) / u_dpr;
      vec2 uv = (px - u_box.xy) / u_box.zw;
      if(uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.){
        gl_FragColor = vec4(0.); return;
      }
      vec3 c = clamp(bicubico(uv), 0., 1.);

      /* I frame sono WebP molto compressi: nelle zone piatte (il fondo
         sfumato) si vedono i quadretti della compressione, e una
         nitidezza applicata ovunque li farebbe risaltare. Quindi due
         trattamenti separati:
         - dove non ci sono contorni si ammorbidisce su un raggio di 3
           texel (deband): i quadretti si fondono nella sfumatura;
         - solo sui contorni veri si applica la nitidezza adattiva
           (lo schema di AMD CAS). */
      vec2 d = 1. / u_tex;
      vec3 n = texture2D(u_img, uv - vec2(0., d.y)).rgb;
      vec3 s = texture2D(u_img, uv + vec2(0., d.y)).rgb;
      vec3 w = texture2D(u_img, uv - vec2(d.x, 0.)).rgb;
      vec3 e = texture2D(u_img, uv + vec2(d.x, 0.)).rgb;
      vec3 mn = min(c, min(min(n, s), min(w, e)));
      vec3 mx = max(c, max(max(n, s), max(w, e)));
      const vec3 LUMA = vec3(.299, .587, .114);
      float salto = dot(mx - mn, LUMA);
      float bordo = smoothstep(.035, .10, salto);

      vec3 amp = sqrt(clamp(min(mn, 1. - mx) / max(mx, 1e-4), 0., 1.));
      vec3 peso = -amp * mix(.125, .2, u_sharp) * bordo;
      vec3 nitida = clamp((c + (n + s + w + e) * peso) / (1. + 4. * peso), 0., 1.);

      vec2 r = 3. * d;
      vec3 q1 = texture2D(u_img, uv + vec2( r.x,  r.y)).rgb;
      vec3 q2 = texture2D(u_img, uv + vec2(-r.x,  r.y)).rgb;
      vec3 q3 = texture2D(u_img, uv + vec2( r.x, -r.y)).rgb;
      vec3 q4 = texture2D(u_img, uv + vec2(-r.x, -r.y)).rgb;
      vec3 media = (q1 + q2 + q3 + q4 + n + s + w + e) * .125;
      float scarto = max(max(dot(abs(q1 - c), LUMA), dot(abs(q2 - c), LUMA)),
                         max(dot(abs(q3 - c), LUMA), dot(abs(q4 - c), LUMA)));
      float piatto = (1. - smoothstep(.012, .03, scarto)) * (1. - bordo);
      c = mix(nitida, media, piatto);

      /* come i filter CSS di prima: brightness, poi contrast */
      c = c * u_luce;
      c = (c - .5) * u_contr + .5;
      /* un filo di rumore sotto la soglia del visibile: spezza le
         bande della sfumatura */
      float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - .5) / 255.;
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`;

  function crea(canvas){
    if(SPENTO || !canvas) return null;
    let gl;
    try{
      gl = canvas.getContext('webgl', {
        alpha:true, premultipliedAlpha:true, antialias:false,
        preserveDrawingBuffer:true    /* il primo piano lo ricopia */
      });
    }catch(e){ gl = null; }
    if(!gl) return null;

    let prog, loc, tex, caricata = null, colore = null;

    function shader(tipo, src){
      const sh = gl.createShader(tipo);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    function prepara(){
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      loc = {};
      ['u_img','u_tex','u_can','u_dpr','u_box','u_sharp','u_luce','u_contr']
        .forEach(k => loc[k] = gl.getUniformLocation(prog, k));
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      /* 1536×864 non è potenza di 2: niente mipmap, bordi fermi */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(loc.u_img, 0);
      gl.uniform1f(loc.u_sharp, NITIDEZZA);
      caricata = null;
    }
    try{ prepara(); }catch(e){ console.warn('NITIDO:', e); return null; }

    /* Il contesto può perdersi (driver, scheda in background): lo si
       riprende e si ridisegna al giro dopo. */
    let perso = false;
    canvas.addEventListener('webglcontextlost', e=>{ e.preventDefault(); perso = true; });
    canvas.addEventListener('webglcontextrestored', ()=>{
      try{ prepara(); perso = false; }catch(e){}
    });

    /* i valori del fondo vengono dal CSS (diversi sul telefono):
       riletti solo quando possono essere cambiati */
    function leggiColore(){
      const cs = getComputedStyle(document.documentElement);
      colore = {
        luce:  parseFloat(cs.getPropertyValue('--fondo-luce'))      || 1,
        contr: parseFloat(cs.getPropertyValue('--fondo-contrasto')) || 1
      };
    }
    addEventListener('resize', ()=>{ colore = null; });

    /* im: il frame; m: metrics() di SEQ (px CSS); dpr: densità */
    function disegna(im, m, dpr){
      if(perso) return false;
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if(caricata !== im){
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        caricata = im;
      }
      if(!colore) leggiColore();
      gl.uniform2f(loc.u_tex, im.width, im.height);
      gl.uniform2f(loc.u_can, W, H);
      gl.uniform1f(loc.u_dpr, dpr);
      gl.uniform4f(loc.u_box, m.dx, m.dy, im.width * m.s, im.height * m.s);
      gl.uniform1f(loc.u_luce, colore.luce);
      gl.uniform1f(loc.u_contr, colore.contr);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    }

    canvas.classList.add('is-gl');
    return { disegna };
  }

  return { crea, get spento(){ return SPENTO; } };

})();
