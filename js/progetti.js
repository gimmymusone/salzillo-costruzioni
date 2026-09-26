/* ══════════════════════════════════════════════════════════════
   Progetti — la scheda che si apre cliccando una foto delle gallerie
   (committente, 2026-09-25).

   Non è un file a parte: è un livello a tutto schermo SOPRA il sito.
   Una pagina separata, tornando indietro, ricaricherebbe il sito da
   capo (preloader, torre, sezioni bloccate) e il punto di prima non
   sarebbe garantito. Qui il sito sotto non si muove mai: chiudere la
   scheda è tornare esattamente dov'eri.

   La scheda ha una sua voce nella cronologia (#progetto/<id>): il
   tasto indietro del browser e il gesto indietro del telefono la
   chiudono, invece di uscire dal sito.

   I DATI stanno tutti qui sotto: per aggiungere un progetto o
   completare un segnaposto basta toccare questo elenco.
   ══════════════════════════════════════════════════════════════ */

window.PROGETTI = (function(){

  const DC = '[DA CONFERMARE]';
  const foto = (cartella, n) =>
    Array.from({length:n}, (_, i) => `assets/cantieri/${cartella}/${String(i + 1).padStart(2, '0')}.webp`);

  const NUOVE = 'Nuove costruzioni', RISTR = 'Ristrutturazioni';
  const DATI = {
    'via-torre':        {nome:'Via Torre',        categoria:NUOVE, tipo:DC, luogo:DC,           stato:DC, foto:foto('via-torre', 5)},
    'villette-portico': {nome:'Villette Portico', categoria:NUOVE, tipo:DC, luogo:DC,           stato:DC, foto:foto('villette-portico', 5)},
    'residence-curti':  {nome:'Residence Curti',  categoria:NUOVE, tipo:DC, luogo:DC,           stato:DC, foto:foto('residence-curti', 5)},
    'via-gorizia':      {nome:'Via Gorizia',      categoria:NUOVE, tipo:DC, luogo:'Mondragone', stato:DC, foto:foto('via-gorizia', 5)},
    /* le ristrutturazioni non hanno ancora foto né dati */
    'ristrutturazione-1': {nome:DC, categoria:RISTR, tipo:DC, luogo:DC, stato:DC, foto:[]},
    'ristrutturazione-2': {nome:DC, categoria:RISTR, tipo:DC, luogo:DC, stato:DC, foto:[]},
    'ristrutturazione-3': {nome:DC, categoria:RISTR, tipo:DC, luogo:DC, stato:DC, foto:[]}
  };

  const scheda = document.getElementById('scheda');
  if(!scheda) return;
  const $ = s => scheda.querySelector(s);
  const PREFISSO = '#progetto/';

  /* un valore segnaposto si vede come gli altri [DA CONFERMARE] del sito */
  function valore(el, v){
    el.textContent = v;
    el.classList.toggle('todo', v === DC);
  }

  function riempi(p){
    $('.scheda__cat').textContent = p.categoria;
    valore($('.scheda__t'), p.nome);
    valore($('[data-campo="tipo"]'),  p.tipo);
    valore($('[data-campo="luogo"]'), p.luogo);
    valore($('[data-campo="stato"]'), p.stato);
    const box = $('.scheda__foto');
    box.textContent = '';
    /* le foto si chiedono solo qui, all'apertura: il sito non le paga */
    if(p.foto.length) p.foto.forEach((src, i)=>{
      const img = new Image();
      img.src = src; img.alt = `${p.nome}, foto ${i + 1}`;
      img.decoding = 'async';
      if(i > 1) img.loading = 'lazy';
      box.appendChild(img);
    });
    else for(let i = 0; i < 3; i++){
      const posto = document.createElement('div');
      posto.className = 'scheda__posto';
      posto.innerHTML = '<span class="todo">[DA CONFERMARE: foto]</span>';
      box.appendChild(posto);
    }
  }

  let aperta = null;
  function mostra(id){
    const p = DATI[id];
    if(!p) return false;
    if(aperta !== id){ riempi(p); scheda.scrollTop = 0; }
    aperta = id;
    scheda.hidden = false;
    document.body.classList.add('scheda-aperta');
    if(window.gsap) gsap.fromTo(scheda, {autoAlpha:0}, {autoAlpha:1, duration:.3, ease:'power2.out'});
    $('.scheda__indietro').focus({preventScroll:true});
    return true;
  }
  function nascondi(){
    if(aperta === null) return;
    aperta = null;
    const fine = ()=>{ scheda.hidden = true; document.body.classList.remove('scheda-aperta'); };
    if(window.gsap) gsap.to(scheda, {autoAlpha:0, duration:.2, ease:'power2.in', onComplete:fine});
    else fine();
  }

  const daHash = ()=> location.hash.startsWith(PREFISSO) ? location.hash.slice(PREFISSO.length) : null;
  /* aperta da un link diretto: non c'è una pagina di prima a cui tornare */
  let diretta = false;

  function chiudi(){
    if(aperta === null) return;
    if(diretta){
      diretta = false;
      history.replaceState(null, '', location.pathname + location.search);
      nascondi();
    } else history.back();          /* popstate la nasconde */
  }

  document.querySelectorAll('.case__apri[data-progetto]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const id = a.dataset.progetto;
      if(!DATI[id]) return;
      history.pushState({progetto:id}, '', PREFISSO + id);
      mostra(id);
    });
  });
  $('.scheda__indietro').addEventListener('click', chiudi);
  addEventListener('keydown', e=>{ if(e.key === 'Escape' && aperta !== null) chiudi(); });
  addEventListener('popstate', ()=>{
    const id = daHash();
    if(id && DATI[id]) mostra(id); else nascondi();
  });

  const iniziale = daHash();
  if(iniziale && DATI[iniziale]){ diretta = true; mostra(iniziale); }

  /* Finito il preloader, le foto grandi delle schede si scaricano in
     coda, dopo tutto il resto: quando si apre una scheda ci sono già. */
  function precarica(){
    if(!window.CODA) return;
    Object.values(DATI).forEach(p => p.foto.forEach(src => CODA.prendi(src, 2, ()=>{})));
  }

  return { DATI, apri:mostra, chiudi, precarica };

})();
