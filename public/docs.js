/* ---------- Datenfluss: klickbare Knoten ---------- */
const FLOWDOC={
 cm:{t:'Coin Metrics · Pflichtquelle Krypto',h:'Volle Tageshistorie für BTC (seit 2010) und ETH (seit 2015) als CSV aus dem öffentlichen GitHub-Repo. <b>Format:</b> Spalten <code>time</code>, <code>PriceUSD</code>, Fallback <code>ReferenceRateUSD</code>. <b>Risiko:</b> Repo kann laggen — CoinGecko schließt die Lücke.'},
 gecko:{t:'CoinGecko · Lückenschluss',h:'REST-API, letzte 365 Tage täglich, CORS-frei ohne Key. Überschreibt beim Merge ältere Coin-Metrics-Werte am selben Datum. <b>Fallback:</b> Fällt die API aus, rechnet das Dashboard nur mit Coin Metrics weiter (Warnung in der Konsole).'},
 stooq:{t:'Yahoo &amp; Stooq · Metalle, Aktien, Währungen',h:'Tageshistorie für XAU/XAG/XPD, ^NDX, ^GSPC, die Basket-Aktien und die Währungspaare. <b>Yahoo ist primär, Stooq der Fallback</b> — beide mit Retry und wachsendem Backoff. <b>Kein CORS nötig:</b> Der Abruf passiert im täglichen Node-Lauf, nicht im Browser.'},
 compute:{t:'Compute · im täglichen Node-Lauf',h:'Merge &amp; Sortierung per Map, rollierende SMA in O(n), Perzentile über sortiertes Array + binäre Suche. Läuft <b>einmal pro Tag in GitHub Actions</b>, nicht im Browser: Ergebnis ist <code>snapshot.json</code>. Formeln identisch mit den validierten Referenzrechnungen.'},
 ui:{t:'UI · Rendern',h:'Angular-SPA (zoneless, Signals) — lädt ausschließlich <code>snapshot.json</code> und rendert: Farbband-Rails mit historischen Ghost-Markern, Zonen-Chips, 6-Jahres-Sparklines, Preisniveau-Tabellen. <b>Keine Marktlogik im Frontend.</b>'}
};
document.querySelectorAll('.node').forEach(n=>{
  const act=()=>{document.querySelectorAll('.node').forEach(x=>x.classList.toggle('on',x===n));
    const d=FLOWDOC[n.dataset.k];
    document.getElementById('flowinfo').innerHTML=`<span class="t">${d.t}</span>${d.h}`;};
  n.addEventListener('click',act);
  n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
});

/* ---------- Playground: echte BTC-Normierungskonstanten ---------- */
const LO=-22.6972, HI=40.2596; // min/max von ln(P/SMA374)·t^0.395 über die BTC-Historie
const fmt=n=>n.toLocaleString('de-DE');
function playRisk(){
  const p=+document.getElementById('s-p').value,
        s=+document.getElementById('s-s').value,
        d=+document.getElementById('s-d').value;
  document.getElementById('o-p').textContent=fmt(p)+' $';
  document.getElementById('o-s').textContent=fmt(s)+' $';
  document.getElementById('o-d').textContent=fmt(d)+' Tage'+(Math.abs(d-5800)<100?' (heute)':'');
  const r=Math.min(1,Math.max(0,(Math.log(p/s)*Math.pow(d,0.395)-LO)/(HI-LO)));
  const out=document.getElementById('riskout'); out.textContent=r.toFixed(2);
  out.style.color=r<0.2?'var(--teal)':r<0.5?'var(--amber)':'var(--red)';
  const z=document.getElementById('riskzone');
  const [txt,col]=r<0.05?['Kapitulation — max. Rate','var(--teal)']
    :r<0.10?['Rate erhöhen','var(--teal)']
    :r<0.20?['Basisrate-Zone','var(--teal)']
    :r<0.50?['Neutral — halten','var(--amber)']
    :r<0.75?['Erhöht — Gewinnmitnahmen prüfen','var(--amber)']
    :['Top-Zone — historisch Verkaufsgebiet','var(--red)'];
  z.textContent=txt; z.style.color=col; z.style.borderColor=col;
}
['s-p','s-s','s-d'].forEach(id=>document.getElementById(id).addEventListener('input',playRisk));
playRisk();

/* ---------- Zonen-Rail: draggbarer Marker ---------- */
const ZONES={
 btc:v=>v<0.05?['<b>Kapitulation.</b> Historisches Bodenniveau (2015: 0,04 · 2018: 0,00 · 2022: 0,04). Maximale DCA-Rate — dieses Regime hielt nie länger als wenige Wochen.']
   :v<0.10?['<b>Rate erhöhen.</b> Entspricht heute grob 53.000 $. Unterhalb dieser Schwelle waren Käufe in jeder bisherigen Zyklusphase profitabel, wenn man 2+ Jahre hielt.']
   :v<0.20?['<b>Basisrate.</b> Aktuelle Zone (0,16). Historisch günstig, aber ohne Kapitulationssignal — gestaffelt kaufen, Pulver für tiefere Werte behalten.']
   :v<0.50?['<b>Neutral.</b> Weder Edge auf der Kauf- noch Verkaufsseite. Bestehende Positionen laufen lassen.']
   :['<b>Obere Zone.</b> Zum Vergleich: Das 2025er-ATH erreichte nur noch 0,48 — die Zyklusamplituden schrumpfen. Werte darüber wären ein neues Euphorie-Regime.'],
 eth:v=>v<0.05?['<b>Kapitulation.</b> ETH-Böden lagen bei 0,00 (2018) und 0,09 (2022). Maximale Rate — aber ETH trägt These-Risiko (Doppeltop 2021/2025, schwaches ETH/BTC).']
   :v<0.10?['<b>Rate erhöhen.</b> Entspricht heute ~1.190 $, nahe dem 2022er-Bodenniveau. Historisch die Zone der stärksten Rebounds (+400 % nach 2022).']
   :v<0.25?['<b>Kleine Tranchen.</b> Aktuelle Zone (0,22). Konservativer als bei BTC staffeln, solange ETH/BTC keinen Boden bestätigt.']
   :v<0.50?['<b>Neutral.</b> Kein Edge. Beobachten, ob relative Stärke gegen BTC zurückkommt.']
   :['<b>Obere Zone.</b> ETH-Tops: 0,88 (2018) · 0,75 (2021) · 0,71 (2025) — auch hier fallende Amplituden.'],
 heat:v=>v<0.15?['<b>Akkumulation.</b> Nur an '+Math.round(v*100)+' % aller Handelstage lag das Asset tiefer unter seinem 200-Tage-Trend. Das statistische „Ausgebombt"-Regime — bei Palladium aktuell der spannendste Kontraindikator.']
   :v<0.85?['<b>Neutral.</b> Perzentil '+Math.round(v*100)+' % — die Trendabweichung ist unauffällig. Heat liefert hier keinen Edge; Entscheidung auf Ratio- oder Fundamentalebene treffen.']
   :['<b>Überhitzt.</b> Stärkere Extension gab es nur an '+Math.round((1-v)*100)+' % aller Tage. Beim KI-Basket wäre das Blasen-Regime — kein Timing für Neueinstiege, Trailing-Stops sinnvoll.']
};
let zAsset='btc';
const rail=document.getElementById('zrail'), handle=document.getElementById('zhandle');
function setZ(v){
  v=Math.min(1,Math.max(0,v));
  handle.style.left=(v*100)+'%';
  handle.setAttribute('aria-valuenow',v.toFixed(2));
  document.getElementById('zval').textContent=v.toFixed(2);
  document.getElementById('zverdict').innerHTML=ZONES[zAsset](v)[0];
}
function posFromEvent(e){
  const r=rail.getBoundingClientRect();
  const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  return x/r.width;
}
let drag=false;
handle.addEventListener('pointerdown',e=>{drag=true;handle.setPointerCapture(e.pointerId);});
window.addEventListener('pointermove',e=>{if(drag)setZ(posFromEvent(e));});
window.addEventListener('pointerup',()=>drag=false);
rail.addEventListener('pointerdown',e=>{if(e.target!==handle)setZ(posFromEvent(e));});
handle.addEventListener('keydown',e=>{
  const cur=parseFloat(handle.getAttribute('aria-valuenow'));
  if(e.key==='ArrowLeft')setZ(cur-0.01); if(e.key==='ArrowRight')setZ(cur+0.01);
});
document.querySelectorAll('[data-asset]').forEach(b=>b.addEventListener('click',()=>{
  zAsset=b.dataset.asset;
  document.querySelectorAll('[data-asset]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  setZ(parseFloat(handle.getAttribute('aria-valuenow')));
}));
setZ(0.16);

/* ---------- Copy-Buttons ---------- */
document.addEventListener('click',e=>{
  const btn=e.target.closest('.copybtn');
  if(!btn) return;
  navigator.clipboard.writeText(btn.parentElement.querySelector('code').innerText)
    .then(()=>{btn.textContent='Kopiert ✓';setTimeout(()=>btn.textContent='Kopieren',1600);});
});

/* ---------- Scroll-Spy ---------- */
const links=[...document.querySelectorAll('#sidenav a')];
const obs=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting)
    links.forEach(l=>l.classList.toggle('on',l.getAttribute('href')==='#'+e.target.id));});
},{rootMargin:'-30% 0px -60% 0px'});
document.querySelectorAll('main section').forEach(s=>obs.observe(s));
