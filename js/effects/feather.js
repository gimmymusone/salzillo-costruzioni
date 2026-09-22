/* ══════════════════════════════════════════════════════════════
   EFFETTO "PIUMA" — ricostruzione del campo di filamenti di
   composites.archi (barbe di piuma con leggera aberrazione RGB).

   NON usa gli asset originali (i .glb del sito sono di JEC Group):
   è una ricostruzione parametrica su canvas 2D.

   Modello: una curva-guida (il rachide) viene ripetuta N volte
   spostandola lungo la sua normale, con una divergenza progressiva.
   Ne esce un fascio di filamenti annidati, non un ventaglio piatto.

   ─── Come sostituirlo con l'effetto "mattone" ───
   Crea js/effects/brick.js che registra un oggetto con la stessa
   forma di questo (id, name, params, schema, draw) via FX.register(),
   poi attivalo con FX.use('<id>') in js/hero.js. Nient'altro.
   ══════════════════════════════════════════════════════════════ */

window.FX = window.FX || {
  _all:{}, current:null, canvas:null, canvasGL:null, ctx:null,
  dpr:1, raf:null, t:0, w:0, h:0, mouse:{x:0,y:0,tx:0,ty:0},

  /* Un effetto è { id, name, params, schema, mode?:'2d'|'webgl',
     draw(ctx,w,h,t,mouse)  ← mode '2d'
     init(canvas), render(w,h,t,mouse), resize(w,h,dpr)  ← mode 'webgl' } */
  register(fx){
    fx.mode = fx.mode || '2d';
    this._all[fx.id] = fx;
    if(!this.current) this.current = fx;
    document.dispatchEvent(new CustomEvent('fx:registered', {detail:fx.id}));
  },
  list(){ return Object.values(this._all); },

  use(id){
    const fx = this._all[id]; if(!fx) return;
    this.current = fx;
    if(fx.mode === 'webgl' && !fx._ready && this.canvasGL){
      fx.init(this.canvasGL);
      fx._ready = true;
    }
    this.syncCanvases();
    this.resize();
  },

  syncCanvases(){
    if(!this.canvas || !this.canvasGL) return;
    const gl = this.current?.mode === 'webgl';
    this.canvas.hidden   = gl;
    this.canvasGL.hidden = !gl;
  },

  mount(canvas, canvasGL){
    this.canvas   = canvas;
    this.canvasGL = canvasGL || null;
    this.ctx = canvas.getContext('2d');
    addEventListener('resize', ()=>this.resize());
    addEventListener('mousemove', e=>{
      const r = canvas.getBoundingClientRect();
      this.mouse.tx = (e.clientX - r.left)/r.width  - .5;
      this.mouse.ty = (e.clientY - r.top )/r.height - .5;
    });
    this.syncCanvases();
    this.resize();
    this.start();
  },

  resize(){
    const host = this.current?.mode === 'webgl' ? this.canvasGL : this.canvas;
    if(!host) return;
    const r = host.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width || (this.canvas ? this.canvas.getBoundingClientRect().width : 0);
    this.h = r.height || (this.canvas ? this.canvas.getBoundingClientRect().height : 0);
    if(this.current?.mode === 'webgl'){
      this.current.resize?.(this.w, this.h, this.dpr);
    } else {
      host.width  = Math.max(1, Math.round(this.w * this.dpr));
      host.height = Math.max(1, Math.round(this.h * this.dpr));
    }
  },

  start(){
    if(this.raf) return;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const loop = ()=>{
      this.t += reduce ? 0 : (this.current?.params.speed ?? 1) * .0022;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * .045;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * .045;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop(){ cancelAnimationFrame(this.raf); this.raf = null; },

  render(){
    const fx = this.current; if(!fx) return;
    if(fx.mode === 'webgl'){ fx.render(this.w, this.h, this.t, this.mouse); return; }
    const {ctx} = this; if(!ctx) return;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,this.w,this.h);
    fx.draw(ctx, this.w, this.h, this.t, this.mouse);
  }
};

/* ── L'effetto piuma ──────────────────────────────────────── */
(function(){

  const params = {
    count:64, spread:1.15, bow:.95, fan:.28, taper:.55,
    thickness:.95, opacity:.30, aberration:1.8, speed:1, parallax:22,
    startX:-.22, startY:1.15, endX:1.12, endY:-.18,
    /* 0 = filamenti chiari sulla notte, 1 = scuri sul cemento.
       Lo scroll lo muove insieme alla virata del tema (scroll.js →
       initPiuma): senza, a metà virata la piuma sparirebbe perché
       chiara su fondo chiaro. */
    onLight:0,
    /* Il congedo dell'oggetto — vedi `sfaldatura()` più sotto.
       A 0 non disegna niente: a riposo il campo è quello di sempre. */
    sfalda:0, sfaldaX:.28, sfaldaY:.72
  };

  const schema = [
    {k:'count',      l:'Numero di filamenti',   min:10,  max:320, step:1},
    {k:'spread',     l:'Ampiezza del fascio',   min:.05, max:2.2, step:.01},
    {k:'bow',        l:'Curvatura',             min:-1.2,max:1.2, step:.01},
    {k:'fan',        l:'Divergenza',            min:-1.5,max:1.5, step:.01},
    {k:'taper',      l:'Assottigliamento',      min:0,   max:1,   step:.01},
    {k:'thickness',  l:'Spessore tratto',       min:.1,  max:3,   step:.05},
    {k:'opacity',    l:'Opacità',               min:0,   max:.8,  step:.005},
    {k:'aberration', l:'Aberrazione cromatica', min:0,   max:6,   step:.1},
    {k:'speed',      l:'Velocità',              min:0,   max:4,   step:.05},
    {k:'parallax',   l:'Parallasse mouse',      min:0,   max:90,  step:1},
    {k:'onLight',    l:'Su cemento (0→1)',      min:0,   max:1,   step:.01},
    {k:'sfalda',     l:'Sfaldatura (congedo)',  min:0,   max:1,   step:.01},
    {k:'sfaldaX',    l:'Sfaldatura — X',        min:0,   max:1,   step:.01},
    {k:'sfaldaY',    l:'Sfaldatura — Y',        min:0,   max:1,   step:.01},
    {k:'startY',     l:'Partenza — Y',          min:-.5, max:2,   step:.01},
    {k:'endY',       l:'Arrivo — Y',            min:-1.5,max:1.5, step:.01}
  ];

  const SAMPLES = 26;

  /* punto e tangente di una bezier quadratica */
  function q(t, p0, p1, p2){
    const u = 1-t;
    return [
      u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0],
      u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1],
      2*u*(p1[0]-p0[0]) + 2*t*(p2[0]-p1[0]),
      2*u*(p1[1]-p0[1]) + 2*t*(p2[1]-p1[1])
    ];
  }

  function draw(ctx, w, h, t, mouse){
    const p  = params;
    const px = mouse.x * p.parallax, py = mouse.y * p.parallax;

    const S = [p.startX*w + px, p.startY*h + py];
    const E = [p.endX*w   + px, p.endY*h   + py];

    const dx = E[0]-S[0], dy = E[1]-S[1];
    const L  = Math.hypot(dx,dy) || 1;
    const nx = -dy/L, ny = dx/L;                  // normale alla guida

    const band = p.spread * Math.min(w,h);

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    for(let i=0;i<p.count;i++){
      const u  = p.count > 1 ? i/(p.count-1) : .5;
      const s  = u - .5;                           // -0.5 … +0.5

      /* respiro lentissimo, sfasato lungo il fascio */
      const wob = Math.sin(t*1.6 + u*5.4)*.10 + Math.sin(t*.85 + u*2.3)*.06;

      /* offset del filamento lungo la normale */
      const off = s * band * (1 + wob*.35);

      /* il punto di controllo crea l'arco; `fan` fa divergere i filamenti */
      const bowAmt = (p.bow + wob*.22) * L * .5 + s * p.fan * L * .45;

      const P0 = [S[0] + nx*off,  S[1] + ny*off];
      const P2 = [E[0] + nx*off*(1 + p.fan*.5), E[1] + ny*off*(1 + p.fan*.5)];
      const P1 = [
        (P0[0]+P2[0])/2 + nx*bowAmt,
        (P0[1]+P2[1])/2 + ny*bowAmt
      ];

      /* i filamenti ai bordi del fascio sbiadiscono e si assottigliano */
      const edge  = 1 - Math.pow(Math.abs(s*2), 1.6);
      const fade  = Math.max(0, edge);
      const alpha = p.opacity * (1 - p.taper + p.taper*fade);
      const lw    = p.thickness * (1 - p.taper*.5 + p.taper*.5*fade);
      if(alpha <= .002) continue;

      const stroke = ()=>{
        ctx.beginPath();
        for(let k=0;k<=SAMPLES;k++){
          const tt = k/SAMPLES;
          const pt = q(tt, P0, P1, P2);
          k ? ctx.lineTo(pt[0],pt[1]) : ctx.moveTo(pt[0],pt[1]);
        }
        ctx.stroke();
      };

      /* Frange cromatiche R/B, poi il tratto neutro sopra.
         Si spengono man mano che il fondo schiarisce: 'lighter' su
         cemento non aggiunge frangia, sbianca e basta. */
      if(p.aberration > 0 && (p.onLight || 0) < .95){
        const ab = p.aberration * (1 - (p.onLight || 0));
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = lw;
        ctx.strokeStyle = `rgba(150,50,50,${alpha*.5})`;
        ctx.save(); ctx.translate(ab, ab*.4);   stroke(); ctx.restore();
        ctx.strokeStyle = `rgba(50,80,150,${alpha*.5})`;
        ctx.save(); ctx.translate(-ab, -ab*.4); stroke(); ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }

      /* il tratto segue il tema: da #C4C0C0 sulla notte a #2A2828
         sul cemento. Sul chiaro serve più corpo, perché il grigio
         scuro su cemento ha meno stacco del chiaro sul nero. */
      const lit = p.onLight || 0;
      const c   = Math.round(196 + (42 - 196) * lit);
      const c2  = Math.max(0, c - 4);
      ctx.lineWidth   = lw;
      ctx.strokeStyle = `rgba(${c},${c2},${c2},${alpha * (1 + lit*.55)})`;
      stroke();
    }

    if((p.sfalda || 0) > .001) sfaldatura(ctx, w, h, t, p.sfalda);
  }

  /* ── Il congedo: l'oggetto non esce di scena, diventa fondo ──
     Nella reference la piuma protagonista non svanisce con una
     dissolvenza: si dissolve DENTRO le piume scure sparse in secondo
     piano (img-10) — l'oggetto non sparisce, diventa la texture del
     fondo. Qui è la stessa cosa col mattone: dal punto dove si è
     schiantato partono filamenti corti che si allungano, divergono e
     si disperdono nel campo, mentre il canvas dell'oggetto perde
     opacità (la manopola gemella sta in js/scroll.js → initBrick).

     `s` (0→1) è scrubbato: a 0 non si disegna nulla e il campo è
     quello di sempre; a 1 i filamenti sono lunghi e già sbiaditi. */
  function sfaldatura(ctx, w, h, t, s){
    const p = params;
    const cx = p.sfaldaX * w, cy = p.sfaldaY * h;
    /* pochi e lunghi, non tanti e corti: fitti e corti leggevano come
       erba attaccata all'oggetto, non come filamenti che si disperdono */
    const n  = Math.max(6, Math.round(p.count * .28));
    const R  = Math.min(w, h);
    const lit = p.onLight || 0;
    const c   = Math.round(196 + (42 - 196) * lit);

    /* pseudo-caso deterministico: serve la dispersione, non il caso —
       con Math.random() lo scrub non si riavvolgerebbe uguale */
    const rnd = (k, semi)=>{
      const x = Math.sin(k*127.1 + semi*311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    ctx.lineCap = 'round';
    for(let i=0;i<n;i++){
      const u = i/(n-1);
      /* ognuno parte con un suo ritardo: il fronte non è compatto */
      const q = Math.max(0, Math.min(1, (s - u*.42) / .58));
      if(q <= .001) continue;

      /* le origini sono SPARSE lungo il piano attorno al punto d'impatto,
         non tutte nello stesso punto: da un punto solo veniva una
         raggiera regolare, e nella reference le piume di sfondo sono
         sparse (img-10). Ellisse schiacciata: sul piano ci si allarga in
         orizzontale molto più che in verticale. */
      const ox = (rnd(i, 1) - .5) * R * .34;
      const oy = (rnd(i, 2) - .5) * R * .07;
      const P0 = [cx + ox, cy + oy];

      /* direzione: verso l'alto, con una deriva che segue il lato da cui
         la scheggia si è staccata */
      const ang = -Math.PI*.5
                + (rnd(i, 3) - .5) * 1.15
                + (ox / (R * .34)) * .55
                + Math.sin(t*.6 + u*5.7) * .10;

      const len = R * (.09 + .44*q) * (.50 + .50*rnd(i, 4));
      const P2  = [P0[0] + Math.cos(ang)*len, P0[1] + Math.sin(ang)*len];
      /* la curvatura cresce col percorso: più si allontana, più si
         piega — è quello che fa leggere il filamento come leggero */
      const bend = len * .34 * (rnd(i, 5) - .5) * 2;
      const P1 = [(P0[0]+P2[0])/2 - Math.sin(ang)*bend,
                  (P0[1]+P2[1])/2 + Math.cos(ang)*bend];

      /* campana: si accende partendo e si disperde arrivando */
      const alpha = p.opacity * .85 * Math.sin(Math.PI * q) * (1 + lit*.55);
      if(alpha <= .002) continue;

      ctx.lineWidth   = p.thickness * (1 - .55*q);
      ctx.strokeStyle = `rgba(${c},${c-4},${c-4},${alpha})`;
      ctx.beginPath();
      for(let k=0;k<=SAMPLES;k++){
        const tt = k/SAMPLES;
        const pt = q_(tt, P0, P1, P2);
        k ? ctx.lineTo(pt[0],pt[1]) : ctx.moveTo(pt[0],pt[1]);
      }
      ctx.stroke();
    }
  }
  const q_ = q;   /* stesso mattoncino della guida, con un altro nome
                     perché dentro sfaldatura() `q` è già il progresso */

  window.FX.register({ id:'feather', name:'Piuma (reference)', params, schema, draw });

})();
