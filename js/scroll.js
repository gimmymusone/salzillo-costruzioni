/* ══════════════════════════════════════════════════════════════
   Scroll: sequenza di frame + coreografia delle sezioni.

   - SEQ: scrub della sequenza renderizzata da Blender (pattern
     Caveau: preload progressivo, fallback sul frame più vicino
     caricato, lerp del progresso, redraw solo al cambio frame).
   - Morph logo→zenit: le costanti FOOTPRINT arrivano dal render
     (render_orbit.py le stampa). frameToScreen() replica la
     cover-math del draw(), così l'anello del marchio SVG combacia
     col frame 1 a qualunque viewport. Debug: ?debug=1.
   - ScrollTrigger: un master su #scroll-driver (hero + sezione 01)
     guida i frame; trigger locali per reveal, cerniera (fade del
     fondo + onda di posa dei mattoni), galleria orizzontale.
   ══════════════════════════════════════════════════════════════ */

/* ── scrub di una sequenza di frame, in generale ────────────
   Il pattern è quello di SEQ qui sotto — preload progressivo,
   fallback sul frame più vicino già caricato, disegno in cover e
   redraw solo al cambio frame — estratto perché lo usa anche il
   mattone (js/effects/brick.js) e riscriverlo una seconda volta
   sarebbe stato lo stesso codice con altri nomi.
   SEQ non è ancora migrato qui sopra: porta con sé la calibrazione
   del match-cut e spostarla in mezzo a una revisione non vale il
   rischio. È la semplificazione naturale dello step 07. */
window.FRAMESEQ = function(canvas, opts){
  const n    = opts.count;
  const path = opts.path;
  const ctx  = canvas ? canvas.getContext('2d') : null;
  const img  = new Array(n).fill(null);
  let drawn  = -1, avviato = false;

  function carica(i){
    const im = new Image();
    im.onload = ()=>{ img[i] = im; if(drawn === i) drawn = -1; };
    im.src = path(i);
  }
  function preload(){
    if(avviato) return; avviato = true;
    for(let i=0;i<n;i++) setTimeout(()=>carica(i), i*10);
  }
  function vicino(i){
    if(img[i]) return img[i];
    for(let d=1; d<n; d++){
      if(img[i-d]) return img[i-d];
      if(img[i+d]) return img[i+d];
    }
    return null;
  }
  /* progresso 0…1 → fotogramma disegnato in cover */
  function draw(p, force){
    if(!ctx) return;
    const i = Math.max(0, Math.min(n-1, Math.round(p * (n-1))));
    if(!force && i === drawn) return;
    const im = vicino(i);
    if(!im) return;
    const dpr = Math.min(devicePixelRatio||1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if(!cw || !ch) return;
    if(canvas.width !== Math.round(cw*dpr) || canvas.height !== Math.round(ch*dpr)){
      canvas.width = Math.round(cw*dpr); canvas.height = Math.round(ch*dpr);
      drawn = -1;
    }
    const s = Math.max(cw/im.width, ch/im.height);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0,0,cw,ch);
    ctx.drawImage(im, (cw-im.width*s)/2, (ch-im.height*s)/2, im.width*s, im.height*s);
    drawn = i;
  }
  return { preload, draw, get pronto(){ return !!img[0]; } };
};

window.SEQ = (function(){

  const FRAME_COUNT = 240;
  /* dal render: FOOTPRINT Z_TOP=1627.7m lens=200mm frazione=0.600 */
  const FOOTPRINT = { cx:.500, cy:.500, frac:.600 };
  const SVG_RING  = 2.0 / 2.4;      /* anello esterno / viewBox del marchio */

  const framePath = i => `assets/frames/f_${String(i+1).padStart(3,'0')}.webp`;

  const canvas = document.getElementById('seq');
  const ctx    = canvas ? canvas.getContext('2d') : null;

  const images = new Array(FRAME_COUNT).fill(null);
  const state  = {
    ready:false, loadFailed:false, disabled:false, shown:false,
    target:0, prog:0, drawn:-1, lastTick:0,
    readyCbs:[]
  };

  /* ── caricamento progressivo ─────────────────────────────── */
  function loadFrame(i, cb){
    const im = new Image();
    im.onload  = ()=>{ images[i] = im; if(cb) cb(true); if(state.shown) draw(true); };
    im.onerror = ()=>{ if(cb) cb(false); };
    im.src = framePath(i);
  }

  function startLoading(){
    if(!canvas) return;
    loadFrame(0, ok=>{
      state.ready = true;
      state.loadFailed = !ok;
      state.readyCbs.splice(0).forEach(f=>f());
      if(ok){
        sizeLogoMorph();
        for(let i=1;i<FRAME_COUNT;i++) setTimeout(()=>loadFrame(i), i*12);
      }
    });
  }

  function whenReady(cb, timeout){
    if(state.ready) return cb();
    state.readyCbs.push(cb);
    if(timeout) setTimeout(()=>{
      const k = state.readyCbs.indexOf(cb);
      if(k>-1){ state.readyCbs.splice(k,1); cb(); }
    }, timeout);
  }

  /* ── disegno (cover) ─────────────────────────────────────── */
  function nearest(i){
    if(images[i]) return images[i];
    for(let d=1; d<FRAME_COUNT; d++){
      if(images[i-d]) return images[i-d];
      if(images[i+d]) return images[i+d];
    }
    return null;
  }

  function metrics(im){
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const s  = Math.max(cw/im.width, ch/im.height);
    return { cw, ch, s,
             dx:(cw - im.width *s)/2,
             dy:(ch - im.height*s)/2 };
  }

  function draw(force){
    if(!ctx || state.loadFailed || state.disabled) return;
    const idx = Math.round(state.prog);
    if(!force && idx === state.drawn) return;
    const im = nearest(idx);
    if(!im) return;
    const dpr = Math.min(devicePixelRatio||1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if(canvas.width !== Math.round(cw*dpr) || canvas.height !== Math.round(ch*dpr)){
      canvas.width = Math.round(cw*dpr); canvas.height = Math.round(ch*dpr);
    }
    const m = metrics(im);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, m.dx, m.dy, im.width*m.s, im.height*m.s);
    state.drawn = idx;

    if(DEBUG) drawDebugRing(m, im);
  }

  /* ── morph: dove sta l'anello del frame 1 sullo schermo ──── */
  function frameToScreen(){
    const im = images[0] || { width:1536, height:864 };
    const m  = metrics(im);
    const diam = im.height * m.s * FOOTPRINT.frac;
    return {
      cx: m.dx + im.width *m.s * FOOTPRINT.cx,
      cy: m.dy + im.height*m.s * FOOTPRINT.cy,
      diam
    };
  }

  function sizeLogoMorph(){
    const el = document.querySelector('.logo-morph');
    if(!el || !canvas) return;
    const r = frameToScreen();
    const box = r.diam / SVG_RING;        /* l'anello è 2.0/2.4 dell'SVG */
    el.style.width = el.style.height = box + 'px';
    el.style.left = (r.cx - box/2) + 'px';
    el.style.top  = (r.cy - box/2) + 'px';
  }

  const DEBUG = new URLSearchParams(location.search).has('debug');
  function drawDebugRing(m, im){
    const r = frameToScreen();
    ctx.strokeStyle = 'rgba(255,0,80,.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.cx, r.cy, r.diam/2, 0, Math.PI*2);
    ctx.stroke();
  }

  /* ── loop: lerp del progresso ────────────────────────────── */
  let raf = null;
  function loop(){
    state.lastTick = performance.now();
    state.prog += (state.target - state.prog) * .16;
    if(Math.abs(state.target - state.prog) < .02) state.prog = state.target;
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* se il rAF è fermo (tab in background, webview), si disegna
     direttamente sull'evento di scroll, senza lerp */
  function tick(){
    if(performance.now() - state.lastTick > 250){
      state.prog = state.target;
      draw();
    }
  }

  function seek(i){
    state.target = state.prog = Math.max(0, Math.min(FRAME_COUNT-1, i));
    draw(true);
  }

  function show(){
    state.shown = true;
    draw(true);
    if(!raf && !matchMedia('(prefers-reduced-motion:reduce)').matches){
      raf = requestAnimationFrame(loop);
    }
  }

  addEventListener('resize', ()=>{ sizeLogoMorph(); if(state.shown) draw(true); });

  /* ═══════════════ Coreografia di scroll ═══════════════════ */

  const root = document.documentElement;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  /* rimappa v da [a,b] a [0,1]: il mattoncino con cui si scandiscono
     più eventi dentro un unico trigger */
  const mp = (a,b,v) => clamp01((v - a) / (b - a));

  /* I diagrammi si montano una volta sola e non per ramo di
     matchMedia: al cambio di media query GSAP smonta i tween, non
     i canvas né i listener di resize. */
  let DIA = [];
  function mountDiagrams(){
    if(DIA.length || !window.DIAGRAMS) return;
    DIA = [...document.querySelectorAll('.case-card__dia')]
      .map(c => DIAGRAMS.mount(c, c.parentElement.dataset.dia));

    /* Il disegno tecnico della sezione 5 (img-15) usa lo stesso motore
       delle card, ma è statico: si disegna intero e già desaturato, e
       l'unico colore che resta è il suo quadratino arancione fermo. */
    document.querySelectorAll('.duo__dia, .cerniera__dia').forEach(c=>{
      DIAGRAMS.mount(c, c.dataset.dia).draw(1, 1);
    });
  }

  /* ── la virata notte ↔ cemento ───────────────────────────
     Una sola manopola CSS (--t) muove fondo, testi, righelli e
     bordi insieme; qui la si scrubba dove le sezioni lo chiedono.
     Dichiarativo: sta tutto negli attributi data-flip dell'HTML,
     così l'ordine dei temi si legge dal markup e non da qui. */
  /* L'interfaccia di bordo (logo, nav, micro-etichette) commuta di
     netto a metà virata invece di attraversare i grigi intermedi,
     dove avrebbe lo stesso valore del fondo e sparirebbe. */
  let chromeLight = false;
  function setChrome(t){
    const now = t > .5;
    if(now === chromeLight) return;
    chromeLight = now;
    document.body.classList.toggle('is-light', now);
  }

  /* Le tappe della virata, in ordine di pagina. Le riempie initTheme
     leggendo gli attributi data-flip; initCases ne aggiunge una che
     vive *dentro* la sezione delle card. */
  const stops = [];

  /* Un solo scrittore per --t.
     Prima erano tre tween GSAP indipendenti sullo stesso custom
     property: tutti fermi al proprio estremo, e chi rendeva per
     ultimo vinceva — a fondo pagina restava il cemento invece della
     notte. Qui è la posizione a decidere il valore, sempre, senza
     dipendere dall'ordine con cui GSAP rende le animazioni. */
  /* stepped: senza scrub (mobile, reduced-motion) la virata non si
     può seguire col dito, quindi scatta al superamento della tappa e
     la ammorbidisce una transition CSS su --t. */
  let stepped = false;

  /* A scatti le soglie non sono quelle del desktop: lì start ed end
     sono tarati su sezioni alte 100vh, mentre su mobile le sezioni
     sono a contenuto e quelle finestre si sovrapporrebbero fra loro.
     Serve un punto solo e uguale per tutti — la sezione entra per tre
     quarti — e le tappe che non hanno una sezione propria (quella
     dentro le card) sul mobile non esistono. */
  function threshold(s){
    return s.el
      ? s.el.getBoundingClientRect().top + scrollY - innerHeight * .3
      : Infinity;
  }

  /* ── il fronte della virata ──────────────────────────────
     In img-13 la transizione non è una dissolvenza: la metà alta
     è già cemento e la metà bassa è ancora notte. Il chiaro cala
     come una tenda. Il fronte è un velo — lo stesso mestiere del
     cases-veil — e NON è una seconda sorgente di verità sui
     colori: si spegne appena la virata è compiuta, quando il suo
     colore e il fondo della pagina coincidono e lo scambio non si
     vede. Ciò che è elencato in data-flip-curtain viene ritagliato
     al negativo: sopra il fronte c'è il nuovo fondo, sotto c'è
     ancora la scena vecchia. */
  const curtains = [];

  function makeCurtain(sec, stop){
    const casa = document.querySelector('#flipVeils');
    if(!casa) return null;
    const el = document.createElement('i');
    el.className = 'flip-veil';
    el.style.background = stop.to > .5 ? 'var(--paper-l)' : 'var(--paper-d)';
    casa.appendChild(el);   /* in ordine di pagina: l'ultima tenda copre le precedenti */
    const sotto = (sec.dataset.flipCurtain || '')
      .split(',').map(s=>s.trim()).filter(Boolean)
      .reduce((acc, sel)=> acc.concat([...document.querySelectorAll(sel)]), []);
    return {stop, el, sotto};
  }

  function paintCurtains(){
    if(!curtains.length) return;
    const y = scrollY;
    for(const c of curtains){
      const a = c.stop.start(), b = c.stop.end();
      let p;
      /* a scatti (mobile, reduced-motion) la tenda non si può seguire
         col dito: resta il salto, come per il resto della virata */
      if(stepped)      p = y >= threshold(c.stop) ? 1 : 0;
      else if(b <= a)  p = y >= b ? 1 : 0;
      else             p = Math.max(0, Math.min(1, (y - a) / (b - a)));

      /* il velo esiste solo *durante*: a corsa finita il fondo della
         pagina ha già il suo colore e la tenda non serve più */
      c.el.style.opacity = p > 0 && p < 1 ? 1 : 0;
      if(p > 0 && p < 1) c.el.style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0)`;
      c.sotto.forEach(el=>{
        el.style.clipPath = p <= 0 ? '' : `inset(${p * 100}% 0 0 0)`;
      });
    }
  }

  function applyTheme(){
    if(!stops.length) return;
    const y = scrollY;
    /* A scatti l'ordine non è quello di `stops`: quell'array è ordinato
       per il pixel di partenza calcolato da ScrollTrigger, che nasce da
       data-flip-start ('top 130%', 'top 190%'…) tarato su sezioni alte
       100vh. Su mobile le sezioni sono a contenuto e quelle finestre si
       scavalcano fra loro: letto in quell'ordine, il primo `from` era
       quello di una sezione di mezza pagina e la notte iniziale non
       arrivava mai. Con le soglie l'ordine è quello della pagina.
       Le tappe senza elemento (quella dentro le card) sul mobile non
       esistono: threshold() le manda a Infinity e restano in coda. */
    const lista = stepped
      ? stops.slice().sort((a,b)=> threshold(a) - threshold(b))
      : stops;
    let t = lista[0].from;
    for(const s of lista){
      if(stepped){
        if(y < threshold(s)) break;
        t = s.to;
        continue;
      }
      const a = s.start(), b = s.end();
      if(y >= b)      t = s.to;
      else if(y > a)  t = s.from + (s.to - s.from) * ((y - a) / (b - a));
      else            break;
    }
    root.style.setProperty('--t', t);
    setChrome(t);
    paintCurtains();

    /* I filamenti seguono la stessa manopola del resto: chiari sulla
       notte, scuri sul cemento. Prima avevano una finestra propria
       agganciata a #s-piuma, che con la virata spostata sarebbe
       rimasta fuori fase. */
    const feather = window.FX && FX._all && FX._all.feather;
    if(feather) feather.params.onLight = t;
  }

  function initTheme(){

    /* Il testo della sezione uscente si congeda *mentre* il fondo
       gira. Serve: a metà virata il grigio del testo e il grigio
       del fondo si incrociano, e per un istante la scritta
       sparirebbe. Meglio farla uscire di scena apposta. */
    /* Le due nuove coppie sono quelle delle virate spostate: il testo
       della 4 se ne va mentre la tenda cala (in img-13 lo schermo è
       senza testo), e il capitolo della piuma se ne va mentre torna
       la notte. */
    /* Il testo della sezione uscente deve essere GIÀ via quando la
       tenda arriva a metà: in img-13 lo schermo è senza testo. Perciò
       queste due finestre stanno *prima* di quelle della virata, non
       sopra — a cavallo del fronte il titolo resterebbe un fantasma
       grigio su grigio. */
    [['#s-via',       '#s01-arte .sticky',     'top 160%','top 120%'],
     ['#s03-finiture','#s02-struttura .sticky','top 220%','top 175%'],
     ['#s-cerniera',  '#s-piuma .sticky',      'top 185%','top 150%'],
     ['#s-cases',     '#s-cerniera .sticky',   'top bottom','top 78%'],
     ['#s-perche',    '#s-cantieri .sticky',   'top bottom','top 78%']]
      .forEach(([entra, esce, start, end])=>{
        if(!document.querySelector(esce) || !document.querySelector(entra)) return;
        gsap.to(esce, {
          autoAlpha:0, ease:'none', immediateRender:false,
          scrollTrigger:{trigger:entra, start, end, scrub:true}
        });
      });

    document.querySelectorAll('[data-flip]').forEach(sec=>{
      const to   = parseFloat(sec.dataset.flip);
      const from = parseFloat(sec.dataset.flipFrom ?? (1 - to));
      /* trigger senza animazione: serve solo a farsi calcolare da
         ScrollTrigger i pixel di inizio e fine, sintassi compresa */
      const st = ScrollTrigger.create({
        trigger:sec,
        start: sec.dataset.flipStart || 'top 80%',
        end:   sec.dataset.flipEnd   || 'top 35%'
      });
      const stop = {el:sec, from, to, start:()=>st.start, end:()=>st.end};
      stops.push(stop);
      if(sec.hasAttribute('data-flip-curtain')){
        const c = makeCurtain(sec, stop);
        if(c) curtains.push(c);
      }
    });
    stops.sort((a,b)=> a.start() - b.start());

    ScrollTrigger.create({start:0, end:'max', onUpdate:applyTheme, onRefresh:applyTheme});
    applyTheme();
  }

  /* ── la piuma diventa un capitolo ────────────────────────
     Non più un fondo che sfuma e basta: entra quando il viaggio
     della camera si è fermato, tiene la scena mentre la notte vira
     a cemento, e si congeda alla cerniera. */
  function initPiuma(){
    gsap.fromTo('#fx', {autoAlpha:0}, {
      autoAlpha:1, ease:'none',
      scrollTrigger:{ trigger:'#s-via', start:'top 90%', end:'top 20%', scrub:true }
    });

    /* Il fondo cinematico non si spegne più con una dissolvenza qui:
       lo ritaglia la tenda della virata (`data-flip-curtain` su
       #s03-finiture), che lo mangia dall'alto mentre il cemento cala.
       Sopra i render il cemento non potrebbe farsi vedere, e con la
       virata spostata una sezione più su questa dissolvenza sarebbe
       arrivata troppo tardi. I filamenti seguono --t in applyTheme. */

    gsap.fromTo('#fx', {autoAlpha:1}, {
      autoAlpha:0, ease:'none', immediateRender:false,
      scrollTrigger:{ trigger:'#s-cerniera', start:'top 55%', end:'bottom bottom', scrub:true }
    });
  }

  /* ── il mattone: un solo movimento su tre capitoli ───────
     Scende lungo la 4 e la 5 e si schianta nella 6, che è l'arco
     della reference (img-19 → img-22) con un impatto al posto di
     un appoggio. Le tre sezioni non hanno tre animazioni: hanno
     tre finestre sullo stesso movimento, e siccome se ne vede una
     per volta il risultato è continuo.
     Il valore lo passa `--t`, la stessa manopola del tema: così
     l'inversione chiaro↔scuro dell'oggetto non può andare fuori
     fase col fondo su cui poggia. */
  function initBrick(){
    if(!window.BRICK) return;
    /* Nei capitoli A e B l'oggetto è PRESENTE E FERMO, in due assetti
       diversi — è quello che fa la reference (img-10 e img-15: la piuma
       c'è, sospesa, e fra l'una e l'altra ha solo ruotato). La caduta
       succede nel capitolo C. Spalmare i 120 fotogrammi su tutti e tre
       darebbe 117 px per frame: la sequenza si vedrebbe a scatti. */
    const fermi = [
      ['#s02-struttura .duo__oggetto', 0.06],
      ['#s03-finiture .duo__oggetto',  0.26]
    ];
    let montati = 0;
    fermi.forEach(([sel, f])=>{
      const el = document.querySelector(sel);
      if(el && BRICK.monta(el, f, f)) montati++;
    });
    const cadutaEl = document.querySelector('#s-piuma .piuma__oggetto');
    const caduta = cadutaEl && BRICK.monta(cadutaEl, 0, 1);
    if(caduta) montati++;
    if(!montati) return;
    BRICK.preload();

    const luce = ()=> parseFloat(
      getComputedStyle(root).getPropertyValue('--t')) || 0;

    /* I due fermi si disegnano una volta e seguono solo il valore. */
    ScrollTrigger.create({
      trigger:'#s02-struttura', start:'top bottom',
      endTrigger:'#s03-finiture', end:'bottom bottom',
      scrub:true, invalidateOnRefresh:true,
      onUpdate(){ BRICK.draw(0, luce()); },
      onRefresh(){ BRICK.draw(0, luce()); }
    });

    /* La caduta occupa il primo 70% del capitolo C: 6.480 × 0,7 / 120 =
       38 px per fotogramma, dentro la banda 25-45. Il resto della
       sezione il mattone sta fermo mentre il titolo finisce di
       accendersi — che è anche la coreografia giusta. */
    if(caduta){
      ScrollTrigger.create({
        trigger:'#s-piuma', start:'top top', end:'70% top',
        scrub:true, invalidateOnRefresh:true,
        onUpdate(self){ caduta.ultimo = self.progress; BRICK.draw(self.progress, luce()); },
        onRefresh(self){ BRICK.draw(self.progress, luce()); }
      });

      /* Il congedo: l'oggetto non esce di scena, si sfalda nel campo di
         filamenti — è quello che fa la piuma della reference, che si
         dissolve nelle piume di secondo piano invece di sparire (img-10).
         Due manopole gemelle sulla stessa corsa: l'opacità dell'oggetto
         scende mentre la sfaldatura sale.

         La finestra è 62% → 78% dell'altezza della sezione, non 85% →
         fondo: lo sticky si stacca a (altezza − 100vh), cioè all'83,3%
         di una sezione da 600vh, e tutto quello che sta oltre cade fuori
         dalla parte visibile. Sta anche *prima* della tenda che riporta
         la notte per la cerniera (che scatta attorno all'87%): il
         congedo deve compiersi su un fondo solo, non a cavallo del
         fronte. Il faretto nel frattempo è sulle ultime due righe. */
      const feather = ()=> window.FX && FX._all && FX._all.feather;
      /* il centro si misura solo mentre la sezione è in vista: al
         refresh sta ancora sotto la piega e darebbe coordinate assurde */
      const centro = ()=>{
        const f = feather(); if(!f || !cadutaEl) return;
        const r = cadutaEl.getBoundingClientRect();
        if(!r.width || !innerWidth) return;
        /* il mattone posato sta al centro-basso del suo riquadro */
        f.params.sfaldaX = (r.left + r.width * .5) / innerWidth;
        f.params.sfaldaY = Math.max(0, Math.min(1,
                             (r.top + r.height * .80) / innerHeight));
      };
      ScrollTrigger.create({
        trigger:'#s-piuma', start:'62% top', end:'78% top',
        scrub:true, invalidateOnRefresh:true,
        onUpdate(self){
          const f = feather(); if(!f) return;
          centro();
          f.params.sfalda = self.progress;
          BRICK.opacita(1 - self.progress);
        }
      });
    }
  }

  /* Senza scrub il mattone non può cadere: lo si posa già arrivato,
     con le crepe aperte. La sezione resta leggibile e l'oggetto sta
     nella sua posizione finale, che è quello che serve. */
  function posaMattone(){
    if(!window.BRICK) return;
    /* senza scrub non c'è congedo: se si arriva qui da un ridimensionamento
       a metà sfaldatura, il velo va rimesso a 1 o il mattone resta invisibile */
    BRICK.opacita(1);
    if(!BRICK.slot.length){
      ['#s02-struttura .duo__oggetto','#s03-finiture .duo__oggetto',
       '#s-piuma .piuma__oggetto'].forEach(sel=>{
        const el = document.querySelector(sel);
        if(el) BRICK.monta(el, 0, 1);
      });
      BRICK.preload();
    }
    const luce = parseFloat(getComputedStyle(root).getPropertyValue('--t')) || 0;
    /* i frame arrivano in differita: si ridipinge quando ci sono */
    const dipingi = ()=> BRICK.draw(1, luce);
    dipingi();
    setTimeout(dipingi, 400);
    setTimeout(dipingi, 1600);
  }

  /* ── le due card: disegno → desaturazione → apertura ─────
     Un unico trigger scandisce le tre transizioni in sequenza.
     Il velo è un rettangolo fisso ritagliato sulla prima card e
     dello stesso colore: crescendo *è* la card che si apre, e
     quando arriva a pieno schermo coincide col cemento della
     pagina, che nel frattempo è virato. */
  function initCases(){
    const sec  = document.querySelector('#s-cases');
    const veil = document.querySelector('#casesVeil');
    if(!sec || !veil || !window.DIAGRAMS) return;

    const cards = [...sec.querySelectorAll('.case-card')];
    const guts  = sec.querySelectorAll('.case-card__t, .case-card__ft, .case-card__dia');

    /* Il ritaglio si misura *dentro* lo sticky, non sul viewport:
       onRefresh la sezione è ancora sotto la piega e la card avrebbe
       coordinate assurde. Lo sticky è alto 100vh e largo quanto la
       finestra, quindi mentre è incollato le sue percentuali interne
       *sono* quelle del viewport. */
    const stick = sec.querySelector('.sticky');
    let box = {t:40, r:40, b:40, l:40};
    const measure = ()=>{
      const s = stick.getBoundingClientRect();
      const r = cards[0].getBoundingClientRect();
      if(!r.width || !s.width) return;
      box = {
        t: (r.top  - s.top ) / s.height * 100,
        r: (s.right  - r.right ) / s.width  * 100,
        b: (s.bottom - r.bottom) / s.height * 100,
        l: (r.left - s.left) / s.width  * 100
      };
    };

    const master = ScrollTrigger.create({
      trigger:sec, start:'top top', end:'bottom bottom',
      scrub:true, invalidateOnRefresh:true,
      onRefresh:measure,
      onUpdate(self){
        const v = self.progress;

        /* 1 · il tratto ARRIVA COMPLETO e si smonta scorrendo — è il
           contrario di prima, ed è la lamentela più netta del
           committente: «LE FIGURE ARRIVANO GIÀ COMPLETE ED È SCORRENDO
           CHE SI SMONTANO». Il motore di disegno non cambia: cambia il
           verso con cui lo si interroga. */
        const p = 1 - mp(.12, .58, v);
        const d = mp(.45, .78, v);
        DIA.forEach(dia => dia.draw(p, d));

        /* 2 · la card si apre e la notte vira a cemento */
        const e = mp(.55, 1, v);
        const k = 1 - e;
        veil.style.opacity  = e > 0 && v < .999 ? 1 : 0;
        veil.style.clipPath = `inset(${box.t*k}% ${box.r*k}% ${box.b*k}% ${box.l*k}%)`;

        /* 3 · il contenuto delle card lascia il campo */
        gsap.set(guts,     {autoAlpha: 1 - mp(.60, .84, v)});
        gsap.set(cards[1], {autoAlpha: 1 - mp(.55, .78, v)});
      }
    });

    /* La virata che accompagna l'apertura non la scrive questa
       funzione: entra nella lista delle tappe come tutte le altre,
       espressa come frazione della corsa della sezione. Così esiste
       un solo scrittore di --t in tutto il sito. */
    const span = ()=> master.end - master.start;
    stops.push({
      from:0, to:1,
      start:()=> master.start + span()*.58,
      end:  ()=> master.start + span()*.95
    });
    stops.sort((a,b)=> a.start() - b.start());
  }

  function initScroll(){
    if(!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    /* ── desktop: esperienza piena ── */
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', ()=>{

      /* master: il viaggio si compie tra la hero e la fine della 01 —
         corsa breve = camera rapida. Poi i frame restano fermi
         sull'ultimo e sopra entra la piuma (come nel reference). */
      ScrollTrigger.create({
        trigger:'#hero-spacer', start:'top top',
        endTrigger:'#s01-arte', end:'bottom bottom',
        onUpdate(self){ state.target = self.progress * (FRAME_COUNT-1); tick(); }
      });

      /* La hero si congeda: titolo, lockup e angoli scivolano via.
         fromTo esplicito + immediateRender:false perché scroll.js gira
         *prima* di hero.js: un `to` catturerebbe come stato iniziale
         l'opacità 0 di .is-intro e animerebbe da 0 a 0, lasciando la
         hero vuota per sempre. Vale anche per i due tween qui sotto. */
      gsap.fromTo(['.hero','.lockup','.corner'], {autoAlpha:1, y:0}, {
        autoAlpha:0, y:-40, ease:'none', immediateRender:false,
        scrollTrigger:{ trigger:'#hero-spacer', start:'40% top', end:'90% top', scrub:true }
      });

      initPiuma();
      initBrick();
      initCases();

      /* gallerie orizzontali (sticky CSS + scrub sulla track):
         cantieri e timeline della storia usano lo stesso pattern */
      /* Le track orizzontali. Le gallerie ENTRANO DA DESTRA: partono
         fuori campo e la prima card arriva scorrendo, così a sinistra
         resta il bordo della precedente col suo contatore — è la
         differenza fra la reference «che ci arriva piano» e il sito che
         «parte già così». La storia invece parte a filo, com'era. */
      [['#s-cantieri','.cases-track', true],
       ['#s-ristrutturazioni','.cases-track', true],
       ['#s-storia','.storia-track', false]].forEach(([sec, sel, daDestra])=>{
        const sezione = document.querySelector(sec);
        const track = sezione && sezione.querySelector(sel);
        if(!track) return;
        const da = ()=> daDestra ? innerWidth * .34 : 0;
        const a  = ()=> -(track.scrollWidth - innerWidth) - (daDestra ? innerWidth * .06 : 0);
        gsap.fromTo(track, {x: da}, {
          x: a, ease:'none',
          scrollTrigger:{ trigger:sec, start:'top top', end:'bottom bottom',
                          scrub:true, invalidateOnRefresh:true }
        });

        /* Il nome in alto cambia con la card che passa davanti al centro.
           Non è un'animazione: è una lettura della posizione, quindi
           torna indietro come tutto il resto.
           Si misura la card più vicina alla mezzeria dello schermo, non
           si divide il progresso in fette uguali: le fette davano il nome
           della card sbagliata, perché la track entra da destra e la
           corsa non è distribuita fra le carte in parti uguali. */
        /* querySelector('') lancia: la storia non ha un nome in alto */
        const sel_nome = track.dataset.nomeOut;
        const uscita = sel_nome ? document.querySelector(sel_nome) : null;
        const carte  = [...track.querySelectorAll('.case')];
        if(uscita && carte.length){
          ScrollTrigger.create({
            trigger:sec, start:'top top', end:'bottom bottom', scrub:true,
            onUpdate(){
              const mezzo = innerWidth / 2;
              let vicina = carte[0], min = Infinity;
              for(const c of carte){
                const r = c.getBoundingClientRect();
                const d = Math.abs(r.left + r.width/2 - mezzo);
                if(d < min){ min = d; vicina = c; }
              }
              const nome = vicina.dataset.nome || '';
              if(uscita.textContent !== nome) uscita.textContent = nome;
            }
          });
        }
      });
    });

    /* ── mobile: niente scrub né apertura, ma i temi restano ──
       Le sezioni chiare devono restare chiare anche senza scrub:
       --t si commuta a gradini all'ingresso di ogni sezione. */
    mm.add('(max-width: 900px)', ()=>{
      state.disabled = true;               /* il canvas frame non si usa */
      if(canvas) gsap.set(canvas, {display:'none'});
      document.querySelectorAll('.bg__still').forEach((im,i)=>{
        gsap.to(im, {
          autoAlpha:1,
          scrollTrigger:{ trigger:['#hero-spacer','#s01-arte','#s-cerniera'][i] || '#hero-spacer',
                          start:'top 60%', toggleActions:'play none none reverse' }
        });
      });
      /* la virata la guida sempre applyTheme, qui a scatti */
      stepped = true;
      root.classList.add('is-stepped');
      applyTheme();
      DIA.forEach(d => d.draw(1, 0));
      posaMattone();
      gsap.set(['.hero','.lockup','.corner'], {clearProps:'all'});
      return ()=>{ state.disabled = false; if(state.shown) draw(true); };
    });

    /* ── reduced-motion: tutto leggibile, niente scrub né pin ── */
    mm.add('(prefers-reduced-motion: reduce)', ()=>{
      state.target = FRAME_COUNT-1; state.prog = FRAME_COUNT-1;
      draw(true);
      DIA.forEach(d => d.draw(1, 0));
      stepped = true;                       /* niente virata scrubbata */
      applyTheme();
      posaMattone();
    });
  }

  /* filtro della sezione servizi (chip → card) */
  function initFiltro(){
    const chips = document.querySelectorAll('#s-servizi .chip');
    const cards = document.querySelectorAll('#s-servizi .svc');
    chips.forEach(chip=>{
      chip.addEventListener('click', ()=>{
        chips.forEach(c=>c.classList.toggle('is-active', c===chip));
        const f = chip.dataset.filter;
        cards.forEach(card=>{ card.hidden = f !== 'all' && card.dataset.cat !== f; });
        if(window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
  }

  function init(){
    startLoading();
    mountDiagrams();
    if(window.gsap && window.ScrollTrigger){
      gsap.registerPlugin(ScrollTrigger);
      initTheme();        /* le tappe valgono su tutti i formati */
    }
    initScroll();

    /* La tipografia si monta una volta sola, fuori da matchMedia:
       lo split del testo è una modifica al DOM, e matchMedia sa
       smontare i tween ma non rimettere insieme le parole. */
    const page = document.getElementById('page');
    if(window.TYPE && page){
      matchMedia('(prefers-reduced-motion:reduce)').matches
        ? TYPE.settle(page)
        : TYPE.init(page);
    }

    initFiltro();
    sizeLogoMorph();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { whenReady, show, seek, sizeLogoMorph, frameToScreen,
           get ready(){ return state.ready; },
           get failed(){ return state.loadFailed; } };

})();
