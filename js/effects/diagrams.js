/* ══════════════════════════════════════════════════════════════
   Diagrammi generativi delle card "scelta dei lavori".

   Ricostruzione originale della grammatica di composites.archi
   (tratto arancione sottile, spessore costante, angoli vivi,
   niente riempimenti): nessun asset di JEC Group è riusato.

   Due figure, una per card:
   - spirale  quadrati che rientrano uno dentro l'altro ruotando
              di poco a ogni giro → NUOVE COSTRUZIONI (si sale)
   - cerchi   circonferenze tangenti in alto, raggio calante
              → RISTRUTTURAZIONI (si torna sullo stesso punto)

   Due manopole, entrambe guidate dallo scroll (js/scroll.js):
   - p      0→1  quanto della figura è già disegnato
   - desat  0→1  quanto il tratto ha perso l'arancio verso il grigio
   ══════════════════════════════════════════════════════════════ */

window.DIAGRAMS = (function(){

  /* il blu del marchio (--marchio-blu), era l'arancio #F18010 fino al 2026-09-23 */
  const ACCENT = [74,108,147];    /* #4A6C93 */
  const ASHES  = [143,139,139];   /* #8F8B8B — il grigio su cemento */

  const lerp = (a,b,t)=> a + (b-a)*t;
  const ink  = d => `rgb(${
    Math.round(lerp(ACCENT[0],ASHES[0],d))},${
    Math.round(lerp(ACCENT[1],ASHES[1],d))},${
    Math.round(lerp(ACCENT[2],ASHES[2],d))})`;

  /* ── geometrie ───────────────────────────────────────────── */

  /* Quadrati annidati: i vertici di ogni quadrato stanno sui lati
     del precedente a una frazione fissa, ed è quella frazione a
     produrre la rotazione. Il primo quadrato eccede il riquadro:
     la figura deve sembrare tagliata dai bordi, come nella
     reference, non contenuta con educazione. */
  function spiralRings(w,h,yLato){
    /* il centro sta in alto: sotto ci va il titolo, e la zona densa
       della spirale gli toglierebbe leggibilità */
    /* Sulla card orizzontale del telefono (2026-09-25) il quadrato
       grande usciva di sopra e la spirale non si leggeva: lì il lato si
       misura sullo spazio che c'è fra la cima della card e il lato basso
       voluto, così la figura sta tutta dentro. Le card del desktop sono
       verticali e restano come erano. */
    const s  = w > h
      ? Math.min(w * .82, (yLato != null ? yLato : h * .85) - h * .08)
      : Math.max(w,h) * .82;
    /* Nella card il lato basso del primo quadrato cade al centro dello
       spazio fra NUOVE e COSTRUZIONI (committente, 2026-09-24): lo
       dice yLato, misurato sul titolo. Senza titolo, la proporzione. */
    const cx = w/2, cy = yLato != null ? yLato - s/2 : h*.38;
    let pts = [
      [cx-s/2, cy-s/2], [cx+s/2, cy-s/2],
      [cx+s/2, cy+s/2], [cx-s/2, cy+s/2]
    ];
    const rings = [pts];
    for(let i=0;i<7;i++){
      const nxt = pts.map((p,k)=>{
        const q = pts[(k+1)%4];
        return [lerp(p[0],q[0],.21), lerp(p[1],q[1],.21)];
      });
      rings.push(nxt); pts = nxt;
    }
    return rings;
  }

  /* Circonferenze tangenti in alto: il centro scende mentre il
     raggio cala, così tutte si toccano nello stesso punto. */
  function tangentCircles(w,h){
    const cx = w/2, top = h*.05, R = Math.min(w,h)*.45;
    const out = [];
    for(let i=0;i<5;i++){
      const r = R * Math.pow(1 - i/5, 1.15);
      if(r < 8) break;
      out.push({cx, cy:top + r, r});
    }
    return out;
  }

  /* Squadra: il disegno tecnico in basso a sinistra della sezione 5
     (img-15). Linee aperte e sottilissime — un riquadro, la diagonale
     che lo taglia, la freccia che scende — più un quadratino arancione
     fermo dentro la figura, che è l'unico elemento colorato di quella
     schermata. Restituisce polilinee APERTE: si chiude solo il riquadro. */
  function squadra(w,h,fondo){
    const m = Math.min(w,h);
    /* il lato basso del riquadro: nella card passa SOPRA il titolo
       invece di tagliarlo (committente, 2026-09-24) */
    const b = fondo != null ? Math.min(h*.86, fondo) : h*.86;
    return [
      {p:[[w*.06,h*.10],[w*.66,h*.10],[w*.66,b],[w*.06,b]], chiusa:true},
      {p:[[w*.06,h*.10],[w*.44,h*.48]]},
      {p:[[w*.44,h*.20],[w*.44,h*.68]]},
      {p:[[w*.20,h*.48],[w*.94,h*.48]]},
      /* la freccia che scende, come nella ref */
      {p:[[w*.30,h*.60],[w*.30,h*.98],[w*.16,h*.84]]},
      {p:[[w*.30,h*.98],[w*.44,h*.84]]},
      {p:[[w*.66,h*.28],[w*.94,h*.28]], corto:m}
    ];
  }

  /* ── disegno progressivo ─────────────────────────────────── */
  /* L'ultima figura della sequenza si disegna a metà: è ciò che
     rende il tratto "in costruzione" invece che semplicemente
     comparso. */
  function strokePolyPartial(ctx, pts, frac, chiusa){
    const seg = [];
    let total = 0;
    const n = chiusa === false ? pts.length - 1 : pts.length;
    for(let k=0;k<n;k++){
      const a = pts[k], b = pts[(k+1)%pts.length];
      const d = Math.hypot(b[0]-a[0], b[1]-a[1]);
      seg.push({a,b,d}); total += d;
    }
    let want = total * frac;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for(const {a,b,d} of seg){
      if(want <= 0) break;
      const t = Math.min(1, want/d);
      ctx.lineTo(lerp(a[0],b[0],t), lerp(a[1],b[1],t));
      want -= d;
    }
    ctx.stroke();
  }

  function strokeArcPartial(ctx, c, frac){
    if(frac <= 0) return;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, -Math.PI/2, -Math.PI/2 + Math.PI*2*frac);
    ctx.stroke();
  }

  /* Dove cadono le linee rispetto al titolo della card, in corpi del
     titolo (tutto scala in rem, quindi sono costanti). Tarati in
     cattura: K_SPIRALE = centro dello spazio fra le due righe, dalla
     cima del titolo; FONDO_SQUADRA = quanto sopra la cima del titolo. */
  const K_SPIRALE = 1.21, FONDO_SQUADRA = .35;

  /* ── montaggio su un canvas ──────────────────────────────── */
  function mount(canvas, kind){
    const ctx = canvas.getContext('2d');
    let w=0, h=0, shapes=[];

    function resize(){
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if(!w || !h) return;
      canvas.width  = Math.round(w*dpr);
      canvas.height = Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      /* il titolo della card, se c'è, in coordinate del canvas */
      const t = canvas.closest('.case-card')?.querySelector('.case-card__t');
      let top = null, em = 0;
      if(t){
        top = t.getBoundingClientRect().top - canvas.getBoundingClientRect().top;
        em  = parseFloat(getComputedStyle(t).fontSize);
      }
      shapes = kind === 'cerchi'  ? tangentCircles(w,h)
             : kind === 'squadra' ? squadra(w,h, top != null ? top - FONDO_SQUADRA*em : null)
             :                      spiralRings(w,h, top != null ? top + K_SPIRALE*em : null);
    }
    /* la prima misura può cadere col font di riserva */
    if(document.fonts) document.fonts.ready.then(()=>{ resize(); draw(lastP, lastD); });

    function traccia(forma, frac){
      if(kind === 'cerchi') return strokeArcPartial(ctx, forma, frac);
      if(kind === 'squadra') return strokePolyPartial(ctx, forma.p, frac, forma.chiusa === true);
      strokePolyPartial(ctx, forma, frac);
    }

    function draw(p, desat){
      if(!w || !h) resize();
      if(!shapes.length) return;
      ctx.clearRect(0,0,w,h);
      /* tratto sottile e costante: nella reference il diagramma è un
         disegno tecnico, non un segno grasso */
      ctx.lineWidth   = Math.max(2, Math.min(w,h) * .0135);
      ctx.lineJoin    = 'miter';
      ctx.lineCap     = 'butt';
      ctx.strokeStyle = ink(desat || 0);

      const n     = shapes.length;
      const done  = Math.min(n, p * n);
      const whole = Math.floor(done);
      for(let i=0;i<whole;i++) traccia(shapes[i], 1);
      if(whole < n) traccia(shapes[whole], done - whole);

      /* Il quadratino della squadra resta arancione anche a tratto
         desaturato: nella ref è l'unico elemento colorato della
         schermata, e non partecipa alla desaturazione della figura. */
      if(kind === 'squadra' && p >= .999){
        const s = Math.max(5, Math.min(w,h) * .045);
        ctx.fillStyle = `rgb(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]})`;
        ctx.fillRect(w*.44 - s/2, h*.48 - s/2, s, s);
      }
    }

    let lastP = 0, lastD = 0;
    addEventListener('resize', ()=>{ resize(); draw(lastP, lastD); });

    const api = {
      resize,
      draw(p,d){ lastP = p; lastD = d; draw(p,d); }
    };
    resize();
    return api;
  }

  return {mount};

})();
