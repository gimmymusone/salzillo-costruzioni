/* ══════════════════════════════════════════════════════════════
   Pagine — l'aggancio morbido delle sezioni a pieno schermo.

   Le sezioni marcate data-pagina (perché, servizi, in vendita,
   contatti) sono alte uno schermo (css/sections.css). Lo scroll è
   quello nativo, libero e fluido; quando la rotellina si ferma vicino
   al bordo di una di queste pagine, la pagina si allinea con un
   aggancio breve. Si sente l'arrivo senza il binario.

   Storia: il 2026-09-23 qui c'era un blocco «un gesto = una sezione»,
   con lo scorrimento animato di un secondo e l'anti-inerzia. Il
   committente l'ha trovato troppo rigido (2026-09-24) e le sezioni in
   mezzo — opere, gallerie, storia — sono tornate guidate dallo scroll
   (js/scroll.js). Resta solo l'aggancio.

   Solo desktop e senza reduced-motion: su mobile le sezioni tornano a
   contenuto e lo scroll resta quello del telefono.
   ══════════════════════════════════════════════════════════════ */

window.PAGINE = (function(){

  const pagine = [...document.querySelectorAll('[data-pagina]')];
  if(!pagine.length || !window.gsap) return;

  const media = matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
  /* A scroll fermo da SOSTA ms, se il bordo di una pagina è entro
     VICINO schermi, ci si allinea. Più lontano non succede niente: ci
     si ferma dove si vuole. Un gesto nuovo interrompe l'aggancio. */
  const SOSTA = 150, VICINO = .3, DURATA = .45;

  const cima = el => el.getBoundingClientRect().top + scrollY;

  let aggancio = null, sosta;
  function ferma(){ if(aggancio){ aggancio.kill(); aggancio = null; } }

  function aggancia(){
    if(!media.matches || aggancio) return;
    let meglio = null;
    pagine.forEach(p=>{
      const d = cima(p) - scrollY;
      if(Math.abs(d) <= innerHeight * VICINO && (!meglio || Math.abs(d) < Math.abs(meglio))) meglio = d;
    });
    if(meglio === null || Math.abs(meglio) <= 2) return;
    const o = {y: scrollY}, y = scrollY + meglio;
    aggancio = gsap.to(o, {
      y, duration: DURATA, ease: 'power2.out',
      onUpdate(){ scrollTo(0, o.y); },
      onComplete(){ aggancio = null; }
    });
  }

  addEventListener('scroll', ()=>{
    if(aggancio) return;
    clearTimeout(sosta);
    sosta = setTimeout(aggancia, SOSTA);
  }, {passive:true});
  ['wheel','touchstart','mousedown','keydown'].forEach(t=> addEventListener(t, ferma, {passive:true}));

  return { aggancia };

})();
