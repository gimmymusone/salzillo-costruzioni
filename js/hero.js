/* ══════════════════════════════════════════════════════════════
   Intro + reveal della hero.
   Ricalca la sequenza di composites.archi: preloader chiaro con
   contatore e linea che si disegna → il fondo va a scuro, la linea
   RESTA e diventa parte della griglia → le righe del titolo salgono
   da sotto una maschera.
   ══════════════════════════════════════════════════════════════ */

window.HERO = (function(){

  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const stage     = $('#stage');
  const preloader = $('#preloader');
  const preRule   = $('#preRule');
  const prePct    = $('#prePct');

  const EASE_OUT = 'power3.out';
  const EASE_IO  = 'power2.inOut';

  let tl = null;
  /* i blocchi del titolo, calcolati in setInitial e usati da build:
     gli estremi si aprono, le cerniere in mezzo entrano di lato */
  let estremi = [], cerniere = [];

  function setInitial(){
    gsap.set(preloader, {autoAlpha:1});
    gsap.set(preRule,   {width:'0%'});
    gsap.set('.preloader__lockup', {autoAlpha:1, y:0});
    prePct.textContent = '0%';

    gsap.set(['.hd', '.grid', '.lockup', '.corner'], {autoAlpha:0});
    gsap.set('.logo-morph', {autoAlpha:0, scale:.92, transformOrigin:'50% 50%'});
    gsap.set(['#seq', '#seqFront'], {opacity:0});
    /* Le parole grandi partono oltre la linea centrale immaginaria: la
       prima sotto la sua maschera (entrerà salendo), l'ultima sopra la
       sua (entrerà scendendo). A tre blocchi quel senso resta sulle due
       grandi, e PER — la cerniera in mezzo — sale da sotto la sua
       maschera come la prima, ma in ritardo: l'entrata di lato era più
       ricca, il committente l'ha vista dal vivo e ha chiesto lo stesso
       movimento verticale delle altre (2026-09-23). Il titolo si legge
       ancora in tre tempi, ma tutti nello stesso verso.
       I blocchi si leggono a runtime e non per selettore fisso: con le
       copy a due (?copy=2, ?copy=3) il terzo è nascosto, e gli estremi
       tornano a essere quei due — coreografia identica a prima. Senza
       stato iniziale il blocco di mezzo comparirebbe subito, visibile
       già mentre il preloader se ne va. */
    const blocchi = $$('.display .line')
      .filter(l => getComputedStyle(l).display !== 'none')
      .map(l => l.querySelector('.line__in'))
      .filter(Boolean);

    estremi  = blocchi.length > 1 ? [blocchi[0], blocchi[blocchi.length - 1]] : blocchi;
    cerniere = blocchi.slice(1, -1);

    if(estremi[0]) gsap.set(estremi[0], {yPercent:105, xPercent:0});
    if(estremi[1]) gsap.set(estremi[1], {yPercent:-105, xPercent:0});
    if(cerniere.length) gsap.set(cerniere, {yPercent:105, xPercent:0});
    gsap.set('.display', {autoAlpha:1});
    gsap.set('.hero',    {autoAlpha:1});

    stage.classList.remove('is-intro');
  }

  /* Il numero mostrato insegue quello vero senza scatti e non torna mai
     indietro; almeno ATTESA_MIN secondi, perché la linea che si disegna
     è parte della coreografia anche con la rete veloce. */
  const ATTESA_MIN = 1.6, ATTESA_MAX = 30;
  function attendiCarico(counter, via){
    const t0 = performance.now();
    const dipingi = ()=>{
      gsap.set(preRule, {width: counter.v + '%'});
      prePct.textContent = Math.round(counter.v) + '%';
    };
    const passo = ()=>{
      const sec = (performance.now() - t0) / 1000;
      const vero = window.CARICO ? CARICO.quanto() : 1;
      const tetto = Math.min(100, vero * 100, sec / ATTESA_MIN * 100);
      counter.v = Math.max(counter.v, counter.v + (tetto - counter.v) * .12);
      if(tetto >= 100 && counter.v > 99.5) counter.v = 100;
      dipingi();
      if(counter.v >= 100 || sec >= ATTESA_MAX){
        gsap.ticker.remove(passo);
        if(counter.v >= 100){ via(); return; }
        /* scaduto il tempo: si chiude la linea e si parte comunque */
        gsap.to(counter, {v:100, duration:.4, ease:EASE_IO, onUpdate:dipingi, onComplete:via});
      }
    };
    gsap.ticker.add(passo);
  }

  function build(){
    const counter = {v:0};

    tl = gsap.timeline({defaults:{ease:EASE_OUT}});

    /* ── 1. caricamento: la linea si disegna, il contatore sale ──
       Dal 2026-09-26 contatore e linea dicono il VERO: la frazione dei
       file arrivati (CARICO, js/scroll.js). Il preloader resta finché
       non c'è tutto quello che si vede scorrendo, così con poca rete
       non si incontrano più immagini mancanti; al massimo ATTESA_MAX,
       poi si parte e il resto continua ad arrivare in sottofondo. */
    tl.add(()=>{
      if(tl.reversed() || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      tl.pause();
      attendiCarico(counter, ()=>{
        tl.play();
        if(window.PROGETTI) PROGETTI.precarica();
      });
    })

      /* ── 2. il fondo vira allo scuro; la linea resta ── */
      .to(preloader, {backgroundColor:'#0F0F0F', duration:.9, ease:EASE_IO}, '+=0.15')
      .to('.preloader__lockup .lockup__a', {color:'#7A7878', duration:.9}, '<')
      .to('.preloader__lockup .lockup__b', {color:'#FFFFFF', duration:.9}, '<')
      .to(prePct,   {autoAlpha:0, duration:.4}, '<')
      .to(preloader,{autoAlpha:0, duration:.6, ease:EASE_IO}, '-=0.15')
      .set(preloader,{pointerEvents:'none'})

      /* ── 2b. il marchio appare… ── */
      .add(()=>{ if(window.SEQ) SEQ.sizeLogoMorph(); })
      .to('.logo-morph', {autoAlpha:1, scale:1, duration:.9, ease:EASE_OUT}, '-=0.15')

      /* ── 2c. …e diventa il palazzo: match-cut sulla vista zenitale ── */
      .add(()=>{ if(window.SEQ) SEQ.show(); }, '+=0.55')
      .to('#seq',        {opacity:1, duration:.9, ease:EASE_IO}, '<')
      .to('.logo-morph', {autoAlpha:0, duration:.9, ease:EASE_IO}, '<+0.15')
      /* Il palazzo in primo piano entra INSIEME alla dissolvenza del
         marchio, non insieme al fondo: sta sopra la .logo-morph e, se
         si accendesse prima, le torri renderizzate coprirebbero
         proprio le due curve della SC — cioè il match-cut. */
      .to('#seqFront',   {opacity:1, duration:.9, ease:EASE_IO}, '<')

      /* ── 3. la griglia prende il posto della linea ── */
      .to('.grid', {autoAlpha:1, duration:.9}, '-=0.35')

      /* ── 4. le parole si aprono dalla linea centrale: la prima sale,
             l'ultima scende, insieme; la cerniera in mezzo (PER) sale
             anche lei ma sfalsata, così il titolo si legge in tre tempi
             e non come un blocco solo ── */
      /* Una label, non più una catena di `-=`: la cerniera aggiunge un
         tween in mezzo, e con i soli tempi relativi tutto ciò che viene
         dopo slitterebbe dietro di lei. Ancorando a `titolo` i tempi
         restano quelli di prima anche a due blocchi, quando la cerniera
         non esiste. */
      .addLabel('titolo', '-=0.65')
      .to(estremi, {yPercent:0, duration:1.15}, 'titolo');

    /* PER esce insieme a COSTRUITO e RESTARE, stessa durata e stesso
       istante (committente, 2026-09-24): prima era sfalsata di 0,30 s. */
    if(cerniere.length){
      tl.to(cerniere, {yPercent:0, duration:1.15}, 'titolo');
    }

    /* ── 5. il resto si appoggia ── */
    tl.to('.hd',      {autoAlpha:1, duration:.8}, 'titolo+=0.30')
      .to('.lockup',  {autoAlpha:1, duration:.8}, 'titolo+=0.45')
      .to('.corner',  {autoAlpha:1, duration:.7, stagger:.08}, 'titolo+=0.55');

    /* L'intro è l'unica cosa della pagina che gira a tempo proprio, ed è
       anche l'unico punto in cui i secondi contano: il committente
       descrive la reference come «fa prima un'animazione, come vedi al
       sec 8». La timeline è scritta in tempi relativi, quindi invece di
       ritoccare venti durate a mano si riscala tutta in blocco. */
    const DURATA_OBIETTIVO = 8.0;
    /* +2,0: i secondi del vecchio contatore a tempo fisso. L'attesa ora
       sta fuori dalla timeline, e senza questo il resto dell'intro
       rallenterebbe per riempire gli otto secondi. */
    if(tl.duration() > 0) tl.timeScale((tl.duration() + 2.0) / DURATA_OBIETTIVO);

    return tl;
  }

  function play(){
    if(tl) tl.kill();
    gsap.set(preloader, {pointerEvents:'auto', backgroundColor:'#AEAAAA'});
    gsap.set('.preloader__lockup .lockup__a', {color:'#0F0F0F'});
    gsap.set('.preloader__lockup .lockup__b', {color:'#6E6A6A'});
    gsap.set(prePct, {autoAlpha:1});
    setInitial();
    build();
  }

  /* Salta l'intro e mostra direttamente la hero (utile mentre si lavora) */
  function skip(){
    if(tl) tl.progress(1);
  }

  function init(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){
      setInitial();
      build().progress(1);
    } else {
      play();
    }
    /* la piuma è attiva ma il suo canvas parte trasparente:
       si rivela via scroll quando il viaggio dei frame si blocca
       (coreografia in scroll.js), come nel reference. */
    window.FX.register({id:'none', name:'Nessuno', params:{speed:0}, schema:[], draw(){}});
    window.FX.mount($('#fx'), $('#fx3d'));
    /* i filamenti sono stati sostituiti dal nido d'ape (2026-09-24):
       il loop di disegno resta spento */
    window.FX.use('none');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Esc salta l'intro */
  addEventListener('keydown', e=>{ if(e.key === 'Escape') skip(); });

  return {play, skip, get timeline(){return tl;}};

})();
