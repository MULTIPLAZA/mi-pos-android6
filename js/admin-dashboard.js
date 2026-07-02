// ── Admin: Dashboard, Ventas, Terminales, Cajas ──

// Polyfill defensivo: lib/index.mjs carga async (type="module") y puede no
// haber seteado window._log/_warn/_err todavía cuando este archivo ejecuta.
// Fix BUG-07.
if (typeof window !== 'undefined') {
  if (typeof window._log  !== 'function') window._log  = function(){};
  if (typeof window._warn !== 'function') window._warn = function(){ console.warn.apply(console, arguments); };
  if (typeof window._err  !== 'function') window._err  = function(){ console.error.apply(console, arguments); };
}

// BUG-12 fix: las pantallas del admin usan <div class="pt"> como page title
// (heredado de un design system propio que evita h1/h2 por estilos). Esto
// rompe accesibilidad (lectores de pantalla pierden la jerarquía) y SEO.
// Como el contenido se renderiza dinámicamente con innerHTML, un selector
// estático no alcanza — un MutationObserver upgrada cada .pt nuevo a
// role="heading" aria-level="1" sin tocar ningún archivo más.
(function upgradePtToHeading(){
  function upgrade(){
    document.querySelectorAll('.pt:not([role])').forEach(function(el){
      el.setAttribute('role', 'heading');
      el.setAttribute('aria-level', '1');
    });
    // El dashboard usa su propio sistema con .dsh-title en vez de .pt — también lo cubrimos.
    document.querySelectorAll('.dsh-title:not([role])').forEach(function(el){
      el.setAttribute('role', 'heading');
      el.setAttribute('aria-level', '1');
    });
  }
  function start(){
    upgrade(); // procesa los que ya están al cargar
    new MutationObserver(upgrade).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();

// ── DASHBOARD ─────────────────────────────────────────────
function renderDashboard(){
  var c=document.getElementById('content');
  c.innerHTML=`
<style>
  .dsh-wrap{font-family:'Barlow',sans-serif;}
  .dsh-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;}
  .dsh-title{font-size:24px;font-weight:800;color:var(--text);line-height:1.1;}
  .dsh-sub{font-size:12px;color:var(--muted);margin-top:3px;}
  .dsh-pills{display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:3px;gap:2px;}
  .dsh-pill{background:transparent;border:none;color:var(--muted);font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;padding:7px 14px;border-radius:7px;cursor:pointer;letter-spacing:.3px;}
  .dsh-pill.on{background:var(--green);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);}
  .dsh-row{display:grid;gap:14px;margin-bottom:14px;}
  .dsh-row-3{grid-template-columns:repeat(3,1fr);}
  .dsh-row-2{grid-template-columns:repeat(2,1fr);}
  @media (max-width:900px){.dsh-row-3,.dsh-row-2{grid-template-columns:1fr;}}
  .dsh-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;position:relative;overflow:hidden;}
  .dsh-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--c,var(--green));}
  .dsh-kpi-lbl{font-size:11px;color:var(--muted);letter-spacing:.9px;text-transform:uppercase;font-weight:700;margin-bottom:8px;}
  .dsh-kpi-val{font-size:34px;font-weight:800;color:var(--text);line-height:1.05;letter-spacing:-.5px;}
  .dsh-kpi-val.lg{font-size:38px;color:var(--c,var(--text));}
  .dsh-kpi-diff{font-size:12px;margin-top:8px;display:flex;align-items:center;gap:6px;}
  .dsh-kpi-diff .ar{font-weight:800;}
  .dsh-split{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;}
  .dsh-split-hd{font-size:11px;color:var(--muted);letter-spacing:.9px;text-transform:uppercase;font-weight:700;margin-bottom:12px;}
  .dsh-split-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:12px;}
  .dsh-split-cell .l{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
  .dsh-split-cell .v{font-size:22px;font-weight:800;line-height:1.1;}
  .dsh-bar{height:10px;background:var(--card2);border-radius:6px;overflow:hidden;display:flex;}
  .dsh-bar-ef{background:var(--green);height:100%;transition:width .35s ease;}
  .dsh-bar-el{background:var(--orange);height:100%;transition:width .35s ease;}
  .dsh-bar-lg{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px;font-weight:600;}
  .dsh-cg{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;border-left:4px solid var(--c,var(--red));}
  .dsh-cg-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
  .dsh-cg-ttl{font-size:11px;color:var(--muted);letter-spacing:.9px;text-transform:uppercase;font-weight:700;}
  .dsh-cg-val{font-size:24px;font-weight:800;color:var(--c,var(--red));margin-top:4px;}
  .dsh-cg-cnt{font-size:11px;color:var(--muted);}
  .dsh-cg-row{display:flex;justify-content:space-between;padding:6px 0;font-size:12px;border-top:1px solid var(--border);}
  .dsh-cg-row:first-of-type{border-top:1px dashed var(--border);}
  .dsh-cg-row .ds{color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;}
  .dsh-cg-row .mt{font-weight:700;color:var(--text);}
  .dsh-charts{display:block;margin-top:14px;}
</style>
<div class="dsh-wrap">

<div class="dsh-head">
  <div>
    <div class="dsh-title">Dashboard</div>
    <div class="dsh-sub" id="dshSub">Resumen del día — actualizado en tiempo real</div>
  </div>
  <div class="dsh-pills">
    <button class="dsh-pill on" onclick="setFD('hoy',this)">Hoy</button>
    <button class="dsh-pill" onclick="setFD('semana',this)">Esta semana</button>
    <button class="dsh-pill" onclick="setFD('mes',this)">Este mes</button>
  </div>
</div>

<!-- Fila top: 3 métricas principales -->
<div class="dsh-row dsh-row-3">
  <div class="dsh-kpi" style="--c:var(--green);">
    <div class="dsh-kpi-lbl" id="kTLabel">Ventas de hoy</div>
    <div class="dsh-kpi-val lg" id="kT">₲0</div>
    <div class="dsh-kpi-diff" id="kTdiff">—</div>
  </div>
  <div class="dsh-kpi" style="--c:var(--blue);">
    <div class="dsh-kpi-lbl">Ticket promedio</div>
    <div class="dsh-kpi-val" id="kP">₲0</div>
    <div class="dsh-kpi-diff" id="kPdiff" style="color:var(--muted);">—</div>
  </div>
  <div class="dsh-kpi" style="--c:var(--blue);">
    <div class="dsh-kpi-lbl">Operaciones</div>
    <div class="dsh-kpi-val" id="kC">0</div>
    <div class="dsh-kpi-diff" id="kCdiff" style="color:var(--muted);">—</div>
  </div>
</div>

<!-- Fila secundaria: Efectivo vs POS/Transferencia con barra -->
<div class="dsh-row" style="grid-template-columns:1fr;">
  <div class="dsh-split">
    <div class="dsh-split-hd">Distribución por forma de cobro</div>
    <div class="dsh-split-row">
      <div class="dsh-split-cell">
        <div class="l">\u{1F4B5} Efectivo</div>
        <div class="v" style="color:var(--green);" id="kEf">₲0</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;" id="kEfPct">0% del total</div>
      </div>
      <div class="dsh-split-cell" style="text-align:right;">
        <div class="l">\u{1F4B3} POS / Transferencia</div>
        <div class="v" style="color:var(--orange);" id="kEl">₲0</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;" id="kElPct">0% del total</div>
      </div>
    </div>
    <div class="dsh-bar">
      <div class="dsh-bar-ef" id="barEf" style="width:50%;"></div>
      <div class="dsh-bar-el" id="barEl" style="width:50%;"></div>
    </div>
    <div class="dsh-bar-lg">
      <span id="barEfLg">₲0</span>
      <span id="barElLg">₲0</span>
    </div>
  </div>
</div>

<!-- Fila Compras / Gastos -->
<div class="dsh-row dsh-row-2">
  <div class="dsh-cg" style="--c:var(--red);background:linear-gradient(180deg,rgba(239,83,80,0.06),transparent 60%),var(--card);">
    <div class="dsh-cg-hd">
      <div>
        <div class="dsh-cg-ttl" id="comprasTitle">Compras — hoy</div>
        <div class="dsh-cg-val" id="comprasTotal" style="--c:var(--red);">₲0</div>
        <div class="dsh-cg-cnt" id="comprasCnt">0 registros</div>
      </div>
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(239,83,80,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      </div>
    </div>
    <div id="comprasList"><div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Cargando...</div></div>
  </div>
  <div class="dsh-cg" style="--c:var(--orange);background:linear-gradient(180deg,rgba(255,152,0,0.06),transparent 60%),var(--card);">
    <div class="dsh-cg-hd">
      <div>
        <div class="dsh-cg-ttl" id="gastosTitle">Gastos — hoy</div>
        <div class="dsh-cg-val" id="gastosTotal" style="--c:var(--orange);">₲0</div>
        <div class="dsh-cg-cnt" id="gastosCnt">0 registros</div>
      </div>
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,152,0,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
    </div>
    <div id="gastosList"><div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Cargando...</div></div>
  </div>
</div>

<div class="dsh-charts" id="dshCharts">
  <!-- Gráfico últimos 7 días + insights -->
  <div class="dsh-row" style="grid-template-columns:2fr 1fr;">
    <div class="card">
      <div class="card-h"><span class="card-t">Últimos 7 días</span></div>
      <div style="padding:14px;height:240px;"><canvas id="ch7Dias"></canvas></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="card" style="flex:1;">
        <div style="background:var(--green);padding:10px 14px;display:flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style="font-size:13px;font-weight:700;color:#fff;">Día más activo</span>
        </div>
        <div style="padding:14px;">
          <div style="font-size:22px;font-weight:800;color:var(--text);" id="diaMasActivo">—</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;" id="diaMasActivoSub">calculando...</div>
        </div>
      </div>
      <div class="card" style="flex:1;">
        <div style="background:var(--blue);padding:10px 14px;display:flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style="font-size:13px;font-weight:700;color:#fff;">Hora más activa</span>
        </div>
        <div style="padding:14px;">
          <div style="font-size:22px;font-weight:800;color:var(--text);" id="horaMasActiva">—</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;" id="horaMasActivaSub">calculando...</div>
        </div>
      </div>
    </div>
  </div>
  <!-- Categorías + Productos -->
  <div class="dsh-row dsh-row-2">
    <div class="card">
      <div class="card-h"><span class="card-t" id="catTitle">Participación por categoría</span></div>
      <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:260px;" id="catWrap">
        <canvas id="chCats" style="max-width:240px;max-height:240px;"></canvas>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><span class="card-t" id="prodTitle">Productos más vendidos</span></div>
      <div id="topProdsList" style="padding:8px 0;max-height:320px;overflow-y:auto;"></div>
    </div>
  </div>
  <!-- Formas de pago -->
  <div class="card">
    <div class="card-h"><span class="card-t" id="pagosTitle">Formas de pago</span></div>
    <div id="pagosCards" style="padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;"></div>
  </div>
  <!-- Heatmap -->
  <div class="card">
    <div class="card-h"><span class="card-t">Horarios pico (últimos 30 días)</span></div>
    <div style="padding:14px;" id="heatmapWrap"></div>
  </div>
</div>

</div>`;

  delete _dashCharts['ch7Dias'];
  delete _dashCharts['_heatDone'];

  if(typeof Chart==='undefined'){
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload=function(){ loadDashData(filtroD); };
    document.head.appendChild(s);
  } else {
    loadDashData(filtroD);
  }
}

// Compat stub — los gráficos ahora cargan automáticamente al entrar al dashboard
function toggleDashCharts(){ /* no-op: los gráficos se renderizan siempre */ }

function setFD(f,b){
  filtroD=f;
  document.querySelectorAll('.dsh-pill').forEach(function(x){x.classList.remove('on');});
  if(b) b.classList.add('on');
  loadDashData(f);
}

var _dashCharts={};
var _dashCache=null;
function _destroyChart(id){ if(_dashCharts[id]){try{_dashCharts[id].destroy();}catch(e){/* chart already destroyed */} delete _dashCharts[id];} }
function _mkChart(id,cfg){ _destroyChart(id); var el=document.getElementById(id); if(!el)return; _dashCharts[id]=new Chart(el,cfg); return _dashCharts[id]; }
function _isDark(){ return !document.documentElement.hasAttribute('data-theme')||document.documentElement.getAttribute('data-theme')==='dark'; }

async function loadDashData(f){
  var fd=getFD(f||'hoy');
  var hoy=new Date();
  var p2=function(n){return String(n).padStart(2,'0');};
  var fmt=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var $$=function(id){return document.getElementById(id);};

  var periodLabel=f==='hoy'?'hoy':f==='semana'?'esta semana':'este mes';
  if($$('kTLabel')) $$('kTLabel').textContent='Ventas '+periodLabel;
  if($$('dshSub')){
    $$('dshSub').textContent=f==='hoy'?'Resumen del día — actualizado en tiempo real':
                              f==='semana'?'Resumen de la semana en curso':'Resumen del mes en curso';
  }
  ['cat','prod','pagos','compras','gastos'].forEach(function(k){
    var el=$$( k+'Title');
    if(el) el.textContent=({'cat':'Participación por categoría','prod':'Productos más vendidos','pagos':'Formas de pago','compras':'Compras','gastos':'Gastos'}[k])+' — '+periodLabel;
  });

  try{
    // Aplicar offset Paraguay UTC-4
    // fd.d ej: '2026-05-01T00:00:00' → '2026-05-01T04:00:00' (medianoche PY = 04:00 UTC)
    var addDay=function(ds){
      // Incrementa la fecha sin depender del timezone del browser
      var parts=ds.substring(0,10).split('-');
      var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])+1);
      var p=function(n){return String(n).padStart(2,'0');};
      return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
    };
    var desdeTZ = fd.d.substring(0,10)+'T04:00:00';
    var hastaNextDay = addDay(fd.h.substring(0,10));
    var hastaTZ = hastaNextDay+'T03:59:59';

    // Datos del período
    _log('[Dash] Query ventas → email:', SE, '| desde:', desdeTZ, '| hasta:', hastaTZ);
    var v=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&anulada=is.false'+
      '&fecha=gte.'+desdeTZ+'&fecha=lte.'+hastaTZ+'&order=fecha.desc&limit=500');
    _log('[Dash] Resultados:', v.length, 'ventas, primera:', v[0]||'—');
    var tot=v.reduce(function(s,x){return s+(x.total||0);},0);
    var cnt=v.length;
    var totEf=v.filter(function(x){return (x.metodo_pago||'').toUpperCase()==='EFECTIVO';})
               .reduce(function(s,x){return s+(x.total||0);},0);
    var totEl=tot-totEf;

    // Período anterior
    var dAnt, hAnt;
    if(f==='mes'){
      dAnt=new Date(hoy.getFullYear(),hoy.getMonth()-1,1);
      hAnt=new Date(hoy.getFullYear(),hoy.getMonth(),0);
    } else {
      var ms={'hoy':86400000,'semana':7*86400000}[f]||86400000;
      dAnt=new Date(new Date(fd.d)-ms); hAnt=new Date(new Date(fd.h)-ms);
    }
    var dAntTZ=fmt(dAnt)+'T04:00:00';
    var hAntNextDay=addDay(fmt(hAnt));
    var hAntTZ=hAntNextDay+'T03:59:59';
    var vAnt=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&anulada=is.false'+
      '&fecha=gte.'+dAntTZ+'&fecha=lte.'+hAntTZ+'&limit=500');
    var totAnt=vAnt.reduce(function(s,x){return s+(x.total||0);},0);
    var cntAnt=vAnt.length;
    var avgAnt=cntAnt>0?Math.round(totAnt/cntAnt):0;
    var antLabel={'hoy':'ayer','semana':'semana ant.','mes':'mes ant.'}[f]||'período ant.';

    // KPIs
    // Cachear para charts on-demand
    _dashCache={v:v, f:f};

    // Helper de comparativa con flecha
    var renderDiff=function(elId,cur,prev){
      var el=$$(elId); if(!el) return;
      if(prev>0){
        var p=Math.round((cur-prev)/prev*100);
        var col=p>=0?'var(--green)':'var(--red)';
        var arrow=p>=0?'↑':'↓';
        el.innerHTML='<span class="ar" style="color:'+col+';">'+arrow+' '+Math.abs(p)+'%</span> <span style="color:var(--muted);">vs '+antLabel+'</span>';
      } else if(prev===0 && cur>0){
        el.innerHTML='<span class="ar" style="color:var(--green);">↑ nuevo</span> <span style="color:var(--muted);">vs '+antLabel+'</span>';
      } else {
        el.innerHTML='<span style="color:var(--muted);">Sin datos del '+antLabel+'</span>';
      }
    };
    var avgCur=cnt>0?Math.round(tot/cnt):0;

    // KPIs principales fila top
    if($$('kT')) $$('kT').textContent=gs(tot);
    if($$('kP')) $$('kP').textContent=gs(avgCur);
    if($$('kC')) $$('kC').textContent=cnt.toLocaleString('es-PY');
    renderDiff('kTdiff', tot, totAnt);
    renderDiff('kPdiff', avgCur, avgAnt);
    renderDiff('kCdiff', cnt, cntAnt);

    // Distribucion Efectivo / POS con barra
    if($$('kEf')) $$('kEf').textContent=gs(totEf);
    if($$('kEl')) $$('kEl').textContent=gs(totEl);
    var pctEf=tot>0?Math.round(totEf/tot*100):50;
    var pctEl=tot>0?100-pctEf:50;
    if($$('kEfPct')) $$('kEfPct').textContent=tot>0?pctEf+'% del total':'sin ventas';
    if($$('kElPct')) $$('kElPct').textContent=tot>0?pctEl+'% del total':'sin ventas';
    if($$('barEf')) $$('barEf').style.width=(tot>0?pctEf:50)+'%';
    if($$('barEl')) $$('barEl').style.width=(tot>0?pctEl:50)+'%';
    if($$('barEfLg')) $$('barEfLg').textContent=gs(totEf);
    if($$('barElLg')) $$('barElLg').textContent=gs(totEl);

    // Compras y gastos (siempre visibles)
    _renderComprasGastos(fd);

    // Cargar siempre los graficos avanzados (sin botón, todo automático)
    loadDashChartsData(f);

  }catch(e){ toast('Error al cargar dashboard'); console.warn('[Dash]',e.message); }
}

// ─── Carga on-demand de gráficos avanzados ───
async function loadDashChartsData(f){
  var $$=function(id){return document.getElementById(id);};
  var isDark=_isDark();
  var textColor=isDark?'#888':'#666';
  var gridColor=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)';
  var fontFam="'Barlow',sans-serif";
  var hoy=new Date();
  var p2=function(n){return String(n).padStart(2,'0');};
  var fmt=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var v=(_dashCache&&_dashCache.v)||[];
  var tot=v.reduce(function(s,x){return s+(x.total||0);},0);

  try{
    // Re-renderizar 7 dias e insights (siempre 30 dias)
    _destroyChart('ch7Dias');
    await _render7Dias(hoy,fmt,p2,textColor,gridColor,fontFam);
    _renderInsights(hoy,fmt,p2);

    // Mapa producto_id → categoria (para ventas históricas sin campo cat en items)
    var _catPorId={};
    try{
      var _prods=await sg('pos_productos',
        'licencia_email=ilike.'+encodeURIComponent(SE)+
        '&activo=eq.true&select=id,categoria&limit=2000');
      _prods.forEach(function(p){ if(p.id) _catPorId[p.id]=p.categoria||''; });
    }catch(e2){ console.warn('[Dash] No se pudo cargar productos para categorías:', e2.message); }

    // Parsear items del período
    var catsMap={}, prodsMap={};
    v.forEach(function(x){
      try{
        var items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]);
        if(!Array.isArray(items)) return;
        items.forEach(function(it){
          if(it.esDescuento) return;
          var cat=it.cat||it.category||it.categoria||_catPorId[it.id]||'Sin categoría';
          var nom=it.name||it.nombre||'—';
          var qty=it.qty||1;
          var sub=(it.price||it.precio||0)*qty;
          if(!catsMap[cat]) catsMap[cat]={tot:0,qty:0};
          catsMap[cat].tot+=sub; catsMap[cat].qty+=qty;
          if(!prodsMap[nom]) prodsMap[nom]={tot:0,qty:0,cat:cat};
          prodsMap[nom].tot+=sub; prodsMap[nom].qty+=qty;
        });
      }catch(e){ console.warn('[Dash] Error parseando items venta:', e.message); }
    });

    // Gráfico categorías — donut con %
    var catEntries=Object.entries(catsMap).sort(function(a,b){return b[1].tot-a[1].tot;});
    var catColors=['rgba(76,175,80,0.9)','rgba(66,165,245,0.9)','rgba(255,152,0,0.9)','rgba(239,83,80,0.9)','rgba(171,71,188,0.9)','rgba(0,188,212,0.9)','rgba(255,235,59,0.85)','rgba(255,87,34,0.9)'];
    _destroyChart('chCats');
    if($$('catWrap')){
      if(!catEntries.length){
        $$('catWrap').innerHTML='<div style="color:var(--muted);font-size:13px;">Sin datos</div>';
      } else {
        $$('catWrap').innerHTML='<canvas id="chCats" style="max-width:240px;max-height:240px;"></canvas>';
        _mkChart('chCats',{
          type:'doughnut',
          data:{
            labels:catEntries.map(function(e){return e[0];}),
            datasets:[{
              data:catEntries.map(function(e){return e[1].tot;}),
              backgroundColor:catColors,borderWidth:2,
              borderColor:isDark?'#161616':'#fff'
            }]
          },
          options:{
            responsive:false,
            plugins:{
              legend:{position:'bottom',labels:{color:textColor,font:{family:fontFam,size:10},padding:8,boxWidth:12}},
              tooltip:{callbacks:{
                label:function(c){
                  var pct=Math.round(c.raw/tot*100);
                  return ' '+c.label+': '+gs(c.raw)+' ('+pct+'%)';
                }
              }}
            }
          }
        });
      }
    }

    // Productos más vendidos
    var prodEntries=Object.entries(prodsMap).sort(function(a,b){return b[1].tot-a[1].tot;}).slice(0,10);
    if($$('topProdsList')){
      if(!prodEntries.length){
        $$('topProdsList').innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Sin datos</div>';
      } else {
        var maxT=prodEntries[0][1].tot||1;
        $$('topProdsList').innerHTML=prodEntries.map(function(e,i){
          var pct=Math.round(e[1].tot/maxT*100);
          var catIdx=catEntries.findIndex(function(c){return c[0]===e[1].cat;});
          var col=catColors[catIdx>=0?catIdx%catColors.length:0];
          return '<div style="padding:8px 16px;'+(i<prodEntries.length-1?'border-bottom:1px solid var(--border);':'')+'">'+
            '<div style="display:flex;justify-content:space-between;margin-bottom:5px;">'+
            '<span style="font-size:12px;font-weight:700;color:var(--text);max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+e[0]+'</span>'+
            '<span style="font-size:12px;font-weight:700;color:var(--text);">'+gs(e[1].tot)+'</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;">'+
            '<div style="flex:1;height:5px;background:var(--border);border-radius:3px;">'+
            '<div style="width:'+pct+'%;height:5px;background:'+col+';border-radius:3px;"></div></div>'+
            '<span style="font-size:11px;color:var(--muted);min-width:32px;text-align:right;">'+e[1].qty+'u.</span>'+
            '</div></div>';
        }).join('');
      }
    }

    // Formas de pago — descompone pagos divididos (ej "EFECTIVO + POS + POS")
    // a su método individual. Si la venta tiene div_pagos con los montos exactos,
    // usa esos. Si no (solo metodo_pago concatenado), aproxima dividiendo
    // equitativo entre los métodos involucrados.
    var pagosMap={};
    v.forEach(function(x){
      var metodoRaw=(x.metodo_pago||'EFECTIVO').toUpperCase();
      var total=x.total||0;
      var esDividido=metodoRaw.indexOf(' + ')>=0;

      if(esDividido){
        // Intentar usar div_pagos si vino del registro (montos exactos)
        var divs=null;
        if(x.div_pagos){
          try{ divs=typeof x.div_pagos==='string'?JSON.parse(x.div_pagos):x.div_pagos; }catch(e){}
        }

        if(Array.isArray(divs) && divs.length){
          var metodosVistos={};
          divs.forEach(function(d){
            var m=(d.metodo||'').toUpperCase();
            if(!m) return;
            if(!pagosMap[m]) pagosMap[m]={tot:0,cnt:0};
            pagosMap[m].tot+=(d.monto||0);
            metodosVistos[m]=true;
          });
          // 1 operación por cada método único de la venta
          Object.keys(metodosVistos).forEach(function(m){ pagosMap[m].cnt++; });
        } else {
          // Sin detalle: aproximar dividiendo total entre los métodos detectados
          var partes=metodoRaw.split(' + ').map(function(s){return s.trim();});
          var porParte=partes.length>0?total/partes.length:0;
          var metodosUnicos={};
          partes.forEach(function(m){
            if(!pagosMap[m]) pagosMap[m]={tot:0,cnt:0};
            pagosMap[m].tot+=porParte;
            metodosUnicos[m]=true;
          });
          Object.keys(metodosUnicos).forEach(function(m){ pagosMap[m].cnt++; });
        }
      } else {
        if(!pagosMap[metodoRaw]) pagosMap[metodoRaw]={tot:0,cnt:0};
        pagosMap[metodoRaw].tot+=total;
        pagosMap[metodoRaw].cnt++;
      }
    });
    var pEntries=Object.entries(pagosMap).sort(function(a,b){return b[1].tot-a[1].tot;});
    var pColores={'EFECTIVO':'var(--green)','POS':'var(--blue)','TRANSFERENCIA':'var(--orange)'};
    var pIconos={'EFECTIVO':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>','POS':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>','TRANSFERENCIA':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>'};
    if($$('pagosCards')){
      $$('pagosCards').innerHTML=pEntries.length?pEntries.map(function(e){
        var pct=tot>0?Math.round(e[1].tot/tot*100):0;
        var col=pColores[e[0]]||'var(--muted)';
        var ico=pIconos[e[0]]||'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>';
        return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;">'+
          '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+col+';"></div>'+
          '<div style="font-size:20px;margin-bottom:6px;">'+ico+'</div>'+
          '<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">'+e[0]+'</div>'+
          '<div style="font-size:20px;font-weight:800;color:'+col+';">'+gs(e[1].tot)+'</div>'+
          '<div style="font-size:12px;color:var(--muted);margin-top:4px;">'+pct+'% · '+e[1].cnt+' ops</div>'+
          '</div>';
      }).join(''):'<div style="color:var(--muted);font-size:13px;">Sin ventas</div>';
    }

    // Heatmap (siempre 30 dias)
    delete _dashCharts['_heatDone'];
    await _renderHeatmap(hoy,fmt,p2,textColor);

  }catch(e){ console.warn('[DashCharts]',e.message); }
}

async function _render7Dias(hoy,fmt,p2,textColor,gridColor,fontFam){
  // Últimos 7 días con fecha real
  var labels=[], totales=[], costos=[];
  var diasSem=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  for(var i=6;i>=0;i--){
    var d=new Date(hoy); d.setDate(hoy.getDate()-i);
    labels.push(diasSem[d.getDay()]+' '+d.getDate());
    totales.push(0); costos.push(0);
  }

  var hace7=new Date(hoy); hace7.setDate(hoy.getDate()-6); hace7.setHours(0,0,0,0);
  // Offset Paraguay UTC-4: desde T04:00:00 del día inicio hasta T03:59:59 del día siguiente al fin
  var p2tz7=function(n){return String(n).padStart(2,'0');};
  var addDay7=function(ds){var parts=ds.substring(0,10).split('-');var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])+1);return d.getFullYear()+'-'+p2tz7(d.getMonth()+1)+'-'+p2tz7(d.getDate());};
  var desde7TZ=fmt(hace7)+'T04:00:00';
  var hasta7NextDay=addDay7(fmt(hoy));
  var hasta7TZ=hasta7NextDay+'T03:59:59';
  var v7=await sg('pos_ventas',
    'licencia_email=ilike.'+encodeURIComponent(SE)+
    '&anulada=is.false'+
    '&fecha=gte.'+desde7TZ+'&fecha=lte.'+hasta7TZ+'&limit=1000');
  v7.forEach(function(x){
    var d=new Date(x.fecha);
    var diffDays=Math.round((new Date(fmt(d))-new Date(fmt(hace7)))/(86400000));
    if(diffDays>=0&&diffDays<7){
      totales[diffDays]+=(x.total||0);
      // Sumar costos de items
      try{
        var items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]);
        items.forEach(function(it){
          if(!it.esDescuento) costos[diffDays]+=(it.costo||0)*(it.qty||1);
        });
      }catch(e){ console.warn('[Dash] Error parseando items 7dias:', e.message); }
    }
  });
  var utilidad=totales.map(function(t,i){return Math.max(0,t-costos[i]);});

  _mkChart('ch7Dias',{
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        {label:'Ventas',data:totales,backgroundColor:'rgba(66,165,245,0.85)',borderRadius:4,borderWidth:0},
        {label:'Costos',data:costos,backgroundColor:'rgba(200,200,200,0.4)',borderRadius:4,borderWidth:0,hidden:true},
        {label:'Utilidad',data:utilidad,backgroundColor:'rgba(76,175,80,0.7)',borderRadius:4,borderWidth:0,hidden:true}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{color:textColor,font:{family:fontFam,size:11},padding:12,boxWidth:12}},
        tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': '+gs(c.raw);}}}
      },
      scales:{
        x:{ticks:{color:textColor,font:{family:fontFam,size:10}},grid:{color:gridColor}},
        y:{ticks:{color:textColor,font:{family:fontFam,size:10},callback:function(v2){
          if(v2>=1000000) return 'Gs '+Math.round(v2/1000000)+'M';
          if(v2>=1000) return 'Gs '+Math.round(v2/1000)+'k';
          return 'Gs '+v2;
        }},grid:{color:gridColor}}
      }
    }
  });
}

async function _renderInsights(hoy,fmt,p2){
  var diasNom=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var $$=function(id){return document.getElementById(id);};
  var hace30=new Date(hoy); hace30.setDate(hoy.getDate()-30);
  // Offset Paraguay UTC-4
  var p2tzI=function(n){return String(n).padStart(2,'0');};
  var addDayI=function(ds){var parts=ds.substring(0,10).split('-');var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])+1);return d.getFullYear()+'-'+p2tzI(d.getMonth()+1)+'-'+p2tzI(d.getDate());};
  var desdeITZ=fmt(hace30)+'T04:00:00';
  var hastaINextDay=addDayI(fmt(hoy));
  var hastaITZ=hastaINextDay+'T03:59:59';
  try{
    var vH=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&anulada=is.false'+
      '&fecha=gte.'+desdeITZ+'&fecha=lte.'+hastaITZ+'&limit=2000');
    // Día más activo — mismo mapeo que heatmap: lun=0 ... dom=6
    var diaMap=new Array(7).fill(0), diaCount=new Array(7).fill(0);
    var hrMap=new Array(24).fill(0), hrCount=new Array(24).fill(0);
    var diasVistos={};
    vH.forEach(function(x){
      var d=new Date(x.fecha);
      var dow=(d.getDay()||7)-1; // lun=0, mar=1 ... dom=6
      var hr=d.getHours();
      var dayKey=fmt(d);
      if(!diasVistos[dayKey]) diasVistos[dayKey]=dow;
      diaMap[dow]+=(x.total||0);
      diaCount[dow]++;
      hrMap[hr]+=(x.total||0);
      hrCount[hr]++;
    });
    // Contar cuántos días únicos hubo de cada dow
    var dowCount=new Array(7).fill(0);
    Object.values(diasVistos).forEach(function(dow){dowCount[dow]++;});
    var maxDia=0, maxDiaIdx=0;
    for(var d2=0;d2<7;d2++){
      var avg=dowCount[d2]>0?diaMap[d2]/dowCount[d2]:0;
      if(avg>maxDia){maxDia=avg;maxDiaIdx=d2;}
    }
    if($$('diaMasActivo')) $$('diaMasActivo').textContent=diasNom[maxDiaIdx];
    if($$('diaMasActivoSub')) $$('diaMasActivoSub').textContent='Prom. ventas: '+gs(Math.round(maxDia));

    var maxHr=0, maxHrIdx=0;
    for(var h2=0;h2<24;h2++){
      var avgH=hrCount[h2]>0?hrMap[h2]/hrCount[h2]:0;
      if(avgH>maxHr){maxHr=avgH;maxHrIdx=h2;}
    }
    if($$('horaMasActiva')) $$('horaMasActiva').textContent=p2(maxHrIdx)+':00';
    if($$('horaMasActivaSub')) $$('horaMasActivaSub').textContent='Prom. '+gs(Math.round(maxHr))+' por hora';
  }catch(e){ toast('Error al cargar insights'); console.warn('[Insights]',e.message); }
}

async function _renderComprasGastos(fd){
  var $$=function(id){return document.getElementById(id);};

  // Obtener licencia_id
  // BUG-08 fix: si la query devuelve [], `[0].id` tiraba TypeError uncaught
  // dentro del catch — dejando licId undefined Y rompiendo el resto del render
  // (cards quedaban en "Cargando..." infinito).
  var licId=SLI;
  if(!licId){
    try{
      var lr=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
      if(lr && lr[0] && lr[0].id){ licId=lr[0].id; SLI=licId; }
    }catch(e){ console.warn('[Dash] Error obteniendo licencia:', e.message); }
  }

  var _card=function(tot,cnt,rows,tipo){
    var col=tipo==='compras'?'var(--red)':'var(--orange)';
    if(!cnt) return '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin registros en el período</div>';
    return '<div style="margin-bottom:12px;">'+
      '<div style="font-size:26px;font-weight:800;color:'+col+';">'+gs(tot)+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+cnt+' registros</div></div>'+
      rows.slice(0,5).map(function(r,i){
        var desc=r.proveedor||r.concepto||r.descripcion||(tipo==='compras'?'Compra':'Gasto');
        var monto=r.total||r.monto||0;
        return '<div style="display:flex;justify-content:space-between;padding:7px 0;'+(i<Math.min(rows.length,5)-1?'border-bottom:1px solid var(--border);':'')+'font-size:13px;">'+
          '<span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+desc+'</span>'+
          '<span style="font-weight:700;">'+gs(monto)+'</span></div>';
      }).join('');
  };

  // Helpers nuevos IDs (rediseño dashboard)
  var setTot=function(tipo,tot,cnt){
    var totEl=$$( tipo+'Total');
    var cntEl=$$( tipo+'Cnt');
    if(totEl) totEl.textContent=gs(tot);
    if(cntEl) cntEl.textContent=cnt+' registro'+(cnt===1?'':'s');
  };
  var setList=function(tipo,rows){
    var listEl=$$( tipo+'List');
    if(!listEl) return;
    if(!rows.length){
      listEl.innerHTML='<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;font-style:italic;">Sin registros en el periodo</div>';
      return;
    }
    listEl.innerHTML=rows.slice(0,3).map(function(r){
      var desc=r.proveedor||r.concepto||r.descripcion||(tipo==='compras'?'Compra':'Gasto');
      var monto=r.total||r.monto||0;
      var fch=r.fecha?(function(){var d=new Date(r.fecha);var p=function(n){return String(n).padStart(2,'0');};return p(d.getDate())+'/'+p(d.getMonth()+1);})():'--';
      return '<div class="dsh-cg-row">'+
        '<span class="ds"><span style="color:var(--muted);font-weight:700;">'+fch+'</span> &middot; '+desc+'</span>'+
        '<span class="mt">'+gs(monto)+'</span>'+
      '</div>';
    }).join('');
  };

  if(!licId){
    setTot('compras',0,0); setList('compras',[]);
    setTot('gastos',0,0); setList('gastos',[]);
    if($$('comprasWrap')) $$('comprasWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin licencia</div>';
    if($$('gastosWrap')) $$('gastosWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin licencia</div>';
    return;
  }

  var fd0=fd.d.substring(0,10), fh0=fd.h.substring(0,10);
  var addDayCG=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};

  // Compras — tabla stock_comprobantes con licencia_id
  // El monto se guarda en la columna `total_monto` (no `total` ni `monto`).
  // Para compras viejas con total_monto NULL, calculamos desde stock_comprobante_items.
  try{
    var comp=await sg('stock_comprobantes',
      'licencia_id=eq.'+licId+
      '&tipo=in.(compra,entrada)'+
      '&fecha=gte.'+fd0+'T04:00:00'+
      '&fecha=lte.'+addDayCG(fh0)+'T03:59:59'+
      '&order=fecha.desc&limit=100');

    // Identificar comprobantes sin total_monto y calcular desde items
    var faltantes = comp.filter(function(c){
      var v = parseFloat(c.total_monto);
      return !v || isNaN(v);
    }).map(function(c){ return c.id; });

    if(faltantes.length){
      try {
        var items = await sg('stock_comprobante_items',
          'comprobante_id=in.('+faltantes.join(',')+')'+
          '&select=comprobante_id,cantidad,costo_unitario&limit=5000');
        var totales = {};
        items.forEach(function(i){
          var subt = (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0);
          // cantidad puede venir negativa en transferencias_salida; tomamos abs
          totales[i.comprobante_id] = (totales[i.comprobante_id]||0) + Math.abs(subt);
        });
        comp.forEach(function(c){
          if(!c.total_monto && totales[c.id]) c.total_monto = totales[c.id];
        });
      } catch(eItems){ console.warn('[Dash] Items compra fallback error:', eItems.message); }
    }

    // Normalizar el campo que lee setList/_card
    comp.forEach(function(c){ c.total = parseFloat(c.total_monto) || 0; });

    var totC = comp.reduce(function(s,x){ return s + (parseFloat(x.total)||0); }, 0);
    setTot('compras', totC, comp.length);
    setList('compras', comp);
    if($$('comprasWrap')) $$('comprasWrap').innerHTML=_card(totC,comp.length,comp,'compras');
  }catch(e){
    setTot('compras', 0, 0);
    setList('compras', []);
    if($$('comprasWrap')) $$('comprasWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin datos de compras</div>';
  }

  // Gastos — tabla gastos con licencia_id
  try{
    var gast=await sg('gastos',
      'licencia_id=eq.'+licId+
      '&fecha=gte.'+fd0+
      '&fecha=lte.'+fh0+
      '&order=fecha.desc&limit=100');
    var totG=gast.reduce(function(s,x){return s+(x.monto||x.total||0);},0);
    setTot('gastos', totG, gast.length);
    setList('gastos', gast);
    if($$('gastosWrap')) $$('gastosWrap').innerHTML=_card(totG,gast.length,gast,'gastos');
  }catch(e){
    setTot('gastos', 0, 0);
    setList('gastos', []);
    if($$('gastosWrap')) $$('gastosWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin datos de gastos</div>';
  }
}

async function _renderHeatmap(hoy,fmt,p2,textColor){
  var heatData=new Array(7).fill(null).map(function(){return new Array(24).fill(0);});
  var hace30=new Date(hoy); hace30.setDate(hoy.getDate()-30);
  // Offset Paraguay UTC-4
  var p2tzH=function(n){return String(n).padStart(2,'0');};
  var addDayH=function(ds){var parts=ds.substring(0,10).split('-');var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])+1);return d.getFullYear()+'-'+p2tzH(d.getMonth()+1)+'-'+p2tzH(d.getDate());};
  var desdeHTZ=fmt(hace30)+'T04:00:00';
  var hastaHNextDay=addDayH(fmt(hoy));
  var hastaHTZ=hastaHNextDay+'T03:59:59';
  var vH=await sg('pos_ventas',
    'licencia_email=ilike.'+encodeURIComponent(SE)+
    '&anulada=is.false'+
    '&fecha=gte.'+desdeHTZ+'&fecha=lte.'+hastaHTZ+'&limit=2000');
  vH.forEach(function(x){var d4=new Date(x.fecha);heatData[(d4.getDay()||7)-1][d4.getHours()]+=(x.total||0);});
  var maxH=Math.max.apply(null,heatData.map(function(r){return Math.max.apply(null,r);}));
  var diasN=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var html='<div style="overflow-x:auto;"><div style="display:grid;grid-template-columns:40px repeat(24,1fr);gap:2px;min-width:600px;">';
  html+='<div></div>';
  for(var h2=0;h2<24;h2++) html+='<div style="text-align:center;font-size:9px;color:'+textColor+';padding:2px 0;">'+p2(h2)+'</div>';
  for(var dw=0;dw<7;dw++){
    html+='<div style="font-size:10px;color:'+textColor+';display:flex;align-items:center;font-weight:700;">'+diasN[dw]+'</div>';
    for(var hr2=0;hr2<24;hr2++){
      var val=heatData[dw][hr2];
      var intensity=maxH>0?val/maxH:0;
      var alpha=val>0&&intensity<0.08?0.1:intensity;
      html+='<div title="'+diasN[dw]+' '+p2(hr2)+':00 \u2014 '+gs(val)+'" style="height:22px;border-radius:3px;background:rgba(76,175,80,'+alpha.toFixed(2)+');cursor:default;"></div>';
    }
  }
  html+='</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px;justify-content:flex-end;">';
  html+='<span style="font-size:10px;color:'+textColor+';">Bajo</span>';
  for(var li=0;li<=4;li++){html+='<div style="width:16px;height:16px;border-radius:3px;background:rgba(76,175,80,'+(li/4*0.9+0.06).toFixed(2)+');"></div>';}
  html+='<span style="font-size:10px;color:'+textColor+';">Alto</span></div></div>';
  var hwrap=document.getElementById('heatmapWrap');
  if(hwrap) hwrap.innerHTML=html;
  _dashCharts['_heatDone']=true;
}



function renderVentas(){
  var c=document.getElementById('content');
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var fmtDate=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var hoyStr=fmtDate(hoy);

  c.innerHTML=
    '<style>'+
    '.vh-wrap{font-family:\'Barlow\',sans-serif;}'+
    '.vh-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;}'+
    '.vh-title{font-size:24px;font-weight:800;color:var(--text);line-height:1.1;}'+
    '.vh-sub{font-size:12px;color:var(--muted);margin-top:3px;}'+
    '.vh-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;}'+
    '@media (max-width:760px){.vh-kpis{grid-template-columns:1fr;}}'+
    '.vh-kpi{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;border-left:4px solid var(--c,var(--green));}'+
    '.vh-kpi-l{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.7px;margin-bottom:4px;}'+
    '.vh-kpi-v{font-size:22px;font-weight:800;color:var(--c,var(--text));line-height:1.05;}'+
    '.vh-kpi-c{font-size:11px;color:var(--muted);margin-top:3px;}'+
    '.vh-filt{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}'+
    '.vh-filt-grp{display:flex;flex-direction:column;gap:6px;}'+
    '.vh-filt-l{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.5px;}'+
    '.vh-pills{display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px;}'+
    '.vh-pill{background:transparent;border:none;color:var(--muted);font-family:\'Barlow\',sans-serif;font-size:12px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer;}'+
    '.vh-pill.on{background:var(--green);color:#fff;}'+
    '.vh-srch-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:var(--card2);border-bottom:1px solid var(--border);}'+
    '.vh-srch-i{background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:\'Barlow\',sans-serif;font-size:12px;padding:7px 10px;outline:none;flex:1;min-width:140px;}'+
    '.vh-srch-num{width:120px;flex:0 0 auto;}'+
    '.vh-cnt{font-size:11px;color:var(--muted);margin-left:auto;font-weight:600;white-space:nowrap;}'+
    '.vh-tbl-wrap{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;}'+
    '.vh-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}'+
    '.vh-tbl thead th{background:var(--card2);color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;}'+
    '.vh-tbl tbody tr{border-bottom:1px solid var(--border);transition:background .15s;}'+
    '.vh-tbl tbody tr:hover{background:var(--card2);cursor:pointer;}'+
    '.vh-tbl tbody td{padding:10px 12px;vertical-align:middle;}'+
    '.vh-fc-d{font-size:13px;font-weight:700;color:var(--text);line-height:1.1;}'+
    '.vh-fc-h{font-size:11px;color:var(--muted);margin-top:2px;}'+
    '.vh-tm-n{font-size:12px;font-weight:600;color:var(--text);}'+
    '.vh-tm-s{font-size:10.5px;color:var(--muted);margin-top:1px;}'+
    '.vh-bdg{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;padding:3px 8px;border-radius:4px;text-transform:uppercase;}'+
    '.vh-bdg-fact{background:var(--b2);color:var(--blue);border:1px solid rgba(66,165,245,.3);}'+
    '.vh-bdg-tick{background:var(--card2);color:var(--muted);border:1px solid var(--border);}'+
    '.vh-bdg-ef{background:var(--g2);color:var(--green);}'+
    '.vh-bdg-pos{background:var(--b2);color:var(--blue);}'+
    '.vh-bdg-tr{background:var(--o2);color:var(--orange);}'+
    '.vh-tot{font-size:14px;font-weight:800;color:var(--green);}'+
    '.vh-arr{color:var(--muted);font-size:11px;text-align:center;}'+
    '.vh-bdg-anul{background:var(--r2);color:var(--red);border:1px solid rgba(239,83,80,.35);}'+
    '.vh-row-anul{opacity:.5;}'+
    '.vh-row-anul .vh-tot{text-decoration:line-through;color:var(--red);}'+
    '.vh-btn-anul{background:var(--r2);border:1px solid var(--red);color:var(--red);font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:700;border-radius:6px;padding:5px 10px;cursor:pointer;white-space:nowrap;}'+
    '.vh-btn-anul:hover{background:var(--red);color:#fff;}'+
    '</style>'+
    '<div class="vh-wrap">'+
    '<div class="vh-head">'+
      '<div><div class="vh-title">Historial de Ventas</div><div class="vh-sub">Todas las transacciones registradas</div></div>'+
    '</div>'+
    '<div class="vh-kpis">'+
      '<div class="vh-kpi" style="--c:var(--green);">'+
        '<div class="vh-kpi-l">Total facturado</div>'+
        '<div class="vh-kpi-v" id="vKTot">--</div>'+
        '<div class="vh-kpi-c" id="vKTotC">0 ventas</div>'+
      '</div>'+
      '<div class="vh-kpi" style="--c:var(--green);">'+
        '<div class="vh-kpi-l">Cobrado en efectivo</div>'+
        '<div class="vh-kpi-v" id="vKEf">--</div>'+
        '<div class="vh-kpi-c" id="vKEfC">0%</div>'+
      '</div>'+
      '<div class="vh-kpi" style="--c:var(--orange);">'+
        '<div class="vh-kpi-l">POS / Transferencia</div>'+
        '<div class="vh-kpi-v" id="vKEl">--</div>'+
        '<div class="vh-kpi-c" id="vKElC">0%</div>'+
      '</div>'+
    '</div>'+
    '<div class="vh-filt">'+
      '<div class="vh-filt-grp">'+
        '<div class="vh-filt-l">Periodo rapido</div>'+
        '<div class="vh-pills">'+
          '<button class="vh-pill on" id="vBtn_hoy" onclick="setFV(\'hoy\',this)">Hoy</button>'+
          '<button class="vh-pill" id="vBtn_semana" onclick="setFV(\'semana\',this)">Semana</button>'+
          '<button class="vh-pill" id="vBtn_mes" onclick="setFV(\'mes\',this)">Mes</button>'+
        '</div>'+
      '</div>'+
      '<div class="vh-filt-grp"><div class="vh-filt-l">Desde</div><input type="date" id="vFD" class="d-inp" value="'+hoyStr+'"></div>'+
      '<div class="vh-filt-grp"><div class="vh-filt-l">Hasta</div><input type="date" id="vFH" class="d-inp" value="'+hoyStr+'"></div>'+
      '<button class="btn-sv" onclick="setFV(\'custom\',null)">Buscar</button>'+
    '</div>'+
    '<div class="vh-tbl-wrap">'+
      '<div class="vh-srch-row">'+
        '<input class="vh-srch-i" id="vS_text" placeholder="Buscar terminal, sucursal, cliente..." oninput="filtrVAdv()">'+
        '<select class="vh-srch-i" id="vS_metodo" onchange="filtrVAdv()" style="flex:0 0 auto;width:140px;">'+
          '<option value="">Todo metodo</option>'+
          '<option value="EFECTIVO">Efectivo</option>'+
          '<option value="POS">POS</option>'+
          '<option value="TRANSFERENCIA">Transferencia</option>'+
        '</select>'+
        '<input class="vh-srch-i vh-srch-num" id="vS_min" type="number" placeholder="Monto min" oninput="filtrVAdv()">'+
        '<input class="vh-srch-i vh-srch-num" id="vS_max" type="number" placeholder="Monto max" oninput="filtrVAdv()">'+
        '<span class="vh-cnt" id="vCount">--</span>'+
      '</div>'+
      '<div style="overflow-x:auto;">'+
        '<table class="vh-tbl">'+
          '<thead><tr>'+
            '<th>Fecha / Hora</th>'+
            '<th>Terminal</th>'+
            '<th>Cliente</th>'+
            '<th>Tipo</th>'+
            '<th>Metodo</th>'+
            '<th style="text-align:right;">Total</th>'+
            '<th style="text-align:center;width:90px;">Estado</th>'+
            '<th style="width:32px;"></th>'+
          '</tr></thead>'+
          '<tbody id="vBody"><tr><td colspan="8" class="loading"><span class="sp"></span></td></tr></tbody>'+
        '</table>'+
      '</div>'+
    '</div>'+
    '</div>';
  loadVData('hoy');
}

function setFV(f,b){
  filtroV=f;
  ['vBtn_hoy','vBtn_semana','vBtn_mes'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('on');});
  if(b) b.classList.add('on');
  // Sincronizar inputs de fecha con el botón
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var fmtDate=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var fd=document.getElementById('vFD'), fh=document.getElementById('vFH');
  if(f==='hoy'&&fd&&fh){ var s=fmtDate(hoy); fd.value=s; fh.value=s; }
  if(f==='semana'&&fd&&fh){ var l=new Date(hoy); l.setDate(hoy.getDate()-((hoy.getDay()||7)-1)); fd.value=fmtDate(l); fh.value=fmtDate(hoy); }
  if(f==='mes'&&fd&&fh){ fd.value=fmtDate(new Date(hoy.getFullYear(),hoy.getMonth(),1)); fh.value=fmtDate(hoy); }
  loadVData(f);
}

async function loadVData(f){
  var body=document.getElementById('vBody');
  if(body) body.innerHTML='<tr><td colspan="8" class="loading"><span class="sp"></span></td></tr>';

  var desde, hasta;
  if(f==='custom'||f===undefined){
    // Rango personalizado desde los inputs
    var fdEl=document.getElementById('vFD'), fhEl=document.getElementById('vFH');
    desde=(fdEl?fdEl.value:'');
    hasta=(fhEl?fhEl.value:'');
    if(!desde||!hasta) return;
  } else {
    var fd=getFD(f);
    desde=fd.d.substring(0,10);
    hasta=fd.h.substring(0,10);
  }

  // Ajuste de zona horaria Paraguay (UTC-4): pedir con offset
  // Para cubrir el día local completo, pedimos desde las 04:00 UTC del día (=00:00 PY)
  // hasta las 03:59 UTC del día siguiente (=23:59 PY)
  var desdeTZ=desde+'T04:00:00';
  var hastaTZ=hasta+'T27:59:59'; // Supabase acepta esto, pero mejor usar día+1
  // Calcular día siguiente para el hasta
  var hastaDate=new Date(hasta+'T00:00:00');
  hastaDate.setDate(hastaDate.getDate()+1);
  var p2=function(n){return String(n).padStart(2,'0');};
  var hastaNext=hastaDate.getFullYear()+'-'+p2(hastaDate.getMonth()+1)+'-'+p2(hastaDate.getDate())+'T03:59:59';

  try{
    allVP=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha=gte.'+desdeTZ+
      '&fecha=lte.'+hastaNext+
      '&order=fecha.desc&limit=500');
    renderVT(allVP);
  }catch(e){
    if(document.getElementById('vBody'))
      document.getElementById('vBody').innerHTML='<tr><td colspan="8" class="loading">Error cargando</td></tr>';
  }
}

function renderVT(v){
  if(!document.getElementById('vCount')) return;
  // KPIs solo cuentan ventas ACTIVAS (no anuladas)
  var vAct = v.filter(function(x){ return !x.anulada; });
  var tot=vAct.reduce(function(s,x){return s+(x.total||0);},0);
  var ef=vAct.filter(function(x){return (x.metodo_pago||'').toUpperCase()==='EFECTIVO';}).reduce(function(s,x){return s+(x.total||0);},0);
  // ventas count: document.getElementById('vCount').textContent=v.length+' ventas — Total: \u20B2'+gs(tot);

  // KPIs nuevos (header arriba de la tabla)
  var el=tot-ef;
  var pctEf=tot>0?Math.round(ef/tot*100):0;
  var pctEl=tot>0?100-pctEf:0;
  var setT=function(id,val){var e2=document.getElementById(id); if(e2) e2.textContent=val;};
  setT('vKTot', gs(tot));
  var nAnul = v.length - vAct.length;
  setT('vKTotC', vAct.length+' ventas activas'+(nAnul?' · '+nAnul+' anuladas':''));
  setT('vKEf', gs(ef));
  setT('vKEfC', pctEf+'% del total');
  setT('vKEl', gs(el));
  setT('vKElC', pctEl+'% del total');
  setT('vCount', v.length+' resultado'+(v.length===1?'':'s'));

  // Helper: badge metodo de pago
  var mb=function(m){
    var u=(m||'').toUpperCase();
    if(u==='EFECTIVO') return '<span class="vh-bdg vh-bdg-ef">EF</span>';
    if(u==='POS') return '<span class="vh-bdg vh-bdg-pos">POS</span>';
    return '<span class="vh-bdg vh-bdg-tr">TR</span>';
  };
  // Helper: badge tipo (FACTURA azul / TICKET gris)
  var tipoTag=function(x){
    var tieneF=x.tiene_factura||false;
    try{ if(x.factura){ var fac=typeof x.factura==='string'?JSON.parse(x.factura):x.factura; if(fac&&fac.nro_factura) tieneF=true; } }catch(e){ console.warn('[Ventas] Error parseando factura:', e.message); }
    return tieneF?'<span class="vh-bdg vh-bdg-fact">FACTURA</span>':'<span class="vh-bdg vh-bdg-tick">TICKET</span>';
  };
  // Helper: nombre del cliente — prioriza el nombre rápido del ticket
  // (cliente_nombre) y cae al de la factura (factura.nombre).
  var cliName=function(x){
    if(x.cliente_nombre && String(x.cliente_nombre).trim()) return String(x.cliente_nombre).trim();
    try{ var f=typeof x.factura==='string'?JSON.parse(x.factura):x.factura; if(f&&f.nombre) return String(f.nombre).trim(); }catch(e){}
    return '';
  };
  // Helper: split fecha/hora
  var splitDT=function(f){
    if(!f) return {d:'--',h:''};
    var d=new Date(f);
    var p=function(n){return String(n).padStart(2,'0');};
    return {
      d: p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear(),
      h: p(d.getHours())+':'+p(d.getMinutes())
    };
  };
  var detalleHtml=function(x){
    var items=[];
    try{ items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]); }catch(e){ console.warn('[Ventas] Error parseando items:', e.message); }
    var factura=null;
    try{ factura=x.factura?(typeof x.factura==='string'?JSON.parse(x.factura):x.factura):null; }catch(e){ console.warn('[Ventas] Error parseando factura detalle:', e.message); }
    return '<tr id="det_'+x.id+'" style="display:none;"><td colspan="8" style="padding:0;background:var(--card2);">'+
      '<div style="padding:14px;border-top:2px solid var(--green);">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px;">'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Terminal</div><div style="font-weight:700;">'+(x.terminal||'—')+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Método</div><div style="font-weight:700;">'+(x.metodo_pago||'—').toUpperCase()+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Total</div><div style="font-weight:800;color:var(--green);">'+gs(x.total)+'</div></div>'+
      (factura&&factura.nro_factura?'<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">N° Factura</div><div style="font-weight:700;color:var(--blue);">'+factura.nro_factura+'</div></div>':'')+
      (cliName(x)?'<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Cliente</div><div style="font-weight:700;">'+_esc(cliName(x))+'</div></div>':'')+
      '</div>'+
      '<table style="font-size:12px;"><thead><tr>'+
        '<th>Producto</th><th>Categoría</th><th style="text-align:center">Cant.</th>'+
        '<th style="text-align:right">P.Unit</th><th style="text-align:right">Subtotal</th>'+
      '</tr></thead><tbody>'+
      (items.filter(function(it){return !it.esDescuento;}).map(function(it){
        return '<tr><td style="font-weight:600;">'+(it.name||it.nombre||'—')+'</td>'+
          '<td style="color:var(--muted);">'+(it.cat||it.categoria||'—')+'</td>'+
          '<td style="text-align:center;">'+(it.qty||1)+'</td>'+
          '<td style="text-align:right;">'+gs(it.price||it.precio||0)+'</td>'+
          '<td style="text-align:right;font-weight:700;">'+gs((it.price||it.precio||0)*(it.qty||1))+'</td></tr>';
      }).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--muted);">Sin detalle</td></tr>')+
      '</tbody></table></div></td></tr>';
  };

  document.getElementById('vBody').innerHTML=v.length?v.map(function(x){
    var dt=splitDT(x.fecha);
    var anul = !!x.anulada;
    var rowCls = anul ? ' class="vh-row-anul"' : '';
    var estadoCell = anul
      ? '<span class="vh-bdg vh-bdg-anul" title="'+_esc(x.motivo_anulacion||'')+'">ANULADA</span>'
      : '<button class="vh-btn-anul" onclick="event.stopPropagation();vAnularVenta('+x.id+')" title="Anular esta venta">Anular</button>';
    return '<tr'+rowCls+' onclick="vDetalle(\''+x.id+'\')">'+
      '<td><div class="vh-fc-d">'+dt.d+'</div><div class="vh-fc-h">'+dt.h+' hs</div></td>'+
      '<td><div class="vh-tm-n">'+(x.terminal||'--')+'</div>'+
        (x.sucursal?'<div class="vh-tm-s">'+x.sucursal+'</div>':'')+
      '</td>'+
      '<td>'+(function(){var n=cliName(x);return n?'<div class="vh-tm-n">'+_esc(n)+'</div>':'<span style="color:var(--muted)">—</span>';})()+'</td>'+
      '<td>'+tipoTag(x)+'</td>'+
      '<td>'+mb(x.metodo_pago)+'</td>'+
      '<td style="text-align:right;"><span class="vh-tot">'+gs(x.total)+'</span></td>'+
      '<td style="text-align:center;">'+estadoCell+'</td>'+
      '<td><span class="vh-arr" id="arr_'+x.id+'">+</span></td>'+
      '</tr>'+
      detalleHtml(x);
  }).join(''):'<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);font-size:13px;">Sin ventas en el periodo seleccionado</td></tr>';
}

// ── Helper para escapar HTML (evita XSS via motivo de anulación) ──
function _esc(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }

// ── ANULAR VENTA DESDE ADMIN ──────────────────────────────
// Marca pos_ventas.anulada=true + guarda motivo y timestamp.
// NO revierte stock automáticamente (porque no sabemos el depósito
// que pagó la venta). Si la venta había movido stock, hay que ajustar
// manualmente desde Inventarios → Movimientos.
function vAnularVenta(id){
  var venta = (allVP||[]).find(function(x){ return String(x.id) === String(id); });
  if(!venta){ toast('Venta no encontrada'); return; }
  if(venta.anulada){
    // Si quedó gestión fiscal pendiente (cancelación/NC que falló), permitir reintento
    if(venta.fe_cdc && String(venta.fe_estado) !== '99' && String(venta.fe_estado) !== '4' && !venta.fe_nc_cdc
       && typeof feProcesarAnulacionFiscal === 'function'){
      if(confirm('Esta venta ya está anulada, pero el documento electrónico sigue vigente en SIFEN.\n¿Reintentar la cancelación / Nota de Crédito?')){
        toast('Gestionando documento electrónico...');
        feProcesarAnulacionFiscal(venta, venta.motivo_anulacion || 'Anulación de la operación', SE)
          .then(function(r){ toast(r.mensaje, 4000); if(typeof loadVData === 'function') loadVData(filtroV||'hoy'); })
          .catch(function(e){ alert('Falló de nuevo: '+e.message); });
      }
      return;
    }
    toast('Esta venta ya está anulada'); return;
  }

  var prev = document.getElementById('vAnulOv');
  if(prev) prev.remove();

  var tieneFac = !!venta.tiene_factura;

  // Documento electrónico: informar qué acción fiscal va a disparar la anulación
  var feAviso = '';
  if(venta.fe_cdc){
    var _horasFE = (Date.now() - new Date(venta.fe_fecha_emision || venta.fecha).getTime()) / 36e5;
    if(String(venta.fe_estado) === '99'){
      feAviso = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);">El documento electrónico ya está cancelado en SIFEN.</div>';
    } else if(venta.fe_nc_cdc){
      feAviso = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);">Ya existe Nota de Crédito: '+_esc(venta.fe_nc_numero||'')+'</div>';
    } else if(_horasFE <= 48){
      feAviso = '<div style="background:rgba(66,165,245,.08);border:1px solid var(--blue);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--blue);font-weight:700;">⚡ Documento electrónico (menos de 48hs): se enviará el EVENTO DE CANCELACIÓN a SIFEN.</div>';
    } else {
      feAviso = '<div style="background:rgba(66,165,245,.08);border:1px solid var(--blue);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--blue);font-weight:700;">⚡ Documento electrónico (más de 48hs): se emitirá una NOTA DE CRÉDITO electrónica por el total.</div>';
    }
  }

  var ov = document.createElement('div');
  ov.id = 'vAnulOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1001;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Barlow,sans-serif;';
  ov.innerHTML =
    '<div style="background:var(--card);border:1px solid var(--red);border-radius:14px;max-width:460px;width:100%;padding:24px">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      +'<div style="width:44px;height:44px;border-radius:50%;background:var(--r2);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
        +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      +'</div>'
      +'<div>'
        +'<div style="font-size:16px;font-weight:800;color:var(--text)">Anular venta #'+venta.id+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">Total: '+gs(venta.total)+' · '+(venta.metodo_pago||'EFECTIVO').toUpperCase()+'</div>'
      +'</div>'
    +'</div>'
    +(tieneFac && !feAviso
      ?'<div style="background:var(--r2);border:1px solid rgba(239,83,80,.35);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--red);font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Esta venta tiene factura asociada. Quedará marcada como anulada en los reportes.</div>'
      :'')
    +feAviso
    +'<div style="background:rgba(255,152,0,.08);border:1px solid var(--orange);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text);line-height:1.5">'
      +'<strong style="color:var(--orange)">Importante:</strong> esta acción <strong>NO revierte stock automáticamente</strong>. Si la venta había descontado mercadería, ajustá desde Inventarios → Movimientos.'
    +'</div>'
    +'<label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px">Motivo de anulación (obligatorio)</label>'
    +'<input type="text" id="vAnulMot" class="cfg-inp" style="width:100%;margin-bottom:18px" placeholder="Ej: Error de carga, prueba, devolución del cliente...">'
    +'<div style="display:flex;gap:10px">'
      +'<button onclick="document.getElementById(\'vAnulOv\').remove()" class="btn-dn" style="flex:1;padding:12px">Cancelar</button>'
      +'<button onclick="vAnularVentaConfirmar('+venta.id+')" class="btn-sv" style="flex:1.5;padding:12px;background:var(--red);border-color:var(--red)">Confirmar anulación</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var inp=document.getElementById('vAnulMot'); if(inp) inp.focus(); }, 50);
}

async function vAnularVentaConfirmar(id){
  var motivo = (document.getElementById('vAnulMot')||{}).value || '';
  if(!motivo.trim()){ toast('El motivo es obligatorio'); return; }
  var btn = document.querySelector('[onclick="vAnularVentaConfirmar('+id+')"]');
  if(btn){ btn.disabled = true; btn.textContent = 'Procesando...'; }
  try{
    await supaPatch('pos_ventas','id=eq.'+id+'&licencia_email=ilike.'+encodeURIComponent(SE),{
      anulada: true,
      fecha_anulacion: new Date().toISOString(),
      motivo_anulacion: motivo.trim().substring(0,500)
    });
    var ov = document.getElementById('vAnulOv'); if(ov) ov.remove();
    toast('Venta anulada');

    // Documento electrónico: cancelación en SIFEN (≤48hs) o Nota de Crédito (>48hs)
    var _ventaFE = (allVP||[]).find(function(x){ return String(x.id) === String(id); });
    if(_ventaFE && _ventaFE.fe_cdc && String(_ventaFE.fe_estado) !== '99' && !_ventaFE.fe_nc_cdc
       && typeof feProcesarAnulacionFiscal === 'function'){
      toast('Gestionando documento electrónico en SIFEN...');
      try{
        var rfe = await feProcesarAnulacionFiscal(_ventaFE, motivo.trim(), SE);
        toast(rfe.mensaje, 4000);
      }catch(eFE){
        alert('La venta quedó ANULADA en el sistema, pero la gestión fiscal falló:\n\n'+eFE.message+
              '\n\nPodés reintentar anulando de nuevo o gestionarlo desde la consola de FacturaSend.');
      }
    }

    // Refrescar la lista
    if(typeof loadVData === 'function') loadVData(filtroV||'hoy');
  }catch(e){
    toast('Error al anular: '+e.message);
    if(btn){ btn.disabled = false; btn.textContent = 'Confirmar anulación'; }
  }
}

function vDetalle(id){
  var row=document.getElementById('det_'+id);
  var arr=document.getElementById('arr_'+id);
  if(!row) return;
  var visible=row.style.display!=='none';
  // Cerrar todos
  allVP.forEach(function(x){
    var r=document.getElementById('det_'+x.id);
    var a=document.getElementById('arr_'+x.id);
    if(r) r.style.display='none';
    if(a) a.textContent='+';
  });
  // Abrir este si estaba cerrado
  if(!visible){
    row.style.display='';
    if(arr) arr.textContent='-';
    setTimeout(function(){ row.scrollIntoView({behavior:'smooth',block:'nearest'}); },100);
  }
}

function filtrV(q){
  if(!allVP||!allVP.length) return;
  var f=q.toLowerCase();
  renderVT(!q?allVP:allVP.filter(function(v){
    return (v.terminal||'').toLowerCase().includes(f)||
           (v.metodo_pago||'').toLowerCase().includes(f)||
           (v.sucursal||'').toLowerCase().includes(f)||
           gs(v.total).includes(f);
  }));
}

// Filtro avanzado: texto + metodo + rango de monto
function filtrVAdv(){
  if(!allVP) return;
  var get=function(id){var e=document.getElementById(id); return e?e.value:'';};
  var txt=get('vS_text').toLowerCase().trim();
  var met=get('vS_metodo').toUpperCase();
  var mn=parseFloat(get('vS_min'))||0;
  var mx=parseFloat(get('vS_max'))||Infinity;
  var filt=allVP.filter(function(v){
    var matchTxt=!txt||
      (v.terminal||'').toLowerCase().includes(txt)||
      (v.sucursal||'').toLowerCase().includes(txt)||
      (v.cliente_nombre||'').toLowerCase().includes(txt)||
      (v.metodo_pago||'').toLowerCase().includes(txt);
    // Buscar tambien en factura.nombre
    if(!matchTxt && txt && v.factura){
      try{
        var fac=typeof v.factura==='string'?JSON.parse(v.factura):v.factura;
        if(fac && fac.nombre && fac.nombre.toLowerCase().includes(txt)) matchTxt=true;
        if(fac && fac.nro_factura && String(fac.nro_factura).toLowerCase().includes(txt)) matchTxt=true;
      }catch(e){}
    }
    var matchMet=!met||(v.metodo_pago||'').toUpperCase()===met;
    var t=v.total||0;
    var matchMon=t>=mn && t<=mx;
    return matchTxt && matchMet && matchMon;
  });
  renderVT(filt);
}

// ── TERMINALES ────────────────────────────────────────────
async function renderTerminales(){
  document.getElementById('content').innerHTML='<div class="ph"><div><div class="pt">Terminales</div><div class="ps">Dispositivos registrados</div></div></div><div id="terBody"><div class="loading"><span class="sp"></span>Cargando...</div></div>';
  try{
    var now=new Date();
    // Query activaciones (source of truth for registered terminals)
    var acts=[];
    try{acts=await sg('activaciones','email=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id,device_id,nombre_terminal,sucursal,ultima_consulta,fecha_activacion');}catch(e2){console.warn('activaciones err:',e2.message);}
    // Also query pos_ventas to get activity stats per terminal
    var v=[];
    try{v=await sg('pos_ventas','licencia_email=ilike.'+encodeURIComponent(SE)+'&anulada=is.false&order=fecha.desc&limit=1000');}catch(e3){console.warn('ventas err:',e3.message);}
    var m={};
    v.forEach(function(x){
      var k=(x.terminal||'Principal');
      if(!m[k])m[k]={t:x.terminal||'Principal',s:x.sucursal||'—',tot:0,ops:0,ul:null};
      m[k].tot+=x.total||0;m[k].ops++;
      if(!m[k].ul||x.fecha>m[k].ul)m[k].ul=x.fecha;
    });
    // Merge activaciones into map (show all registered terminals, even those with no sales)
    // En activaciones la columna de última actividad es `ultima_consulta`.
    // Fallback a fecha_activacion si la terminal nunca consultó.
    acts.forEach(function(a){
      var k=a.nombre_terminal||a.device_id||'—';
      var lastAct = a.ultima_consulta || a.fecha_activacion || null;
      if(!m[k])m[k]={t:k,s:a.sucursal||'—',tot:0,ops:0,ul:lastAct};
      else{
        m[k].t=k;
        if(a.sucursal)m[k].s=a.sucursal;
        // si la activación tiene una "última consulta" más reciente que la última venta, usar esa
        if(lastAct && (!m[k].ul || lastAct > m[k].ul)) m[k].ul=lastAct;
      }
      m[k].device_id=a.device_id;
      m[k].activ_id=a.id;
    });
    var items=Object.values(m);
    if(!items.length){document.getElementById('terBody').innerHTML='<div class="empty"><div class="empty-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div><div class="empty-t">Sin terminales registradas</div></div>';return;}
    document.getElementById('terBody').innerHTML='<div class="tg">'+items.map(function(t){
      var ul=t.ul?new Date(t.ul):null;
      var on=ul&&(now-ul)<25*3600000;
      return '<div class="tc '+(on?'on':'')+'">'
        +'<div class="tc-h"><div><div class="tc-n">'+t.t+'</div><div class="tc-s">'+t.s+(t.device_id?'<br><span style="font-size:10px;color:var(--muted);font-family:monospace;">'+t.device_id+'</span>':'')+'</div></div>'
        +'<span class="tag '+(on?'tag-g':'tag-gr')+'">'+(on?'Online':'Offline')+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Ventas</span><span style="color:var(--green);font-weight:700">'+gs(t.tot)+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Ops</span><span style="font-weight:700">'+t.ops+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Última act.</span><span>'+fmtDT(t.ul)+'</span></div>'
        +'</div>';
    }).join('')+'</div>';
  }catch(e){document.getElementById('terBody').innerHTML='<div class="loading">Error: '+e.message+'</div>';console.error(e);}
}

// ── CIERRES DE CAJA ───────────────────────────────────────
async function renderCajas(){
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var hs=hoy.getFullYear()+'-'+p2(hoy.getMonth()+1)+'-'+p2(hoy.getDate());
  var d30=new Date(hoy); d30.setDate(d30.getDate()-29);
  var d30s=d30.getFullYear()+'-'+p2(d30.getMonth()+1)+'-'+p2(d30.getDate());
  document.getElementById('content').innerHTML=
    '<style>'+
    '.cj-wrap{font-family:\'Barlow\',sans-serif;}'+
    '.cj-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;}'+
    '.cj-title{font-size:24px;font-weight:800;color:var(--text);line-height:1.1;}'+
    '.cj-sub{font-size:12px;color:var(--muted);margin-top:3px;}'+
    '.cj-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;}'+
    '@media (max-width:760px){.cj-kpis{grid-template-columns:1fr;}}'+
    '.cj-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 22px;position:relative;overflow:hidden;}'+
    '.cj-kpi::before{content:\'\';position:absolute;top:0;left:0;right:0;height:4px;background:var(--c,var(--green));}'+
    '.cj-kpi-l{font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.8px;margin-bottom:8px;}'+
    '.cj-kpi-v{font-size:36px;font-weight:800;line-height:1.05;color:var(--c,var(--text));letter-spacing:-.5px;}'+
    '.cj-kpi-c{font-size:11.5px;color:var(--muted);margin-top:6px;font-weight:600;}'+
    '.cj-kpi-live{display:inline-flex;align-items:center;gap:6px;background:var(--g2);color:var(--green);font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.5px;margin-top:8px;}'+
    '.cj-blink{width:7px;height:7px;background:var(--green);border-radius:50%;animation:cjBlink 1.2s infinite;}'+
    '@keyframes cjBlink{0%,100%{opacity:1;}50%{opacity:.25;}}'+
    '.cj-filt{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}'+
    '.cj-filt-grp{display:flex;flex-direction:column;gap:6px;}'+
    '.cj-filt-l{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.5px;}'+
    '.cj-pills{display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px;}'+
    '.cj-pill{background:transparent;border:none;color:var(--muted);font-family:\'Barlow\',sans-serif;font-size:12px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer;}'+
    '.cj-pill.on{background:var(--green);color:#fff;}'+
    '.cj-card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:0;}'+
    '@media (max-width:900px){.cj-card{grid-template-columns:1fr;}}'+
    '.cj-card.open{border-left:4px solid var(--green);box-shadow:0 0 0 1px rgba(76,175,80,.18);}'+
    '.cj-card.closed{border-left:4px solid var(--border);}'+
    '.cj-cell{padding:14px 16px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--border);}'+
    '.cj-cell:last-child{border-right:none;}'+
    '@media (max-width:900px){.cj-cell{border-right:none;border-bottom:1px solid var(--border);}.cj-cell:last-child{border-bottom:none;}}'+
    '.cj-tname{font-size:14px;font-weight:800;color:var(--text);}'+
    '.cj-tsuc{font-size:11px;color:var(--muted);margin-top:2px;}'+
    '.cj-tmeta{font-size:11px;color:var(--muted);margin-top:8px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}'+
    '.cj-tmeta strong{color:var(--text);font-weight:700;}'+
    '.cj-bdg-live{display:inline-flex;align-items:center;gap:4px;background:var(--g2);color:var(--green);font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px;}'+
    '.cj-bdg-closed{display:inline-block;background:var(--card2);color:var(--muted);font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px;border:1px solid var(--border);}'+
    '.cj-tot{font-size:26px;font-weight:800;color:var(--green);line-height:1.05;letter-spacing:-.3px;}'+
    '.cj-tot-l{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.5px;margin-bottom:4px;}'+
    '.cj-ops{font-size:11.5px;color:var(--muted);margin-top:5px;font-weight:600;}'+
    '.cj-pay-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;}'+
    '.cj-pay-row .ico{color:var(--muted);}'+
    '.cj-act-btn{background:var(--card2);border:1px solid var(--border);color:var(--text);font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:700;padding:7px 12px;border-radius:6px;cursor:pointer;margin-top:8px;text-align:center;text-transform:uppercase;letter-spacing:.4px;}'+
    '.cj-act-btn:hover{border-color:var(--green);color:var(--green);}'+
    '.cj-grp-hd{display:flex;align-items:center;gap:12px;margin:18px 0 10px;}'+
    '.cj-grp-hd .ttl{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;white-space:nowrap;}'+
    '.cj-grp-hd .ttl.alive{color:var(--green);}'+
    '.cj-grp-hd .lin{flex:1;height:1px;background:var(--border);}'+
    '.cj-grp-hd .cnt{font-size:11px;color:var(--muted);white-space:nowrap;}'+
    '.cj-section{background:var(--card2);padding:10px 14px;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid var(--border);grid-column:1/-1;}'+
    '.cj-detail{padding:12px 14px;background:var(--card2);border-top:1px solid var(--border);grid-column:1/-1;}'+
    '</style>'+
    '<div class="cj-wrap">'+
    '<div class="cj-head">'+
      '<div><div class="cj-title">Cierres de Caja</div><div class="cj-sub">Historial de turnos abiertos y cerrados</div></div>'+
    '</div>'+
    '<div class="cj-kpis">'+
      '<div class="cj-kpi" style="--c:var(--green);">'+
        '<div class="cj-kpi-l">Turnos abiertos ahora</div>'+
        '<div class="cj-kpi-v" id="cjA">--</div>'+
        '<div id="cjALive" class="cj-kpi-c">cargando...</div>'+
      '</div>'+
      '<div class="cj-kpi" style="--c:var(--orange);">'+
        '<div class="cj-kpi-l">Cerradas hoy</div>'+
        '<div class="cj-kpi-v" id="cjC">--</div>'+
        '<div class="cj-kpi-c">turnos finalizados</div>'+
      '</div>'+
      '<div class="cj-kpi" style="--c:var(--green);">'+
        '<div class="cj-kpi-l">Recaudado hoy</div>'+
        '<div class="cj-kpi-v" id="cjT">--</div>'+
        '<div class="cj-kpi-c">total ingresado en caja</div>'+
      '</div>'+
    '</div>'+
    '<div class="cj-filt">'+
      '<div class="cj-filt-grp">'+
        '<div class="cj-filt-l">Periodo</div>'+
        '<div class="cj-pills">'+
          '<button class="cj-pill" id="cjBtn_hoy" onclick="setCajasRapido(0,this)">Hoy</button>'+
          '<button class="cj-pill" id="cjBtn_7d" onclick="setCajasRapido(-6,this)">7 dias</button>'+
          '<button class="cj-pill on" id="cjBtn_30d" onclick="setCajasRapido(-29,this)">30 dias</button>'+
        '</div>'+
      '</div>'+
      '<div class="cj-filt-grp"><div class="cj-filt-l">Desde</div><input type="date" id="cjFD" class="d-inp" value="'+d30s+'"></div>'+
      '<div class="cj-filt-grp"><div class="cj-filt-l">Hasta</div><input type="date" id="cjFH" class="d-inp" value="'+hs+'"></div>'+
      '<button class="btn-sv" onclick="loadCajasRango()">Buscar</button>'+
    '</div>'+
    '<div id="cajasBody"><div class="loading"><span class="sp"></span>Cargando...</div></div>'+
    '</div>';
  await loadCajasRango();
}

async function loadCajasRango(){
  var fdEl=document.getElementById('cjFD'), fhEl=document.getElementById('cjFH');
  var desde=fdEl?fdEl.value:'', hasta=fhEl?fhEl.value:'';
  var body=document.getElementById('cajasBody');
  if(!desde||!hasta){if(body)body.innerHTML='<div style="color:var(--muted);padding:20px;text-align:center;">Selecciona un rango de fechas</div>';return;}
  if(body) body.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  var hastaDate=new Date(hasta+'T00:00:00'); hastaDate.setDate(hastaDate.getDate()+1);
  var p2=function(n){return String(n).padStart(2,'0');};
  var hastaNext=hastaDate.getFullYear()+'-'+p2(hastaDate.getMonth()+1)+'-'+p2(hastaDate.getDate())+'T03:59:59';
  try{
    allCjs=await sg('pos_turno',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha_apertura=gte.'+desde+'T04:00:00'+
      '&fecha_apertura=lte.'+hastaNext+
      '&order=fecha_apertura.desc&limit=200');
  }catch(e){ toast('Error al cargar cierres'); console.warn('[Cajas]',e.message); allCjs=[]; }

  // ── Enriquecer TODOS los turnos con datos reales de pos_ventas ──────────
  // Necesitan datos: abiertos (siempre, para tiempo real) + cerrados sin total_vendido
  var necesitanVentas = allCjs.filter(function(c){ return c.estado==='abierto' || !c.total_vendido; });

  if(necesitanVentas.length > 0){
    var byTurno = {};

    // ── PASO A: fetch por turno_id (registros modernos) ──────────────────
    var idsParaBuscar = necesitanVentas.filter(function(c){ return c.id; }).map(function(c){ return c.id; });
    if(idsParaBuscar.length){
      try{
        var vPorId = await sg('pos_ventas',
          'turno_id=in.('+idsParaBuscar.join(',')+')'
          +'&anulada=is.false'
          +'&select=turno_id,total,metodo_pago&limit=10000');
        vPorId.forEach(function(v){
          var tid = v.turno_id;
          if(!byTurno[tid]) byTurno[tid]={total:0,count:0,metodos:{}};
          byTurno[tid].total += (v.total||0);
          byTurno[tid].count++;
          var m=(v.metodo_pago||'EFECTIVO').toUpperCase();
          byTurno[tid].metodos[m]=(byTurno[tid].metodos[m]||0)+(v.total||0);
        });
      }catch(e){ console.warn('[Cajas] fetch turno_id:', e.message); }
    }

    // ── PASO B: fallback por rango de fechas (ventas sin turno_id) ────────
    // Solo para los turnos que no encontraron ventas en el paso A
    var sinVentasAun = necesitanVentas.filter(function(c){ return !byTurno[c.id]; });
    if(sinVentasAun.length){
      // Un único query amplio cubriendo todas las fechas necesarias
      var minF = sinVentasAun.map(function(c){ return c.fecha_apertura||''; }).filter(Boolean).sort()[0];
      var maxF = sinVentasAun.map(function(c){ return c.fecha_cierre||new Date().toISOString(); }).sort().reverse()[0];
      if(minF){
        try{
          var vLegacy = await sg('pos_ventas',
            'licencia_email=ilike.'+encodeURIComponent(SE)
            +'&anulada=is.false'
            +'&fecha=gte.'+encodeURIComponent(minF)
            +'&fecha=lte.'+encodeURIComponent(maxF)
            +'&select=turno_id,total,metodo_pago,fecha&limit=10000');
          vLegacy.forEach(function(v){
            // ignorar las que ya se asignaron por turno_id
            if(v.turno_id && byTurno[v.turno_id]) return;
            var vFecha=new Date(v.fecha);
            sinVentasAun.forEach(function(c){
              var ap=new Date(c.fecha_apertura);
              var ci=c.fecha_cierre?new Date(c.fecha_cierre):new Date();
              if(vFecha>=ap && vFecha<=ci){
                if(!byTurno[c.id]) byTurno[c.id]={total:0,count:0,metodos:{}};
                byTurno[c.id].total+=(v.total||0);
                byTurno[c.id].count++;
                var m=(v.metodo_pago||'EFECTIVO').toUpperCase();
                byTurno[c.id].metodos[m]=(byTurno[c.id].metodos[m]||0)+(v.total||0);
              }
            });
          });
        }catch(e){ console.warn('[Cajas] fetch legacy rango:', e.message); }
      }
    }

    // ── Aplicar datos computados a allCjs ─────────────────────────────────
    allCjs = allCjs.map(function(c){
      if(!c.id || !byTurno[c.id]) return c;
      var d = byTurno[c.id];
      return Object.assign({}, c, {
        // Para abiertos: siempre usar datos live
        // Para cerrados: preferir DB (total_vendido ya guardado) pero usar live si no hay
        total_vendido:   c.estado==='abierto' ? d.total  : (c.total_vendido  || d.total),
        cantidad_ventas: c.estado==='abierto' ? d.count  : (c.cantidad_ventas|| d.count),
        resumen_pagos:   c.estado==='abierto' ? JSON.stringify(d.metodos) : (c.resumen_pagos || JSON.stringify(d.metodos)),
        _live: c.estado==='abierto'  // flag para badge "en tiempo real"
      });
    });
  }

  renderCajasData();
}

function setCajasRapido(offset,btn){
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var hs=hoy.getFullYear()+'-'+p2(hoy.getMonth()+1)+'-'+p2(hoy.getDate());
  var desde=new Date(hoy); desde.setDate(hoy.getDate()+offset);
  var ds=desde.getFullYear()+'-'+p2(desde.getMonth()+1)+'-'+p2(desde.getDate());
  var fdEl=document.getElementById('cjFD'), fhEl=document.getElementById('cjFH');
  if(fdEl) fdEl.value=ds; if(fhEl) fhEl.value=hs;
  ['cjBtn_hoy','cjBtn_7d','cjBtn_30d'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('on');});
  if(btn) btn.classList.add('on');
  loadCajasRango();
}

function renderCajasData(){
  var body=document.getElementById('cajasBody');
  if(!body) return;
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  // Paraguay UTC-4: hoy local = desde T04:00:00 UTC hasta T03:59:59 del dia siguiente UTC
  var fdStr=hoy.getFullYear()+'-'+p2(hoy.getMonth()+1)+'-'+p2(hoy.getDate());
  var nd=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()+1);
  var pyStart=fdStr+'T04:00:00', pyEnd=nd.getFullYear()+'-'+p2(nd.getMonth()+1)+'-'+p2(nd.getDate())+'T03:59:59';
  var elA=document.getElementById('cjA'), elC=document.getElementById('cjC'), elT=document.getElementById('cjT'), elALive=document.getElementById('cjALive');
  var tot_ab=allCjs.filter(function(c){return c.estado==='abierto';}).length;
  var tot_ch=allCjs.filter(function(c){var ci=c.fecha_cierre||'';return c.estado==='cerrado'&&ci>=pyStart&&ci<=pyEnd;}).length;
  var rec_hoy=allCjs.filter(function(c){var ap=c.fecha_apertura||'';return ap>=pyStart&&ap<=pyEnd;}).reduce(function(s,c){return s+(c.total_vendido||0);},0);
  if(elA) elA.textContent=tot_ab;
  if(elC) elC.textContent=tot_ch;
  if(elT) elT.textContent=gs(rec_hoy);
  if(elALive){
    if(tot_ab>0){
      elALive.innerHTML='<span class="cj-kpi-live"><span class="cj-blink"></span>EN CURSO</span>';
    } else {
      elALive.textContent='ningun turno abierto';
    }
  }
  if(!allCjs.length){body.innerHTML='<div class="empty"><div class="empty-i">&#128452;</div><div class="empty-t">Sin registros</div><div class="empty-s">No hay turnos en el periodo seleccionado</div></div>';return;}
  var html='';
  // Helper hora corta HH:MM
  var hh=function(f){if(!f)return'--:--';var d=new Date(f);return p2(d.getHours())+':'+p2(d.getMinutes());};
  // Helper fecha+hora compacta
  var fhh=function(f){if(!f)return'--';var d=new Date(f);return p2(d.getDate())+'/'+p2(d.getMonth()+1)+' '+p2(d.getHours())+':'+p2(d.getMinutes());};

  var abiertas=allCjs.filter(function(c){return c.estado==='abierto';});
  if(abiertas.length){
    html+='<div class="cj-grp-hd"><div class="ttl alive">En curso ahora</div><div class="lin"></div><div class="cnt">'+abiertas.length+' turno'+(abiertas.length>1?'s':'')+' activo'+(abiertas.length>1?'s':'')+'</div></div>';
    abiertas.forEach(function(c){
      var ms2=Date.now()-new Date(c.fecha_apertura);
      var durTxt=Math.floor(ms2/3600000)+'h '+Math.floor((ms2%3600000)/60000)+'m';
      var totalVendido = c.total_vendido||0;
      var cantVentas = c.cantidad_ventas||c.total_operaciones||0;
      var efInicial = c.efectivo_inicial||0;
      var saldoActual = efInicial + totalVendido;

      // Formas de pago breakdown
      var pagosMap={};
      if(c.resumen_pagos){ try{ pagosMap=typeof c.resumen_pagos==='string'?JSON.parse(c.resumen_pagos):c.resumen_pagos; }catch(ex){} }
      var efTot=0, posTot=0, trTot=0;
      Object.entries(pagosMap).forEach(function(e){
        var k=e[0].toUpperCase();
        var v=typeof e[1]==='object'?(e[1].total||0):e[1];
        if(k==='EFECTIVO') efTot+=v;
        else if(k==='POS') posTot+=v;
        else trTot+=v;
      });

      html+='<div class="cj-card open">'+
        // Cell 1: terminal + apertura + duracion
        '<div class="cj-cell">'+
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'+
            '<div>'+
              '<div class="cj-tname">'+(c.terminal||'Terminal')+'</div>'+
              (c.sucursal?'<div class="cj-tsuc">'+c.sucursal+'</div>':'')+
            '</div>'+
            '<span class="cj-bdg-live"><span class="cj-blink"></span>EN CURSO</span>'+
          '</div>'+
          '<div class="cj-tmeta">Apertura: <strong>'+hh(c.fecha_apertura)+' hs</strong></div>'+
          '<div class="cj-tmeta">Duracion: <strong>'+durTxt+'</strong></div>'+
          (c.nombre_operador?'<div class="cj-tmeta">Operador: <strong>'+c.nombre_operador+'</strong></div>':'')+
        '</div>'+
        // Cell 2: total grande + ops
        '<div class="cj-cell" style="text-align:left;">'+
          '<div class="cj-tot-l">Vendido en el turno</div>'+
          '<div class="cj-tot">'+gs(totalVendido)+'</div>'+
          '<div class="cj-ops">'+cantVentas+' venta'+(cantVentas===1?'':'s')+' &middot; saldo en caja: <strong style="color:var(--text);">'+gs(saldoActual)+'</strong></div>'+
        '</div>'+
        // Cell 3: breakdown formas de pago
        '<div class="cj-cell">'+
          '<div class="cj-tot-l" style="margin-bottom:6px;">Formas de pago</div>'+
          '<div class="cj-pay-row"><span class="ico">Efectivo</span><span style="color:var(--green);font-weight:700;">'+gs(efTot)+'</span></div>'+
          '<div class="cj-pay-row"><span class="ico">POS</span><span style="color:var(--blue);font-weight:700;">'+gs(posTot)+'</span></div>'+
          '<div class="cj-pay-row"><span class="ico">Transfer.</span><span style="color:var(--orange);font-weight:700;">'+gs(trTot)+'</span></div>'+
        '</div>'+
      '</div>';
    });
  }
  var cerradas=allCjs.filter(function(c){return c.estado==='cerrado';});
  if(!cerradas.length){body.innerHTML=html||'<div class="empty"><div class="empty-i">&#128452;</div><div class="empty-t">Sin cierres</div><div class="empty-s">No hay turnos cerrados en el periodo</div></div>';return;}
  var grupos={};
  cerradas.forEach(function(c){
    var d=new Date(c.fecha_apertura||new Date());
    var key=d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
    if(!grupos[key]) grupos[key]={d:d,items:[]};
    grupos[key].items.push(c);
  });
  var diasN=['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var mesesN=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var ayerD=new Date(hoy); ayerD.setDate(hoy.getDate()-1);
  var ayerFd=ayerD.getFullYear()+'-'+p2(ayerD.getMonth()+1)+'-'+p2(ayerD.getDate());
  Object.keys(grupos).sort(function(a,b){return b.localeCompare(a);}).forEach(function(key){
    var g=grupos[key], d=g.d;
    var prefix=key===fdStr?'Hoy':key===ayerFd?'Ayer':diasN[d.getDay()];
    var totDia=g.items.reduce(function(s,x){return s+(x.total_vendido||0);},0);
    html+='<div class="cj-grp-hd">'+
      '<div class="ttl">'+prefix+' &middot; '+d.getDate()+' de '+mesesN[d.getMonth()]+' '+d.getFullYear()+'</div>'+
      '<div class="lin"></div>'+
      '<div class="cnt">'+g.items.length+' turno'+(g.items.length>1?'s':'')+' &middot; '+gs(totDia)+'</div>'+
    '</div>';
    g.items.forEach(function(c){ html+=_renderCierreCard(c, allCjs.indexOf(c)); });
  });
  body.innerHTML=html;
}

function _renderCierreCard(c,i){
  var durTxt='';
  if(c.fecha_apertura&&c.fecha_cierre){var ms=new Date(c.fecha_cierre)-new Date(c.fecha_apertura);durTxt=Math.floor(ms/3600000)+'h '+Math.floor((ms%3600000)/60000)+'m';}
  var ops=c.total_operaciones||c.cantidad_ventas||0;
  var avg=ops&&c.total_vendido?Math.round(c.total_vendido/ops):0;
  var pagosMap={};
  if(c.resumen_pagos){try{pagosMap=typeof c.resumen_pagos==='string'?JSON.parse(c.resumen_pagos):c.resumen_pagos;}catch(ex){console.warn('[Cajas] resumen_pagos:',ex.message);}}
  if(!Object.keys(pagosMap).length){
    if(c.total_efectivo>0) pagosMap['EFECTIVO']=c.total_efectivo;
    if(c.total_tarjeta>0) pagosMap['POS']=c.total_tarjeta;
    if(c.total_transfer>0) pagosMap['TRANSFERENCIA']=c.total_transfer;
  }
  var pCols={'EFECTIVO':'var(--green)','POS':'var(--blue)','TRANSFERENCIA':'var(--orange)'};
  var pIcos={'EFECTIVO':'&#128181;','POS':'&#128179;','TRANSFERENCIA':'&#127970;'};
  var pagosRows=Object.entries(pagosMap).map(function(e){
    var v=typeof e[1]==='object'?(e[1].total||0):e[1];
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);font-size:13px;">'+(pIcos[e[0]]||'&#128181;')+' '+e[0]+'</span><span style="font-weight:700;color:'+(pCols[e[0]]||'var(--text)')+';">'+gs(v)+'</span></div>';
  }).join('');
  var efInicial=c.efectivo_inicial||0;
  var totalVendido=c.total_vendido||0;
  var totalEgresos=c.total_egresos||0;
  var saldoCaja=efInicial+totalVendido-totalEgresos;
  var resumenBox='<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px;">'+
    '<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Resumen del turno</div>'+
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Importe inicial</span><span style="font-weight:600;">'+gs(efInicial)+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Total ventas ('+ops+' ops)</span><span style="font-weight:600;color:var(--green);">'+gs(totalVendido)+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Egresos del turno</span><span style="font-weight:600;'+(totalEgresos>0?'color:var(--red);">-'+gs(totalEgresos):'color:var(--muted);">'+gs(0))+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--border);margin-top:4px;"><span style="font-size:13px;font-weight:800;">Saldo en caja</span><span style="font-weight:800;font-size:15px;color:var(--green);">'+gs(saldoCaja)+'</span></div>'+
    '</div>';
  var difHTML='';
  var esp=saldoCaja;
  if(c.total_contado>0){
    var dif=c.diferencia!=null?c.diferencia:c.total_contado-esp;
    var dc=dif===0?'var(--green)':dif>0?'var(--blue)':'var(--red)';
    var difLabel=dif===0?'&#10003; Cuadre exacto':((dif>0?'Sobrante +':'Faltante -')+gs(Math.abs(dif)));
    difHTML='<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px;">'+
      '<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Rendición del cajero</div>'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Saldo esperado en caja</span><span style="font-weight:600;">'+gs(esp)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Total contado por cajero</span><span style="font-weight:700;">'+gs(c.total_contado)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:2px solid var(--border);margin-top:6px;">'+
        '<span style="font-size:13px;font-weight:700;">Diferencia</span>'+
        '<span style="font-weight:800;font-size:16px;color:'+dc+';">'+difLabel+'</span>'+
      '</div>'+
      '</div>';
  } else {
    difHTML='<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px;">'+
      '<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Rendición del cajero</div>'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--muted);font-size:13px;">Saldo esperado en caja</span><span style="font-weight:600;">'+gs(esp)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:6px;">'+
        '<span style="color:var(--muted);font-size:13px;">Conteo del cajero</span>'+
        '<span style="color:var(--muted);font-size:12px;font-style:italic;">Sin rendición registrada</span>'+
      '</div>'+
      '</div>';
  }
  // Breakdown formas de pago en montos
  var efTot=0, posTot=0, trTot=0;
  Object.entries(pagosMap).forEach(function(e){
    var k=e[0].toUpperCase();
    var vv=typeof e[1]==='object'?(e[1].total||0):e[1];
    if(k==='EFECTIVO') efTot+=vv;
    else if(k==='POS') posTot+=vv;
    else trTot+=vv;
  });
  var hh2=function(f){if(!f)return'--:--';var d=new Date(f);var p=function(n){return String(n).padStart(2,'0');};return p(d.getHours())+':'+p(d.getMinutes());};
  var detalleId='cjDet'+i;

  return '<div class="cj-card closed">'+
    // Cell 1: terminal + horario + duracion
    '<div class="cj-cell">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'+
        '<div>'+
          '<div class="cj-tname">'+(c.terminal||'Terminal')+'</div>'+
          (c.sucursal?'<div class="cj-tsuc">'+c.sucursal+'</div>':'')+
        '</div>'+
        '<span class="cj-bdg-closed">CERRADO</span>'+
      '</div>'+
      '<div class="cj-tmeta">'+hh2(c.fecha_apertura)+' &rarr; '+hh2(c.fecha_cierre)+(durTxt?' &middot; <strong>'+durTxt+'</strong>':'')+'</div>'+
      (c.nombre_operador?'<div class="cj-tmeta">Operador: <strong>'+c.nombre_operador+'</strong></div>':'')+
    '</div>'+
    // Cell 2: total + ops + saldo
    '<div class="cj-cell">'+
      '<div class="cj-tot-l">Total vendido</div>'+
      '<div class="cj-tot">'+gs(c.total_vendido||0)+'</div>'+
      '<div class="cj-ops">'+ops+' venta'+(ops===1?'':'s')+(avg?' &middot; prom. '+gs(avg):'')+'</div>'+
      '<div class="cj-tmeta" style="margin-top:6px;">Saldo en caja: <strong style="color:var(--text);">'+gs(saldoCaja)+'</strong></div>'+
    '</div>'+
    // Cell 3: breakdown + boton ver detalle
    '<div class="cj-cell">'+
      '<div class="cj-tot-l" style="margin-bottom:6px;">Formas de pago</div>'+
      '<div class="cj-pay-row"><span class="ico">Efectivo</span><span style="color:var(--green);font-weight:700;">'+gs(efTot)+'</span></div>'+
      '<div class="cj-pay-row"><span class="ico">POS</span><span style="color:var(--blue);font-weight:700;">'+gs(posTot)+'</span></div>'+
      '<div class="cj-pay-row"><span class="ico">Transfer.</span><span style="color:var(--orange);font-weight:700;">'+gs(trTot)+'</span></div>'+
      '<button class="cj-act-btn" onclick="togCierreDetalle(\''+detalleId+'\','+i+')">Ver detalle</button>'+
    '</div>'+
    // Detalle expandible (oculto por defecto)
    '<div id="'+detalleId+'" class="cj-detail" style="display:none;">'+
      // Resumen del turno
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:12px;">'+
        '<div><div class="cj-tot-l">Importe inicial</div><div style="font-weight:700;font-size:14px;">'+gs(efInicial)+'</div></div>'+
        '<div><div class="cj-tot-l">Ventas del turno</div><div style="font-weight:700;font-size:14px;color:var(--green);">'+gs(totalVendido)+'</div></div>'+
        '<div><div class="cj-tot-l">Egresos</div><div style="font-weight:700;font-size:14px;color:'+(totalEgresos>0?'var(--red)':'var(--muted)')+';">'+(totalEgresos>0?'-':'')+gs(totalEgresos)+'</div></div>'+
        '<div><div class="cj-tot-l">Saldo esperado</div><div style="font-weight:800;font-size:14px;">'+gs(saldoCaja)+'</div></div>'+
      '</div>'+
      // Diferencia / rendicion
      (c.total_contado>0 ?
        (function(){
          var dif=c.diferencia!=null?c.diferencia:c.total_contado-saldoCaja;
          var dc=dif===0?'var(--green)':dif>0?'var(--blue)':'var(--red)';
          var difLabel=dif===0?'Cuadre exacto':((dif>0?'Sobrante +':'Faltante -')+gs(Math.abs(dif)));
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--card);border-radius:6px;margin-bottom:10px;border:1px solid var(--border);">'+
            '<div><div class="cj-tot-l">Contado por cajero</div><div style="font-size:14px;font-weight:700;">'+gs(c.total_contado)+'</div></div>'+
            '<div style="text-align:right;"><div class="cj-tot-l">Diferencia</div><div style="font-size:15px;font-weight:800;color:'+dc+';">'+difLabel+'</div></div>'+
          '</div>';
        })() :
        '<div style="padding:8px 12px;background:var(--card);border-radius:6px;margin-bottom:10px;border:1px solid var(--border);font-size:12px;color:var(--muted);font-style:italic;">Sin rendicion del cajero registrada</div>'
      )+
      (c.notas_cierre?'<div style="background:var(--card);border-radius:6px;padding:8px 12px;margin-bottom:10px;border:1px solid var(--border);"><div class="cj-tot-l">Notas del cierre</div><div style="font-size:12px;color:var(--text2);margin-top:3px;">'+c.notas_cierre+'</div></div>':'')+
      (c.id?'<div id="cjVT'+i+'"><button onclick="verVentasTurno('+i+')" class="btn-sv" style="width:100%;">Ver ventas del turno ('+ops+')</button></div>':'')+
    '</div>'+
  '</div>';
}

// Toggle del bloque detallado de cada cierre cerrado
function togCierreDetalle(id,i){
  var el=document.getElementById(id);
  if(!el) return;
  el.style.display = el.style.display==='none' ? 'block' : 'none';
}
function togCj(i){var b=document.getElementById('cjB'+i);if(b)b.classList.toggle('open');}

// ── VER VENTAS DE UN TURNO ────────────────────────────────────
async function verVentasTurno(idx){
  var c=allCjs[idx];
  if(!c) return;
  var cont=document.getElementById('cjVT'+idx);
  if(!cont) return;
  cont.innerHTML='<div class="loading"><span class="sp"></span>Cargando ventas del turno...</div>';
  try{
    var ventas=[];
    // Primero por turno_id
    if(c.id){
      ventas=await sg('pos_ventas','turno_id=eq.'+c.id+'&anulada=is.false&order=fecha.asc&limit=300');
    }
    // Fallback por rango de fecha (encodeURIComponent evita el bug del +00:00 → espacio)
    if(!ventas.length&&c.fecha_apertura&&c.fecha_cierre){
      ventas=await sg('pos_ventas',
        'licencia_email=ilike.'+encodeURIComponent(SE)+
        '&anulada=is.false'+
        '&fecha=gte.'+encodeURIComponent(c.fecha_apertura)+
        '&fecha=lte.'+encodeURIComponent(c.fecha_cierre)+
        '&order=fecha.asc&limit=300');
    }
    if(!ventas.length){
      cont.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px;background:var(--card2);border-radius:8px;margin-bottom:10px;">Sin ventas registradas en este turno</div>';
      return;
    }
    var mb=function(m){var u=(m||'').toUpperCase();return u==='EFECTIVO'?'<span class="tag tag-g">EF</span>':u==='POS'?'<span class="tag tag-b">POS</span>':'<span class="tag tag-o">TR</span>';};
    var totalT=ventas.reduce(function(s,v){return s+(v.total||0);},0);
    var html='<div style="background:var(--card2);border-radius:8px;overflow:hidden;margin-bottom:10px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);">'
        +'<span style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Ventas del turno ('+ventas.length+')</span>'
        +'<span style="font-size:14px;font-weight:800;color:var(--green);">'+gs(totalT)+'</span>'
      +'</div>'
      +'<table style="font-size:12px;width:100%;"><thead><tr>'
        +'<th style="padding:7px 12px;text-align:left;">Hora</th>'
        +'<th style="padding:7px 4px;text-align:center;">Método</th>'
        +'<th style="padding:7px 12px;text-align:left;">Productos</th>'
        +'<th style="padding:7px 12px;text-align:right;">Total</th>'
      +'</tr></thead><tbody>';
    ventas.forEach(function(v){
      var items=[];
      try{items=typeof v.items==='string'?JSON.parse(v.items):(v.items||[]);}catch(e){console.warn('[VentasTurno] items parse:',e.message);}
      var prodsTxt=items.filter(function(it){return !it.esDescuento;}).map(function(it){return (it.nombre||it.name||'?')+' x'+(it.qty||1);}).join(', ');
      if(prodsTxt.length>55) prodsTxt=prodsTxt.substring(0,53)+'…';
      html+='<tr style="border-top:1px solid var(--border);">'
        +'<td style="padding:7px 12px;color:var(--muted);white-space:nowrap;">'+fmtH(v.fecha)+'</td>'
        +'<td style="padding:7px 4px;text-align:center;">'+mb(v.metodo_pago)+'</td>'
        +'<td style="padding:7px 12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">'+prodsTxt+'</td>'
        +'<td style="padding:7px 12px;text-align:right;font-weight:700;color:var(--green);white-space:nowrap;">'+gs(v.total||0)+'</td>'
      +'</tr>';
    });
    html+='</tbody></table></div>';
    cont.innerHTML=html;
  }catch(e){
    cont.innerHTML='<div style="color:var(--red);font-size:13px;padding:8px 0;">Error al cargar ventas: '+e.message+'</div>';
    console.warn('[VentasTurno]',e.message);
  }
}