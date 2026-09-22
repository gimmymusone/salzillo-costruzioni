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

  function setInitial(){
    gsap.set(preloader, {autoAlpha:1});
    gsap.set(preRule,   {width:'0%'});
    gsap.set('.preloader__lockup', {autoAlpha:1, y:0});
    prePct.textContent = '0%';

    gsap.set(['.hd', '.grid', '.lockup', '.corner'], {autoAlpha:0});
    gsap.set('.logo-morph', {autoAlpha:0, scale:.92, transformOrigin:'50% 50%'});
    gsap.set('#seq', {opacity:0});
    /* le due righe partono oltre la linea centrale immaginaria:
       la prima sotto la sua maschera (entrerà salendo), la seconda
       sopra la sua (entrerà scendendo) */
    gsap.set('.display .line:first-child .line__in', {yPercent:105});
    gsap.set('.display .line:last-child .line__in',  {yPercent:-105});
    gsap.set('.display', {autoAlpha:1});
    gsap.set('.hero',    {autoAlpha:1});

    stage.classList.remove('is-intro');
  }

  function build(){
    const counter = {v:0};

    tl = gsap.timeline({defaults:{ease:EASE_OUT}});

    /* ── 1. caricamento: la linea si disegna, il contatore sale ── */
    tl.to(preRule,  {width:'100%', duration:2.0, ease:EASE_IO}, 0)
      .to(counter, {
        v:100, duration:2.0, ease:EASE_IO,
        onUpdate(){ prePct.textContent = Math.round(counter.v) + '%'; }
      }, 0)

      /* il preloader non si congeda finché il primo frame non c'è
         (o finché non scade il timeout: senza frame si prosegue) */
      .add(()=>{
        if(window.SEQ && !SEQ.ready){
          tl.pause();
          SEQ.whenReady(()=>tl.play(), 8000);
        }
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

      /* ── 3. la griglia prende il posto della linea ── */
      .to('.grid', {autoAlpha:1, duration:.9}, '-=0.35')

      /* ── 4. le righe si aprono dalla linea centrale: la prima
             sale, la seconda scende, insieme ── */
      .to('.display .line__in', {yPercent:0, duration:1.15}, '-=0.65')

      /* ── 5. il resto si appoggia ── */
      .to('.hd',      {autoAlpha:1, duration:.8}, '-=0.85')
      .to('.lockup',  {autoAlpha:1, duration:.8}, '-=0.7')
      .to('.corner',  {autoAlpha:1, duration:.7, stagger:.08}, '-=0.6');

    /* L'intro è l'unica cosa della pagina che gira a tempo proprio, ed è
       anche l'unico punto in cui i secondi contano: il committente
       descrive la reference come «fa prima un'animazione, come vedi al
       sec 8». La timeline è scritta in tempi relativi, quindi invece di
       ritoccare venti durate a mano si riscala tutta in blocco. */
    const DURATA_OBIETTIVO = 8.0;
    if(tl.duration() > 0) tl.timeScale(tl.duration() / DURATA_OBIETTIVO);

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
    window.FX.use('feather');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Esc salta l'intro */
  addEventListener('keydown', e=>{ if(e.key === 'Escape') skip(); });

  return {play, skip, get timeline(){return tl;}};

})();
