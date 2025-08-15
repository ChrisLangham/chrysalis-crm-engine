// Chrysalis CRM Engine — v0.1
// This is extracted from the single-file HTML app. Include it via:
// <script src="https://cdn.jsdelivr.net/gh/YourUser/chrysalis-crm-engine@main/app.js"></script>

// --- Tiny helpers ---
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
function personName(p){ return `${p.first_name} ${p.last_name}`; }
function nextCode(people){
  const nums = people.map(p=>parseInt((p.code||'C100000').slice(1))).filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 100000;
  return 'C' + String(max+1).padStart(6,'0');
}

// --- Mode & Simple local store ---
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') || params.get('mode') === 'demo';
const STORAGE_SUFFIX = DEMO ? '_demo' : '_prod';

const store = {
  key: 'chrysalis_crm_lite_v01' + STORAGE_SUFFIX,
  data: { people: [], tasks: [], socials: [], campaigns: [], tv: {} },
  load() {
    const raw = localStorage.getItem(this.key);
    if (raw) {
      try { this.data = JSON.parse(raw); } catch {}
    } else {
      // In demo mode, always start from seeded data on first load
      this.resetDemo();
    }
  },
  save() { localStorage.setItem(this.key, JSON.stringify(this.data)); },
  resetDemo() {
    this.data = demoData();
    this.save();
  }
};

function demoData() {
  const ids = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const people = [
    {id: ids(), code:'C100001', first_name:'Paula', last_name:'McHugh', status:'Member', is_coach:true, upline_id:null, coach_id:null, location:'Chrysalis', member_type:'Online'},
    {id: ids(), code:'C100002', first_name:'Kim', last_name:'Wearin', status:'Conversation', is_coach:true, upline_id:null, coach_id:null, location:'Chrysalis', member_type:'Club'},
    {id: ids(), code:'C100003', first_name:'Shannon', last_name:'Brown', status:'Member', is_coach:true, upline_id:null, coach_id:null, location:'Chrysalis', member_type:'Online'},
    {id: ids(), code:'C100004', first_name:'Chris', last_name:'Taylor', status:'Member', is_coach:false, upline_id:null, coach_id:null, location:'Online', member_type:'Online'},
    {id: ids(), code:'C100005', first_name:'Hannah', last_name:'Green', status:'Potential', is_coach:false, upline_id:null, coach_id:null, location:'Online', member_type:'Unknown'},
  ];
  // simple coaching links
  const shannon = people.find(p=>p.first_name==='Shannon');
  const chris = people.find(p=>p.first_name==='Chris');
  const hannah = people.find(p=>p.first_name==='Hannah');
  chris.coach_id = shannon.id; hannah.upline_id = chris.id; hannah.coach_id = shannon.id;

  const tasks = [
    {id: ids(), title:'Check on Paula’s inviting plan', due:'', done:false, person_id: people[0].id},
    {id: ids(), title:'Schedule review with Kim & Lee', due:'', done:false, person_id: people[1].id},
  ];

  const socials = [
    {id: ids(), person_id: people[2].id, activity_type:'Review', platform:'FB', permissions:'CHECK', scheduled_at:''},
  ];

  const campaigns = [
    {id: ids(), name:'Shunters/Brackens Leaflets', ctype:'Leaflet', start_date:'2025-07-30', end_date:'', location:'Chrysalis'},
  ];

  const tv = {
    'Shannon Brown': { months:['2025-04','2025-05','2025-06','2025-07','2025-08'], values:[260,390,520,650,780] },
    'Paula McHugh': { months:['2025-04','2025-05','2025-06','2025-07','2025-08'], values:[520,520,650,650,650] },
  };

  return { people, tasks, socials, campaigns, tv };
}

// --- UI State ---
let tvChart, statusChart;

function init() {
  store.load();
  bindTabs();
  bindHeader();
  renderAll();
  // allow saving the file itself (only works if index.html wrapped this engine; noop otherwise)
  const saveBtn = $('#saveBtn');
  if (saveBtn) {
    const src = document.documentElement.outerHTML;
    const blob = new Blob([src], {type:'text/html'});
    saveBtn.href = URL.createObjectURL(blob);
    saveBtn.download = 'chrysalis-crm-lite.html';
  }
  // Mode badge
  const badgeHost = $('#modeBadge');
  if (DEMO && badgeHost) {
    const b = document.createElement('span');
    b.className = 'ml-2 inline-flex items-center rounded-full bg-gray-900 text-white px-2 py-0.5 text-[10px]';
    b.textContent = 'DEMO';
    badgeHost.replaceWith(b);
  }
}

function bindHeader(){
  const exportBtn = $('#exportBtn');
  const importInput = $('#importInput');
  const resetDemoBtn = $('#resetDemoBtn');

  if (exportBtn) exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(store.data, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chrysalis-crm-lite.json'; a.click();
  });
  if (importInput) importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    const text = await file.text();
    try{ store.data = JSON.parse(text); store.save(); renderAll(); }catch{ alert('Invalid JSON'); }
  });
  if (resetDemoBtn) resetDemoBtn.addEventListener('click', ()=>{ if(confirm('Reset to demo data?')){ store.resetDemo(); renderAll(); }});
}

function bindTabs(){
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const tab = btn.dataset.tab;
      $$('.tab-panel').forEach(p=>p.classList.add('hidden'));
      $('#'+tab).classList.remove('hidden');
      $$('.tab').forEach(b=>b.classList.remove('bg-black','text-white'));
      btn.classList.add('bg-black','text-white');
      if(tab==='dashboard') renderDashboard();
    });
  });
  // default to dashboard on load
  const first = $('[data-tab="dashboard"]');
  if (first) first.click();
}

function renderAll(){
  renderDashboard();
  renderPeople();
  renderTasks();
  renderSocials();
  renderCampaigns();
}

// --- Dashboard ---
function renderDashboard(){
  // Coach filter
  const coachSelect = $('#tvCoachFilter');
  if (coachSelect) {
    const coaches = store.data.people.filter(p=>p.is_coach);
    coachSelect.innerHTML = ['<option value="">All Coaches</option>', ...coaches.map(c=>`<option>${personName(c)}</option>`)].join('');
    coachSelect.onchange = drawTVChart;
  }
  drawTVChart();
  drawStatusChart();
  // quick add
  const qa = $('#quickAddForm');
  if (qa) {
    qa.onsubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const p = {
        id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        code: nextCode(store.data.people),
        first_name: fd.get('first_name'),
        last_name: fd.get('last_name'),
        status: fd.get('status'),
        is_coach: !!fd.get('is_coach'),
        upline_id: null, coach_id: null, location:'Unknown', member_type:'Unknown'
      };
      store.data.people.push(p); store.save();
      e.target.reset();
      renderAll();
    };
  }
}

function drawTVChart(){
  const ctx = $('#tvChart'); if (!ctx || !window.Chart) return;
  const filter = ($('#tvCoachFilter')||{}).value || '';
  let labels = []; let datasets = [];
  const entries = Object.entries(store.data.tv||{});
  const filtered = filter ? entries.filter(([k])=>k===filter) : entries;
  filtered.forEach(([coach, series])=>{
    labels = series.months; // assume same months
    datasets.push({ label: coach, data: series.values, tension: 0.35, fill:false });
  });
  if(tvChart) tvChart.destroy();
  tvChart = new Chart(ctx, { type:'line', data:{ labels, datasets }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } });
}

function drawStatusChart(){
  const ctx = $('#statusChart'); if (!ctx || !window.Chart) return;
  const counts = {};
  (store.data.people||[]).forEach(p=>{ counts[p.status] = (counts[p.status]||0)+1; });
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  if(statusChart) statusChart.destroy();
  statusChart = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Count', data }] }, options:{ plugins:{ legend:{ display:false } } } });
}

// --- People ---
function renderPeople(){
  const tbody = $('#peopleTable'); if(!tbody) return;
  const search = $('#peopleSearch');
  const statusFilter = $('#peopleStatusFilter');
  const addBtn = $('#addPersonBtn');
  const modal = $('#personModal');
  const form = modal?.querySelector('form');

  function populateRefs(){
    if (!form) return;
    const opts = ['<option value="">(none)</option>', ...store.data.people.map(p=>`<option value="${p.id}">${personName(p)}</option>`)];
    form.upline_id.innerHTML = opts.join('');
    form.coach_id.innerHTML = opts.join('');
    const taskSelect = $('#taskPersonSelect'); if (taskSelect) taskSelect.innerHTML = ['<option value="">(no person)</option>', ...store.data.people.map(p=>`<option value="${p.id}">${personName(p)}</option>`)].join('');
    const socialPerson = $('#socialPerson'); if (socialPerson) socialPerson.innerHTML = store.data.people.map(p=>`<option value="${p.id}">${personName(p)}</option>`).join('');
  }

  function rows(){
    let items = [...store.data.people];
    if (search?.value) {
      const q = search.value.toLowerCase();
      items = items.filter(p=>personName(p).toLowerCase().includes(q));
    }
    if (statusFilter?.value) {
      items = items.filter(p=>p.status===statusFilter.value);
    }
    return items.sort((a,b)=>personName(a).localeCompare(personName(b)));
  }

  function render(){
    populateRefs();
    tbody.innerHTML = rows().map(p=>{
      const upline = store.data.people.find(x=>x.id===p.upline_id);
      const coach = store.data.people.find(x=>x.id===p.coach_id);
      return `<tr>
        <td class="py-2 pr-4">${p.code||''}</td>
        <td class="py-2 pr-4 font-medium">${personName(p)}</td>
        <td class="py-2 pr-4">${p.status}</td>
        <td class="py-2 pr-4">${p.is_coach ? '<span class=\"badge bg-black text-white\">Coach</span>' : ''}</td>
        <td class="py-2 pr-4">${upline?personName(upline):''}</td>
        <td class="py-2 pr-4">${coach?personName(coach):''}</td>
        <td class="py-2 pr-4">${p.location||''}</td>
        <td class="py-2 pr-4 space-x-2">
          <button class="btn btn-secondary" data-edit="${p.id}">Edit</button>
          <button class="btn btn-secondary" data-del="${p.id}">Delete</button>
        </td>
      </tr>`;
    }).join('');
    // bind row actions
    $$('[data-edit]').forEach(b=>b.onclick = ()=>openEdit(b.dataset.edit));
    $$('[data-del]').forEach(b=>b.onclick = ()=>del(b.dataset.del));
  }

  function openEdit(id){
    if (!form || !modal) return;
    const p = store.data.people.find(x=>x.id===id) || { id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), code: nextCode(store.data.people), first_name:'', last_name:'', status:'Potential', is_coach:false, upline_id:'', coach_id:'', location:'Unknown', member_type:'Unknown', hl_id:'' };
    form.dataset.id = p.id;
    form.first_name.value = p.first_name||'';
    form.last_name.value = p.last_name||'';
    form.status.value = p.status||'Potential';
    form.is_coach.checked = !!p.is_coach;
    form.upline_id.value = p.upline_id||'';
    form.coach_id.value = p.coach_id||'';
    form.location.value = p.location||'Unknown';
    form.member_type.value = p.member_type||'Unknown';
    form.hl_id.value = p.hl_id||'';
    modal.showModal();
  }

  function del(id){
    if(!confirm('Delete this person?')) return;
    store.data.people = store.data.people.filter(p=>p.id!==id);
    // clean references
    store.data.people.forEach(p=>{ if(p.upline_id===id) p.upline_id=null; if(p.coach_id===id) p.coach_id=null; });
    store.save(); render(); renderDashboard();
  }

  if (addBtn) addBtn.onclick = ()=>openEdit(null);
  if (search) search.oninput = render; if (statusFilter) statusFilter.onchange = render;

  if (form) {
    const saveBtn = $('#personSaveBtn');
    if (saveBtn) saveBtn.onclick = (e)=>{
      e.preventDefault();
      const id = form.dataset.id || (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      const exists = store.data.people.find(p=>p.id===id);
      const rec = {
        id,
        code: exists?.code || nextCode(store.data.people),
        first_name: form.first_name.value.trim(),
        last_name: form.last_name.value.trim(),
        status: form.status.value,
        is_coach: form.is_coach.checked,
        upline_id: form.upline_id.value || null,
        coach_id: form.coach_id.value || null,
        location: form.location.value,
        member_type: form.member_type.value,
        hl_id: form.hl_id.value.trim()||null
      };
      if (exists) { Object.assign(exists, rec); } else { store.data.people.push(rec); }
      store.save(); modal.close(); render(); renderDashboard();
    };
  }

  render();
}

// --- Tasks ---
function renderTasks(){
  const form = $('#taskForm');
  const openList = $('#taskOpen');
  const doneList = $('#taskDone');
  if (!form || !openList || !doneList) return;

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const t = { id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), title: fd.get('title'), due: fd.get('due'), done:false, person_id: fd.get('person_id')||null };
    store.data.tasks.push(t); store.save(); form.reset(); draw();
  };

  function draw(){
    const item = (t)=>{
      const p = store.data.people.find(x=>x.id===t.person_id);
      return `<li class="border rounded-xl p-3 flex items-center justify-between">
        <div>
          <div class="font-medium">${t.title}</div>
          <div class="text-xs text-gray-500">${t.due||''} ${p?('• '+personName(p)) : ''}</div>
        </div>
        <div class="space-x-2">
          ${!t.done?`<button class="btn btn-secondary" data-done="${t.id}">Done</button>`:''}
          <button class="btn btn-secondary" data-del="${t.id}">Delete</button>
        </div>
      </li>`
    };
    const open = store.data.tasks.filter(t=>!t.done);
    const done = store.data.tasks.filter(t=>t.done);
    openList.innerHTML = open.map(item).join('');
    doneList.innerHTML = done.map(item).join('');
    $$('[data-done]').forEach(b=>b.onclick = ()=>{ const t=store.data.tasks.find(x=>x.id===b.dataset.done); t.done=true; store.save(); draw(); });
    $$('[data-del]').forEach(b=>b.onclick = ()=>{ store.data.tasks = store.data.tasks.filter(x=>x.id!==b.dataset.del); store.save(); draw(); });
  }
  draw();
}

// --- Socials ---
function renderSocials(){
  const form = $('#socialForm');
  const tbody = $('#socialTable');
  if (!form || !tbody) return;

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const rec = {
      id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      person_id: fd.get('person_id'),
      activity_type: fd.get('activity_type'),
      platform: fd.get('platform'),
      permissions: fd.get('permissions'),
      scheduled_at: fd.get('scheduled_at')
    };
    store.data.socials.push(rec); store.save(); form.reset(); draw();
  }
  function draw(){
    tbody.innerHTML = store.data.socials.map(s=>{
      const p = store.data.people.find(x=>x.id===s.person_id);
      return `<tr>
        <td class="py-2 pr-4">${p?personName(p):''}</td>
        <td class="py-2 pr-4">${s.activity_type||''}</td>
        <td class="py-2 pr-4">${s.platform||''}</td>
        <td class="py-2 pr-4">${s.permissions||''}</td>
        <td class="py-2 pr-4">${s.scheduled_at||''}</td>
      </tr>`
    }).join('');
  }
  draw();
}

// --- Campaigns ---
function renderCampaigns(){
  const form = $('#campaignForm');
  const tbody = $('#campaignTable');
  if (!form || !tbody) return;

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const rec = {
      id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      name: fd.get('name'), ctype: fd.get('ctype'), start_date: fd.get('start_date'), end_date: fd.get('end_date'), location: fd.get('location')
    };
    store.data.campaigns.push(rec); store.save(); form.reset(); draw();
  }
  function draw(){
    tbody.innerHTML = store.data.campaigns.map(c=>`<tr>
      <td class="py-2 pr-4 font-medium">${c.name}</td>
      <td class="py-2 pr-4">${c.ctype}</td>
      <td class="py-2 pr-4">${c.start_date||''}</td>
      <td class="py-2 pr-4">${c.end_date||''}</td>
      <td class="py-2 pr-4">${c.location||''}</td>
    </tr>`).join('');
  }
  draw();
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
