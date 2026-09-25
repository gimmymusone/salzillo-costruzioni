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
/* ── coda di caricamento condivisa ──────────────────────────
   Online i frame arrivano dalla rete: sparare ~1000 richieste
   insieme metteva la torre in fila dietro al mattone, e lo scrub
   saltava sui buchi. Qui: ogni URL si scarica UNA volta sola
   (i tre slot del mattone condividono gli stessi file), al massimo
   MAX richieste in volo, e la priorità 0 (torre) passa sempre
   davanti alla 1 (mattone) e alla 2 (le silhouette del primo piano,
   che arrivano per ultime: senza, il titolo resta semplicemente
   davanti, ed è una mancanza che non si nota). */
window.CODA = (function(){
  const MAX = 6;
  const cache = new Map();          /* url → {im, fatto, ok, cbs} */
  const file  = [[], [], []];
  let attivi  = 0;

  function pompa(){
    while(attivi < MAX){
      const url = file[0].shift() || file[1].shift() || file[2].shift();
      if(!url) return;
      attivi++;
      const e  = cache.get(url);
      e.partito = true;
      const im = new Image();
      const fine = ok=>{
        attivi--;
        e.fatto = true; e.ok = ok; e.im = ok ? im : null;
        e.cbs.splice(0).forEach(cb=>cb(e.im));
        pompa();
      };
      im.onload  = ()=>fine(true);
      im.onerror = ()=>fine(false);
      im.src = url;
    }
  }

  /* prio < 0: URGENTE, passa davanti a tutta la coda (anche a un file
     già in coda ma non ancora partito). Serve al fotogramma del mattone
     che si vede per primo sul telefono: in fondo alla coda arrivava
     dopo tutta la torre, e al primo scroll si vedeva solo l'ombra. */
  function prendi(url, prio, cb){
    let e = cache.get(url);
    if(e){
      if(e.fatto) cb(e.im); else e.cbs.push(cb);
      if(!e.fatto && prio < 0){
        file.forEach(f=>{ const k = f.indexOf(url); if(k > -1) f.splice(k, 1); });
        if(!e.partito){ file[0].unshift(url); pompa(); }
      }
      return;
    }
    cache.set(url, e = {im:null, fatto:false, ok:false, cbs:[cb]});
    if(prio < 0) file[0].unshift(url);
    else file[Math.min(Math.max(prio|0, 0), file.length - 1)].push(url);
    pompa();
  }

  /* dal grosso al fine: prima un fotogramma ogni 16, poi ogni 8, 4,
     2, 1. Dopo pochi file lo scrub copre già tutta la corsa (a scatti
     larghi) e si infittisce mentre scorri, invece di avere metà
     sequenza nitida e l'altra metà vuota. */
  function ordine(n){
    const out = [], visto = new Uint8Array(n);
    [16, 8, 4, 2, 1].forEach(passo=>{
      for(let i=0;i<n;i+=passo) if(!visto[i]){ visto[i]=1; out.push(i); }
    });
    if(!visto[n-1]) out.push(n-1);
    return out;
  }

  return { prendi, ordine };
})();

/* Pixel per punto dei canvas. Sul desktop resta il tetto di 2; sul
   telefono si va fino a 3 (iPhone): a 2 il canvas veniva poi ingrandito
   dal browser di 1,5 volte e tutto risultava sfocato (committente,
   2026-09-25: «si vede molto sfocato»). */
const densita = ()=> Math.min(devicePixelRatio || 1,
  matchMedia('(max-width: 900px)').matches ? 3 : 2);

window.FRAMESEQ = function(canvas, opts){
  const n    = opts.count;
  const path = opts.path;
  const ctx  = canvas ? canvas.getContext('2d') : null;
  const img  = new Array(n).fill(null);
  let drawn  = -1, avviato = false;

  /* filtro: quali fotogrammi servono davvero (sul telefono il mattone
     ne usa uno su due, e solo dal momento in cui è intero) */
  const arrivato = i => im=>{
    if(!im) return;
    img[i] = im;
    drawn = -1;      /* un vicino più preciso può essere appena arrivato */
  };
  function preload(filtro){
    if(avviato) return; avviato = true;
    CODA.ordine(n).filter(i => !filtro || filtro(i))
      .forEach(i=>CODA.prendi(path(i), 1, arrivato(i)));
  }
  /* un fotogramma davanti a tutta la coda */
  function anticipa(p){
    const i = Math.max(0, Math.min(n-1, Math.round(p * (n-1))));
    CODA.prendi(path(i), -1, arrivato(i));
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
    const dpr = densita();
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
  return { preload, anticipa, draw, get pronto(){ return !!img[0]; } };
};

window.SEQ = (function(){

  const FRAME_COUNT = 240;
  /* dal render: FOOTPRINT Z_TOP=1627.7m lens=200mm frazione=0.600 */
  const FOOTPRINT = { cx:.500, cy:.500, frac:.600 };
  const SVG_RING  = 2.0 / 2.4;      /* anello esterno / viewBox del marchio */

  const framePath = i => `assets/frames/f_${String(i+1).padStart(3,'0')}.webp`;

  /* Il palazzo in primo piano. Le silhouette esistono solo per il
     tratto in cui il titolo è a schermo (si congeda al 90% di
     #hero-spacer, cioè intorno al frame 107): oltre, il canvas davanti
     non ha più niente da fare e si spegne da solo. Renderizzate dal
     MODE=matte di assets/3d/render_orbit.py, stessa camera dei frame a
     colori — è quello che le fa combaciare al pixel. */
  const MATTE_COUNT = 120;
  /* La versione nell'indirizzo non è un vezzo: le silhouette sono già
     state rifatte due volte tenendo gli stessi nomi, e il browser
     continuava a servire le vecchie dalla cache senza dare segno —
     si vedeva il difetto di ieri su un file corretto oggi. Rifatte le
     matte, si alza questo numero. */
  const MATTE_VER = 7;
  const mattePath = i => `assets/matte/f_${String(i+1).padStart(3,'0')}.webp?v=${MATTE_VER}`;

  const canvas = document.getElementById('seq');
  const ctx    = canvas ? canvas.getContext('2d') : null;
  const front  = document.getElementById('seqFront');
  const fctx   = front ? front.getContext('2d') : null;

  const images = new Array(FRAME_COUNT).fill(null);
  const mattes = new Array(MATTE_COUNT).fill(null);
  const state  = {
    ready:false, loadFailed:false, disabled:false, shown:false,
    target:0, prog:0, drawn:-1, lastTick:0, bucoFirma:'',
    readyCbs:[]
  };

  /* ── caricamento progressivo ─────────────────────────────── */
  function loadFrame(i, cb){
    CODA.prendi(framePath(i), 0, im=>{
      if(im){ images[i] = im; if(state.shown) draw(true); }
      if(cb) cb(!!im);
    });
  }

  /* Il preloader aspetta il primo frame E la passata grossa (uno ogni
     8 = 30 file, ~650 KB): così all'uscita dell'intro la discesa ha
     già la sua forma intera. Il resto si infittisce in coda. */
  const PASSATA = 8;

  function startLoading(){
    if(!canvas) return;
    /* Dal 2026-09-25 la torre si muove anche sul telefono (scelta del
       committente): la coda dei frame e delle silhouette è la stessa
       del desktop su tutti i formati. */
    const pronto = ()=>{
      if(state.ready) return;
      state.ready = true;
      state.readyCbs.splice(0).forEach(f=>f());
    };
    /* tutta la torre va in coda SUBITO, prima che il mattone
       (priorità 1) trovi slot liberi mentre arriva il primo frame */
    /* Sul telefono un fotogramma su due (e la sua silhouette): metà dei
       file e dei byte, e sulla corsa corta del telefono lo scrub resta
       fluido — 2026-09-25, «aumenta anche la velocità». L'ultimo c'è
       sempre, è quello su cui la sequenza si ferma. */
    const meta = stretto.matches;
    const serve = i => !meta || i % 2 === 0 || i === FRAME_COUNT - 1;
    const ordine = CODA.ordine(FRAME_COUNT).filter(i => i && serve(i));
    /* +1: la silhouette del primo fotogramma. Senza, sul telefono (rete
       più lenta) l'intro partiva col titolo DAVANTI al palazzo e solo
       dopo un bel po' gli passava dietro (committente, 2026-09-25). */
    let mancano = 2 + ordine.filter(i=>i % PASSATA === 0).length;
    const segna = ()=>{ if(--mancano === 0) pronto(); };
    const prendiMatte = (i, cb)=> CODA.prendi(mattePath(i), 0, im=>{
      if(im){ mattes[i] = im; if(state.shown) draw(true); }
      if(cb) cb();
    });
    loadFrame(0, ok=>{
      state.loadFailed = !ok;
      if(ok) sizeLogoMorph(); else return pronto();
      segna();
    });
    prendiMatte(0, segna);
    /* Ogni silhouette va in coda subito dopo il SUO fotogramma, con la
       stessa priorità: prima stavano in fondo (priorità 2), dopo tutti i
       240 frame e il mattone, e il titolo restava davanti al palazzo per
       tutto quel tempo. */
    ordine.forEach(i=>{
      loadFrame(i, ()=>{ if(i % PASSATA === 0) segna(); });
      if(i < MATTE_COUNT) prendiMatte(i);
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
  /* Restituisce l'INDICE del frame disegnato, non solo l'immagine: il
     primo piano deve ritagliare con la silhouette DI QUEL fotogramma.
     Con una vicina i contorni non combacerebbero e si vedrebbe una
     seconda torre sfalsata di qualche pixel. */
  function nearestIdx(i){
    /* Nei fotogrammi che hanno una silhouette si preferisce il più
       vicino che ce l'ha GIÀ: un fotogramma senza la sua silhouette
       disegnerebbe il titolo davanti al palazzo, e un fotogramma vicino
       si nota molto meno di un titolo che salta davanti e dietro. */
    const pieno = k => images[k] && (k >= MATTE_COUNT || mattes[k]);
    if(pieno(i)) return i;
    for(let d=1; d<FRAME_COUNT; d++){
      if(i-d >= 0 && pieno(i-d)) return i-d;
      if(i+d < FRAME_COUNT && pieno(i+d)) return i+d;
    }
    if(images[i]) return i;
    for(let d=1; d<FRAME_COUNT; d++){
      if(images[i-d]) return i-d;
      if(images[i+d]) return i+d;
    }
    return -1;
  }

  /* Sul telefono in verticale si vede un terzo della larghezza del
     frame, e nell'ultimo tratto della discesa la torre scivola a
     sinistra (dal 50% al 30% del frame): con l'inquadratura centrata
     usciva dallo schermo. Qui la finestra la insegue (2026-09-25).
     Punti misurati sui frame 1…240; al frame 0 resta il centro, così
     il marchio che diventa torre combacia ancora. Solo sotto i 900px:
     sul desktop il taglio laterale è di pochi pixel e non si tocca. */
  const FUOCO = [[0,.50],[170,.50],[200,.41],[240,.30]];
  const stretto = matchMedia('(max-width: 900px)');
  function fuoco(i){
    for(let k=1; k<FUOCO.length; k++){
      const [a, fa] = FUOCO[k-1], [b, fb] = FUOCO[k];
      if(i <= b) return fa + (fb - fa) * clamp01((i - a) / (b - a));
    }
    return FUOCO[FUOCO.length-1][1];
  }

  function metrics(im, i){
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const s  = Math.max(cw/im.width, ch/im.height);
    let dx = (cw - im.width*s)/2;
    if(stretto.matches && i){
      dx = cw/2 - im.width*s*fuoco(i);
      dx = Math.min(0, Math.max(cw - im.width*s, dx));
    }
    return { cw, ch, s, dx,
             dy:(ch - im.height*s)/2 };
  }

  function draw(force){
    if(!ctx || state.loadFailed || state.disabled) return;
    const idx = Math.round(state.prog);
    const j = nearestIdx(idx);
    if(j < 0) return;

    /* Il primo piano ha una ragione in più del fondo per ridisegnarsi:
       il buco della lettera intera insegue il titolo mentre entra da
       sotto e mentre scivola via allo scroll. A fotogramma fermo il
       fondo non si tocca, ma quel buco sì — altrimenti resta indietro,
       sulla posizione dell'ultimo cambio di frame. */
    const b = (j < MATTE_COUNT && mattes[j]) ? buco(j) : null;
    const firma = b ? `${Math.round(b.x)}|${Math.round(b.y)}|${b.op.toFixed(2)}` : '';
    const fondoNuovo = force || idx !== state.drawn;
    if(!fondoNuovo && firma === state.bucoFirma) return;
    state.bucoFirma = firma;

    const im = images[j];
    const dpr = densita();
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if(canvas.width !== Math.round(cw*dpr) || canvas.height !== Math.round(ch*dpr)){
      canvas.width = Math.round(cw*dpr); canvas.height = Math.round(ch*dpr);
    }
    const m = metrics(im, j);

    if(fondoNuovo){
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, m.dx, m.dy, im.width*m.s, im.height*m.s);
      state.drawn = idx;
      if(DEBUG) drawDebugRing(m, im);
    }

    drawFront(j, m, dpr, b);
  }

  /* ── il palazzo in primo piano ────────────────────────────
     Stesso fotogramma del fondo, stessa cover-math, stesso filtro
     (che sta in CSS su entrambi i canvas): i due palazzi si
     sovrappongono esattamente, e l'unica cosa che cambia è che questo
     è ritagliato sulla sua silhouette e sta sopra il titolo.
     Il ritaglio è `destination-in`: resta il colore dove la matte ha
     alpha. I pixel di bordo hanno alpha parziale, quindi il contorno
     conserva l'antialiasing del render invece di seghettarsi. */
  function drawFront(j, m, dpr, b){
    if(!fctx) return;
    if(front.width !== canvas.width || front.height !== canvas.height){
      front.width = canvas.width; front.height = canvas.height;
    }
    fctx.setTransform(1,0,0,1,0,0);
    fctx.clearRect(0, 0, front.width, front.height);
    const ma = j < MATTE_COUNT ? mattes[j] : null;
    if(!ma) return;                     /* niente silhouette: titolo davanti */
    /* C'e' una lettera da tenere intera ma il suo ritaglio non si sa
       ancora calcolare (font non pronto): meglio nessun primo piano
       che un fotogramma con la lettera spezzata. Solo nei fotogrammi
       in cui il ritaglio ci sarebbe davvero. */
    if(!b && j < BUCO_FINO_A && document.querySelector('.display .su')) return;
    const im = images[j];
    fctx.setTransform(dpr,0,0,dpr,0,0);
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(im, m.dx, m.dy, im.width*m.s, im.height*m.s);
    fctx.globalCompositeOperation = 'destination-in';
    /* con le misure del FONDO, non con le proprie: anche se un giorno
       le silhouette fossero a un'altra risoluzione, resterebbero
       incollate al fotogramma che ritagliano */
    fctx.drawImage(ma, m.dx, m.dy, im.width*m.s, im.height*m.s);

    /* …tranne dove c'è una lettera dichiarata intera (.su nell'HTML):
       lì il primo piano si toglie di mezzo e il palazzo le passa
       DIETRO. Serve per le aste verticali — la I di COSTRUITO — dove
       il taglio non si legge come profondità ma come un errore di
       stampa. Il buco ha la forma esatta del glifo, non del suo
       rettangolo di avanzamento: su una I sono due cose diverse di
       sette pixel per lato, e si vedrebbero come un morso nel palazzo. */
    if(b){
      fctx.globalCompositeOperation = 'destination-out';
      fctx.globalAlpha = b.op;
      fctx.fillStyle = '#000';
      fctx.fillRect(b.x, b.y, b.w, b.h);
      fctx.globalAlpha = 1;
    }
    fctx.globalCompositeOperation = 'source-over';
    if(DEBUG && b){
      fctx.strokeStyle = 'rgba(0,255,120,.9)';
      fctx.lineWidth = 1;
      fctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    }
  }

  /* Il rettangolo del glifo da risparmiare, in pixel CSS.
     Il rect del DOM dà l'avanzamento (glifo più gli spazi laterali); il
     contorno vero lo danno le metriche del canvas, misurate con lo
     stesso font e rimisurate solo quando il corpo cambia. L'alpha
     segue l'opacità del titolo, così il buco sfuma insieme a lui
     quando la hero se ne va, invece di sparire di colpo. */
  let bucoFont = '', bucoMis = null, sonda = null;

  /* La baseline della riga, misurata invece che dedotta.
     Dedurla dalle metriche del font sbagliava di qualche decimo, e in
     basso quei decimi si vedevano: la torre tagliava il piede della I.
     Un elemento vuoto in linea alta zero ha il suo bordo inferiore
     esattamente sulla baseline — è il modo più diretto di chiederla al
     browser invece di ricostruirla. */
  function baseline(su){
    if(!sonda || !sonda.isConnected){
      sonda = document.createElement('i');
      sonda.className = 'base-sonda';
      sonda.setAttribute('aria-hidden', 'true');
      su.parentNode.appendChild(sonda);
    }
    return sonda.getBoundingClientRect().bottom;
  }

  /* Per quanti fotogrammi la lettera resta davanti. È una correzione
     della SOLA hero ferma: lì la punta della torre spezzava la I e si
     leggeva come un errore di stampa. Appena la camera scende il
     palazzo cresce fino a riempire lo schermo, e una lettera che gli
     galleggia davanti — da sola, mentre tutte le altre ci passano
     dietro — diventa lei l'errore. Quindi il ritaglio si chiude nei
     primi fotogrammi, cioè in un paio di giri di rotellina: il tempo
     in cui la hero è ancora la hero. */
  const BUCO_FINO_A = 12;

  function buco(j){
    if(!fctx) return null;
    const svanire = 1 - Math.min(1, (j || 0) / BUCO_FINO_A);
    if(svanire <= 0) return null;
    const su = document.querySelector('.display .su');
    if(!su) return null;
    const r = su.getBoundingClientRect();
    if(!r.width || !r.height) return null;
    const hero = su.closest('.hero');
    const op = (hero ? parseFloat(getComputedStyle(hero).opacity) : 1) * svanire;
    if(!(op > .01)) return null;

    const cs = getComputedStyle(su);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    if(font !== bucoFont){
      const testo = cs.textTransform === 'uppercase'
        ? su.textContent.toUpperCase() : su.textContent;
      fctx.save();
      fctx.setTransform(1,0,0,1,0,0);
      fctx.font = font;
      const m = fctx.measureText(testo);
      /* Coerenza col DOM: se il canvas sta misurando con un font di
         ripiego — succede quando le metriche si chiedono prima che il
         webfont sia arrivato — l'avanzamento non torna, e un buco
         tagliato sulla I di Arial lascerebbe scoperta quella vera.
         In quel caso non si memorizza nulla e si riprova al giro dopo,
         quando il font c'e'. */
      const coerente = Math.abs(m.width - r.width) <= Math.max(1.5, r.width * .04);
      bucoMis = coerente ? {
        sx:m.actualBoundingBoxLeft,     dx:m.actualBoundingBoxRight,
        alto:m.actualBoundingBoxAscent, basso:m.actualBoundingBoxDescent
      } : null;
      fctx.restore();
      if(coerente) bucoFont = font;
    }
    const q = bucoMis;
    if(!q) return null;
    const base = baseline(su);
    /* arrotondato verso l'ESTERNO: meglio un pixel di palazzo in meno
       che un filo di palazzo sopra la lettera */
    const x0 = Math.floor(r.left - q.sx), x1 = Math.ceil(r.left + q.dx);
    const y0 = Math.floor(base - q.alto), y1 = Math.ceil(base + q.basso);
    return { x:x0, y:y0, w:x1 - x0, h:y1 - y0, op };
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
  /* ?debug=1 disegna anche il contorno del buco della lettera intera:
     serve a vedere DOVE il codice crede che stia il glifo, invece di
     dedurlo dal risultato. */
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

  /* Quando il webfont arriva, le lettere cambiano larghezza: le
     metriche del buco vanno rimisurate e la scena ridisegnata. Senza,
     il ritaglio della lettera intera resterebbe quello del font di
     ripiego per tutta la visita. */
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(()=>{
      bucoFont = ''; bucoMis = null; state.bucoFirma = '';
      if(state.shown) draw(true);
    });
  }

  /* ═══════════════ Coreografia di scroll ═══════════════════ */

  /* ── la coda: il fermo a fine sezione ──────────────────────
     Chiesto dal committente il 2026-09-23. Ogni animazione lunga
     finisce un tratto PRIMA della fine della sua sezione: in quel
     tratto lo scroll continua ma la scena non si muove più, e per
     passare al capitolo dopo bisogna scorrere ancora un po'. Serve a
     far vedere l'ultimo fotogramma invece di scivolarci sopra —
     senza, la sequenza arriva in fondo proprio mentre la sezione
     esce di scena e quell'immagine non la guarda nessuno.
     `bottom+=` e non `bottom-=`: il punto è sotto il bordo dello
     schermo, quindi la sezione ci arriva prima. */
  const FINE_CON_CODA = 'bottom bottom+=30%';

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
    /* Lo stato di partenza: disegni interi. Su desktop poi li smonta
       initCases scorrendo; su mobile restano così. */
    DIA.forEach(d => d.draw(1, 0));

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
     leggendo gli attributi data-flip. */
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
  /* data-flip-soglia sposta quel punto per una sezione sola (frazione
     di schermo): serve alla 01 sul telefono, il cui cemento deve
     arrivare mentre la torre sfuma, ben prima del 30%. */
  function threshold(s){
    const f = s.el ? parseFloat(s.el.dataset.flipSoglia) || .3 : .3;
    return s.el
      ? s.el.getBoundingClientRect().top + scrollY - innerHeight * f
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
    /* #s-via non esiste più (tolta il 2026-09-23): il suo posto in
       pagina è ora il top di #s02-struttura, quindi le soglie restano
       le stesse e i due trigger cambiano solo nome. */
    /* Tutte le coppie solo sul desktop (2026-09-25): le soglie sono
       tarate su capitoli alti 350–400vh, e sul telefono — dove i
       capitoli sono alti quanto il loro testo — la sezione dopo arriva
       al 160% dello schermo mentre la precedente è appena entrata, e il
       testo spariva prima di essere letto. */
    /* Anche il congedo di "in vendita": sul telefono le schede sono in
       colonna e l'ultima sfumava mentre la si stava ancora leggendo. */
    const congedi = [['#s02-struttura','#s01-arte .sticky',     'top 160%','top 120%'],
                     ['#s03-finiture','#s02-struttura .sticky','top 220%','top 175%'],
                     ['#s-piuma',     '#s03-finiture .sticky', 'top 220%','top 175%'],
                     ['#s-storia',    '#s-vendita .vendita',   'top bottom','top 78%']]
      .map(c => c.concat('(min-width: 901px)'));
    const mmCongedi = gsap.matchMedia();
    congedi.forEach(([entra, esce, start, end, media])=>{
      if(!document.querySelector(esce) || !document.querySelector(entra)) return;
      mmCongedi.add(media, ()=>{
        gsap.to(esce, {
          autoAlpha:0, ease:'none', immediateRender:false,
          scrollTrigger:{trigger:entra, start, end, scrub:true}
        });
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
  /* ── il titolo che si scurisce mentre scorri ───────────────
     Chiesto per il capitolo 01 (2026-09-23): sul cemento il grigio di
     sistema si legge poco, e quella schermata resta chiara per tutta
     la sua corsa. Il titolo arriva al massimo contrasto a metà strada
     e ci resta: se virasse fino in fondo, la parte più leggibile
     capiterebbe proprio mentre la sezione esce di scena. */
  function initViraTitolo(){
    document.querySelectorAll('.sec-display--vira').forEach(el=>{
      const sez = el.closest('section') || el;
      /* etichetta e paragrafo della stessa sezione virano insieme al titolo */
      const bersagli = [el, ...sez.querySelectorAll('.sec-label--vira, .sec-body--vira')];
      gsap.fromTo(bersagli, {'--nero':0}, {
        '--nero':1, ease:'none', immediateRender:false,
        scrollTrigger:{ trigger:sez, start:'top top', end:'45% top', scrub:true }
      });
    });
  }

  function initPiuma(){
    gsap.fromTo('#nido', {autoAlpha:0}, {
      autoAlpha:1, ease:'none',
      scrollTrigger:{ trigger:'#s02-struttura', start:'top 90%', end:'top 20%', scrub:true }
    });

    /* Il fondo cinematico non si spegne più con una dissolvenza qui:
       lo ritaglia la tenda della virata (`data-flip-curtain`, ora su
       #s02-struttura), che lo mangia dall'alto mentre il fondo gira.
       Sopra i render il cemento non potrebbe farsi vedere, e con la
       virata spostata una sezione più su questa dissolvenza sarebbe
       arrivata troppo tardi. I filamenti seguono --t in applyTheme. */

    gsap.fromTo('#nido', {autoAlpha:1}, {
      autoAlpha:0, ease:'none', immediateRender:false,
      scrollTrigger:{ trigger:'#s-perche', start:'top 55%', end:'top -60%', scrub:true }
    });
  }

  /* ── il mattone: un solo movimento su tre capitoli ───────
     Scende lungo la 4 e la 5 e si schianta nella 6, che è l'arco
     della reference (img-19 → img-22) con un impatto al posto di
     un appoggio. Dal 2026-09-24 è anche un oggetto solo, fisso allo
     schermo, che scende attraverso le tre sezioni.
     Il valore lo passa `--t`, la stessa manopola del tema: così
     l'inversione chiaro↔scuro dell'oggetto non può andare fuori
     fase col fondo su cui poggia. */
  function initBrick(){
    if(!window.BRICK) return;
    /* Dal 2026-09-24 il mattone è UNO: sta nel fondo fisso
       (.mattone-volo) e attraversa 02, 03 e piuma. Prima c'erano due
       mattoni fermi nelle colonne della 02 e della 03 più la caduta
       nella piuma; il committente voleva un oggetto solo che cade da
       sopra e si schianta su GRAVITA'. Due tempi:
       - discesa: fotogramma 0, la y va da fuori schermo in alto alla
         posizione di partenza del bake, per tutta la 02 e la 03;
       - caduta: i fotogrammi, dentro la piuma, come prima. */
    const cadutaEl = document.querySelector('.mattone-volo');
    const caduta = cadutaEl && BRICK.monta(cadutaEl, 0, 1);
    if(!caduta) return;
    BRICK.preload();

    const luce = ()=> parseFloat(
      getComputedStyle(root).getPropertyValue('--t')) || 0;

    /* Dove sta il riquadro del bake, in % della sua altezza. Nel
       fotogramma 0 il mattone occupa la fascia alta (0-17%) e il
       pavimento, con l'ombra, sta sotto: finché il riquadro scorre, il
       pavimento andrebbe in giro con lui (un'ombra che fluttua, il
       bordo del piano a metà schermo). Per questo nella discesa si
       ritaglia tutto quello che sta sotto il mattone.
       DA → A: il mattone entra da sopra e arriva a un terzo di schermo
       a fine 03; nella caduta la traslazione si riassorbe con la stessa
       accelerazione del bake (t^2.6, U_IMPATTO 0,62 in
       assets/3d/render_brick.py), così la somma scende sempre e il
       pavimento torna al suo posto proprio all'impatto. */
    /* U0: nei primi ~30 fotogrammi del bake il mattone esce dal bordo
       alto dell'inquadratura e si vedeva tagliato di netto. Dal 33 in
       poi è intero: discesa e caduta partono da lì. */
    const DA = -40, A = 30, U_IMPATTO = .62, U0 = .27;
    /* quota del mattone nel bake (render_brick.py → caduta), 1 = partenza */
    const quota = u => 1 - Math.pow(Math.min(1, u / U_IMPATTO), 2.6);
    /* p della caduta → fotogramma: fino all'impatto si parte da U0, dopo
       resta com'era, così lo schianto cade ancora al 43,4% della piuma */
    const fot = p => p < U_IMPATTO ? U0 + (U_IMPATTO - U0) * p / U_IMPATTO : p;
    const posa = (y, taglio)=>{
      cadutaEl.style.transform = `translateY(${y}%)`;
      cadutaEl.style.clipPath  = taglio ? 'inset(0 0 45% 0)' : '';
    };
    posa(DA, true);

    /* ── L'attraversamento (committente, 2026-09-24) ──
       Il mattone non plana più: attraversa ogni schermata a velocità
       costante, entrando dall'alto e uscendo dal basso, e passa al CENTRO
       dello schermo (y = A) proprio mentre sale il titolo della sezione.
       Tre passaggi: 02, 03 e l'ultimo, che sulla gravità diventa la caduta.
       x = schermi di scroll da quando la 02 arriva in cima allo schermo.
       CENTRI: dove il mattone è al centro. Le finestre dei titoli di 02 e
       03 (data-rivela in index.html) sono centrate sugli stessi punti.
       Il salto da y = 100 (appena sotto lo schermo) a y = −40 (appena
       sopra) avviene a mattone invisibile, quindi non si vede. */
    const CENTRI = [0.3, 3.8, 7.0];      /* 7,0 = la piuma arriva in cima */
    const GIRO = 140;                     /* da −40 a 100: un attraversamento */
    const PRIMA = 40;                     /* velocità d'ingresso nella 02, in % di schermo per schermo */
    const xDa = CENTRI[0] - (A - DA) / PRIMA;
    const attraversa = x=>{
      if(x <= CENTRI[0]) return Math.max(DA, A - PRIMA * (CENTRI[0] - x));
      for(let i = 1; i < CENTRI.length; i++){
        if(x <= CENTRI[i]){
          const v = GIRO / (CENTRI[i] - CENTRI[i-1]);
          let y = A + v * (x - CENTRI[i-1]);
          if(y > 100) y -= GIRO;
          return y;
        }
      }
      return A;
    };
    ScrollTrigger.create({
      trigger:'#s02-struttura', start:`top ${-xDa * 100}%`,
      endTrigger:'#s-piuma', end:'top top',
      scrub:true, invalidateOnRefresh:true,
      onUpdate(self){ posa(attraversa(xDa + (scrollY - self.start) / innerHeight), true); BRICK.draw(U0, luce()); },
      onRefresh(self){ posa(attraversa(xDa + (scrollY - self.start) / innerHeight), true); BRICK.draw(U0, luce()); }
    });
    /* la traslazione si consuma quanto il mattone scende nel bake */
    const inCaduta = p=> posa(A * quota(fot(p)) / quota(U0), false);

    /* Sotto Perché e oltre il mattone non deve vedersi (committente,
       2026-09-24: si vedeva dietro le card delle opere, che sono
       trasparenti). Si spegne quando il pannello nero ha già coperto
       tutto lo schermo, quindi lo scambio non si vede. */
    ScrollTrigger.create({
      trigger:'#s-perche', start:'top top',
      onToggle(self){ gsap.set(cadutaEl, {autoAlpha: self.isActive || self.progress >= 1 ? 0 : 1}); },
      end:'max'
    });

    /* La caduta occupa il primo 70% del capitolo C: 6.480 × 0,7 / 120 =
       38 px per fotogramma, dentro la banda 25-45. Il resto della
       sezione il mattone sta fermo mentre il titolo finisce di
       accendersi — che è anche la coreografia giusta. */
    {
      ScrollTrigger.create({
        trigger:'#s-piuma', start:'top top', end:'70% top',
        scrub:true, invalidateOnRefresh:true,
        onUpdate(self){ inCaduta(self.progress); caduta.ultimo = fot(self.progress); BRICK.draw(fot(self.progress), luce()); },
        onRefresh(self){ if(self.progress > 0){ inCaduta(self.progress); BRICK.draw(fot(self.progress), luce()); } }
      });

      /* Il congedo (dissolvenza 62%→78%) è stato tolto il 2026-09-24:
         ora «Perché Salzillo» sale come un pannello opaco e copre il
         mattone schiantato, che resta al suo posto fino all'ultimo. */
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
      BRICK.preload(stretto.matches);
    }
    /* Dal 2026-09-24 la 02, la 03 e la piuma sono tutte chiare: il
       mattone posato è sempre quello scuro su cemento. Prima si leggeva
       --t all'avvio, che in cima alla pagina è notte, e sul telefono
       compariva il mattone chiaro sul fondo chiaro. */
    const luce = 1;
    /* i frame arrivano in differita: si ridipinge quando ci sono */
    const dipingi = ()=> BRICK.draw(1, luce);
    dipingi();
    setTimeout(dipingi, 400);
    setTimeout(dipingi, 1600);
  }

  /* ── il mattone sul telefono (2026-09-25) ─────────────────
     UN mattone solo, nel fondo fisso (.mattone-volo), dietro le scritte
     di 02, 03 e piuma. Seconda versione, dopo la prova sull'iPhone del
     committente: seguire i riquadri a ogni scroll lo faceva traballare
     (Safari muove la pagina prima che il JS sposti il livello fisso).
     Ora non è mai agganciato al pixel del testo:
     - entra dall'alto nella 01 e scende piano, con uno scrub ammorbidito,
       mentre 01, 02, 03 e piuma gli scorrono sopra;
     - resta sospeso (fotogramma U0) finché non arriva il titolo della
       piuma; poi cade mentre il pallino scende TEMPO / E, e rompe il
       pavimento esattamente quando il pallino arriva su GRAVITA', che a
       quel punto è già salita sopra di lui, in basso, col nero di
       Perché Salzillo già sotto le crepe;
     - Perché Salzillo sale e lo copre.
     Scrollando indietro oltre l'inizio della 01 risale e sparisce. */
  function mattoneTelefono(){
    const el = document.querySelector('.mattone-volo');
    const titolo = document.querySelector('#s-piuma .sec-display--st');
    const fondo = document.querySelector('#bg');
    if(!window.BRICK || !el || !titolo || !fondo) return;
    if(!el.querySelector('canvas')) BRICK.monta(el, 0, 1);
    /* ROMPE: un filo oltre il punto in cui il pallino salta su GRAVITA'
       (.75 / .875), così lo schianto non lo anticipa mai; APRE: quanta
       corsa servono alle crepe per aprirsi tutte, prima che il nero salga */
    const U0 = .27, U_IMPATTO = .62, CADE = .55, ROMPE = .77 / .875, APRE = .05;
    /* Prima di tutto il fotogramma sospeso, davanti alla torre: è il
       primo che si vede, e in coda arrivava dopo tutto il resto (al
       primo scroll c'era solo l'ombra). Poi solo quelli che servono:
       da U0 in poi, uno su due — un terzo dei file del bake. */
    BRICK.anticipa(U0, true);
    const primo = Math.round(U0 * (BRICK.N - 1));
    BRICK.preload(true, i => i >= primo && (i - primo) % 2 === 0);
    BRICK.opacita(1);

    /* Il bake: sospeso a U0, cade fino all'impatto (0,62 = m_075) e poi
       apre le crepe. La corsa è quella del faretto del titolo sul
       telefono (data-ignite-*-m, js/type.js): il pallino è sull'ultima
       riga da 3/4 della sua corsa in poi, e la corsa si ferma a 3,5/4
       (data-ignite-fine="ultima"), cioè al 75/87,5 = 85,7% del trigger. */
    const fot = q => q < CADE  ? U0
                   : q < ROMPE ? U0 + (U_IMPATTO - U0) * (q - CADE) / (ROMPE - CADE)
                   : U_IMPATTO + (1 - U_IMPATTO) * Math.min(1, (q - ROMPE) / APRE);
    const st = ScrollTrigger.create({
      trigger:titolo,
      start:titolo.dataset.igniteStartM || 'top 95%',
      end:  titolo.dataset.igniteEndM   || 'bottom 22%',
      onUpdate:s => BRICK.draw(fot(s.progress), 1),
      onRefresh:s => BRICK.draw(fot(s.progress), 1)
    });

    /* ── la discesa (terza versione, committente 2026-09-25) ──
       Fermo al centro sembrava sospeso; agganciato ai riquadri
       traballava. Ora scende piano per tutta la corsa, dalla 01 fino
       allo schianto, e ci arriva in BASSO: quando il pallino è su
       GRAVITA' il riquadro poggia sul bordo di Perché Salzillo, così
       sotto il pavimento rotto c'è già il nero, che poi sale e lo copre.
       Lo scrub è ammorbidito (insegue lo scroll con un filo di ritardo,
       a ogni frame): non è agganciato al testo, quindi su Safari non
       trema come quando lo seguiva al pixel. */
    const perche = document.querySelector('#s-perche');
    const H = ()=> el.offsetHeight;
    const quandoRompe = ()=> st.start + ROMPE * (st.end - st.start);
    /* dove sta il riquadro allo schianto: nel fotogramma dell'impatto il
       mattone occupa il 70-90% della sua altezza e le crepe arrivano al
       fondo; il riquadro finisce poco sopra il nero, così il mattone è
       intero e sotto le crepe comincia Perché Salzillo */
    const yRompe = ()=> perche
      ? perche.getBoundingClientRect().top + scrollY - quandoRompe() - H() - 16
      : fondo.clientHeight - H();
    const yAlto = ()=> Math.round(fondo.clientHeight * .1);
    gsap.timeline({
      scrollTrigger:{
        trigger:'#s01-arte', start:'top 60%',
        end:()=> quandoRompe(),
        scrub:.8, invalidateOnRefresh:true
      }
    })
      .fromTo(el, {y:()=> -H(), autoAlpha:0}, {y:yAlto, autoAlpha:1, ease:'power2.out', duration:.12})
      .to(el, {y:yRompe, ease:'none', duration:.88});

    /* i fotogrammi arrivano in differita: si ridipinge quando ci sono */
    const ridipingi = ()=> BRICK.draw(fot(st.progress), 1);
    ridipingi();
    setTimeout(ridipingi, 600);
    setTimeout(ridipingi, 2000);
  }

  /* L'apertura guidata dallo scroll era stata tolta il 2026-09-23, con le
     opere ferme a pagina; il committente l'ha rivoluta il 2026-09-24. */
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
      trigger:sec, start:'top top', end:FINE_CON_CODA,
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
        /* tutte le card tranne la prima: il velo si apre sulla prima,
           le altre si spengono mentre lui cresce (da due che erano,
           ora sono tre — cantieri, ristrutturazioni, in vendita) */
        gsap.set(cards.slice(1), {autoAlpha: 1 - mp(.55, .78, v)});
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


  /* Le frecce della storia e initGallerie() sono state tolte il
     2026-09-24: anche la storia avanza con lo scroll, come le gallerie
     delle opere (vedi initScroll). */

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
        endTrigger:'#s01-arte', end:FINE_CON_CODA,
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

      initViraTitolo();
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
      /* Le gallerie delle opere finiscono con l'ULTIMA foto al centro e
         restano ferme lì per un tratto (SOSTA_FINALE) prima di lasciare
         la schermata: prima la corsa si chiudeva con la [4] ancora sul
         bordo destro e la sezione scivolava via (committente,
         2026-09-24: «scorre a ristrutturazioni senza finire»). */
      const SOSTA_FINALE = 'bottom bottom+=60%';
      [['#s-cantieri','.cases-track', true],
       ['#s-ristrutturazioni','.cases-track', true],
       ['#s-storia','.storia-track', false]].forEach(([sec, sel, daDestra])=>{
        const sezione = document.querySelector(sec);
        const track = sezione && sezione.querySelector(sel);
        if(!track) return;
        const da = ()=> daDestra ? innerWidth * .34 : 0;
        const ultima = track.lastElementChild;
        /* centro dell'ultima carta a track ferma (x = 0), letto togliendo
           la x che la track ha nell'istante della misura */
        const a = daDestra
          ? ()=>{ const r = ultima.getBoundingClientRect();
                  return innerWidth / 2 - (r.left + r.width / 2 - gsap.getProperty(track, 'x')); }
          : ()=> -(track.scrollWidth - innerWidth);
        gsap.fromTo(track, {x: da}, {
          x: a, ease:'none',
          scrollTrigger:{ trigger:sec, start:'top top', end:SOSTA_FINALE,
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
            trigger:sec, start:'top top', end:SOSTA_FINALE, scrub:true,
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

    /* ── mobile: la torre scende con lo scroll, il resto a gradini ──
       Dal 2026-09-25 (committente) anche sul telefono la discesa della
       camera è guidata dallo scroll, con lo stesso trigger del desktop,
       e la hero se ne va come sul desktop: prima restava fissa sullo
       schermo e si vedeva sotto tutte le sezioni.
       Niente mattone in volo né apertura delle card: le sezioni sono a
       contenuto, e --t si commuta a gradini all'ingresso di ognuna. */
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', ()=>{
      /* la discesa finisce mentre sale la 01, prima del suo testo: da lì
         la torre sfuma e il mattone scende al suo posto (2026-09-25) */
      ScrollTrigger.create({
        trigger:'#hero-spacer', start:'top top',
        endTrigger:'#s01-arte', end:'top 75%',
        onUpdate(self){ state.target = self.progress * (FRAME_COUNT-1); tick(); }
      });
      gsap.fromTo(['.hero','.lockup','.corner','.grid'], {autoAlpha:1, y:0}, {
        autoAlpha:0, y:-30, ease:'none', immediateRender:false,
        scrollTrigger:{ trigger:'#hero-spacer', start:'25% top', end:'70% top', scrub:true }
      });
      /* Oltre la hero restano spenti anche se l'intro (js/hero.js) li
         riaccende dopo: sul telefono si comincia a scorrere prima che
         l'intro finisca, e lockup e SCORRI restavano sopra la piuma. */
      ScrollTrigger.create({
        trigger:'#hero-spacer', start:'70% top', end:'max',
        toggleClass:{targets:'#stage', className:'hero-via'}
      });
      /* la virata la guida sempre applyTheme, qui a scatti */
      stepped = true;
      root.classList.add('is-stepped');
      applyTheme();
      DIA.forEach(d => d.draw(1, 0));
      mattoneTelefono();
      /* Da 02 in poi le sezioni sono trasparenti (il mattone passa sotto
         le scritte): la torre, il suo primo piano e il velo scuro della
         hero se ne vanno appena entra la 02, e resta il cemento. */
      gsap.fromTo(['#seq','#seqFront','.bg__scrim'], {autoAlpha:1}, {
        autoAlpha:0, ease:'none', immediateRender:false,
        /* Se ne va appena la discesa è finita, mentre la 01 sale e PRIMA
           che arrivi il suo testo: sfumando a cavallo fra 01 e 02 si
           vedeva a lampi dietro le scritte scorrendo avanti e indietro
           (committente, registrazione del 2026-09-25). */
        scrollTrigger:{ trigger:'#s01-arte', start:'top 75%', end:'top 45%', scrub:true }
      });
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

  function init(){
    /* Sul telefono la torre se ne va mentre sale la 01 (initScroll,
       'top 75%' → 'top 45%'): il cemento arriva a metà di quella
       finestra, o sotto la torre che sfuma si vedeva la notte. */
    const s01 = document.querySelector('#s01-arte');
    if(s01) s01.dataset.flipSoglia = '.6';
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

    sizeLogoMorph();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { whenReady, show, seek, sizeLogoMorph, frameToScreen,
           get ready(){ return state.ready; },
           get failed(){ return state.loadFailed; } };

})();
