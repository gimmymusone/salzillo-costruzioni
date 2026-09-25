/* ══════════════════════════════════════════════════════════════
   Nav — le quattro tappe del sito.

   Il sito resta UNA pagina che scorre: le "pagine" sono tratti di
   quella corsa, e la nav dice a che punto sei. Niente router, niente
   ricarichi — la discesa sulla torre e l'arco del mattone vivono
   della continuità dello scroll, e spezzarli in quattro file li
   ucciderebbe.

   Tre mestieri, in ordine:
   1. i confini delle tappe, misurati sulla pagina vera e rimisurati
      quando ScrollTrigger rifà i conti (le sezioni pinnate cambiano
      altezza al resize);
   2. la voce accesa, decisa dalla posizione di scroll — stesso
      criterio di applyTheme(): è lo scroll a dire dove sei, non
      l'ordine con cui arrivano gli eventi;
   3. il salto diretto al clic, e la richiesta di informazioni
      che porta al form già compilato con l'immobile.
   ══════════════════════════════════════════════════════════════ */

window.NAV = (function(){

  const nav = document.querySelector('.hd__center');
  if(!nav) return;

  const voci  = [...nav.querySelectorAll('.nav__voce')];
  const sotto = [...nav.querySelectorAll('.nav__sotto')];

  /* Una tappa inizia dove inizia la sua prima sezione e finisce dove
     ne inizia un'altra: i confini si leggono dalla pagina, così
     spostare una sezione nell'HTML non obbliga a toccare questo file. */
  const tappe = [
    {sez:'intro',    da:'#hero-spacer'},
    {sez:'perche',   da:'#s-perche'},
    {sez:'opere',    da:'#s-cases'},
    {sez:'storia',   da:'#s-storia'},
    {sez:'contatti', da:'#s-contatti'}
  ].map(t => ({...t, el:document.querySelector(t.da)})).filter(t => t.el);

  const cima = el => el.getBoundingClientRect().top + scrollY;

  let confini = [];
  function misura(){
    confini = tappe.map(t => ({sez:t.sez, y:cima(t.el)}));
    sottoConfini = sotto
      .map(a => ({a, el:document.querySelector(a.getAttribute('href'))}))
      .filter(x => x.el)
      .map(x => ({a:x.a, y:cima(x.el), fine:cima(x.el) + x.el.offsetHeight}));
  }
  let sottoConfini = [];

  /* La voce accesa è l'ultima tappa già superata. Il quarto di
     schermo di anticipo evita che il titolo di una sezione arrivi
     prima che la sua voce si accenda. */
  function dipingi(){
    const y = scrollY + innerHeight * .25;
    let qui = confini.length ? confini[0].sez : null;
    for(const c of confini) if(y >= c.y) qui = c.sez;
    voci.forEach(v => v.classList.toggle('is-qui', v.dataset.sez === qui));
    sottoConfini.forEach(s => s.a.classList.toggle('is-qui', y >= s.y && y < s.fine));
  }

  let atteso = false;
  function alloScroll(){
    if(atteso) return;
    atteso = true;
    requestAnimationFrame(()=>{ atteso = false; dipingi(); });
  }

  /* ── salto diretto ────────────────────────────────────────
     Il clic porta SUBITO alla sezione, senza far scorrere tutta la
     pagina sotto gli occhi (chiesto dal committente il 2026-09-23:
     prima lo scorrimento morbido attraversava la discesa della torre
     e il mattone per arrivare, per esempio, a "perché noi").
     Le sezioni a pagina (data-pagina) si centrano al pixel sul loro
     top, così il gesto successivo di js/pagine.js parte allineato. */
  function vaiA(sel){
    const el = document.querySelector(sel);
    if(!el) return;
    const y = cima(el) + (el.hasAttribute('data-pagina') ? 0 : 1);
    scrollTo({top: Math.max(0, y), behavior: 'auto'});
  }

  function collega(a){
    const href = a.getAttribute('href') || '';
    if(!href.startsWith('#') || href === '#') return;
    a.addEventListener('click', e=>{
      e.preventDefault();
      menu(false);                    /* sul telefono il pannello si chiude */
      vaiA(href);
      a.blur();                       /* chiude il sottomenu tenuto dal focus */
    });
  }

  /* ── menu del telefono (2026-09-25) ──────────────────────
     Sotto i 900px le voci stanno in un pannello a tutto schermo che
     si apre col ☰. Mentre è aperto la pagina sotto non scorre. */
  const hd = document.querySelector('.hd');
  const burger = document.querySelector('.hd__burger');
  function menu(apri){
    if(!hd || !burger) return;
    hd.classList.toggle('is-menu', apri);
    document.body.classList.toggle('menu-aperto', apri);
    burger.setAttribute('aria-expanded', apri);
    burger.setAttribute('aria-label', apri ? 'Chiudi il menu' : 'Apri il menu');
  }
  if(burger){
    burger.addEventListener('click', ()=> menu(!hd.classList.contains('is-menu')));
    addEventListener('keydown', e=>{ if(e.key === 'Escape') menu(false); });
    matchMedia('(min-width: 901px)').addEventListener('change', e=>{ if(e.matches) menu(false); });
  }

  function init(){
    [...voci, ...sotto].forEach(collega);

    /* Le card della scelta e i richiami interni condividono lo stesso
       scorrimento: due comportamenti diversi per lo stesso gesto
       sarebbero una svista, non una scelta. */
    document.querySelectorAll('.case-card, .imm__cta, .hd__right, .hd__logo, .salta')
      .forEach(collega);

    /* "Chiedi informazioni": il form è uno solo per tutti gli
       immobili, quindi la richiesta arriva già con scritto quale.
       Se un giorno il form verrà spedito davvero, il nome è già
       dentro al messaggio e non serve chiederlo al visitatore. */
    document.querySelectorAll('.imm__cta[data-immobile]').forEach(a=>{
      a.addEventListener('click', ()=>{
        const msg = document.getElementById('cMsg');
        if(!msg) return;
        msg.value = `Buongiorno, vorrei informazioni sull'immobile ${a.dataset.immobile}.`;
      });
    });

    misura();
    dipingi();
    addEventListener('scroll', alloScroll, {passive:true});
    addEventListener('resize', ()=>{ misura(); dipingi(); });
    /* le sezioni pinnate cambiano altezza quando ScrollTrigger rifà i
       conti: i confini vanno rimisurati lì, non solo al resize */
    if(window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', ()=>{ misura(); dipingi(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { vaiA, misura };

})();
