// ======= Utilidades de Armazenamento =======
const DB = {
  load(){
    const d = JSON.parse(localStorage.getItem('hd_db')||'null');
    if(d) return d;
    // Seed inicial
    const now = Date.now();
    const db = {
      settings: { title: 'Helpdesk & Estoque', company: 'Minha Empresa' },
      users: [
        { id: 1, username: 'admin', name: 'Administrador', role: 'admin', password: 'admin' },
        { id: 2, username: 'tecnico', name: 'Técnico Padrão', role: 'tech', password: '123' },
      ],
      clients: [
        { id: 1, name: 'Beatriz Lima', email: 'bea@empresa.com', phone: '(11) 90000-0001', company: 'Empresa A', notes: '' },
        { id: 2, name: 'Carlos Souza', email: 'carlos@empresa.com', phone: '(11) 90000-0002', company: 'Empresa B', notes: '' }
      ],
      inventory: [
        { id: 1, sku: 'SSD-240', name: 'SSD 240GB', category: 'Armazenamento', location: 'Prateleira A', qty: 2, minQty: 3, vendor: 'KingFast' },
        { id: 2, sku: 'RAM-D4-8', name: 'Memória DDR4 8GB', category: 'Memória', location: 'Prateleira B', qty: 12, minQty: 5, vendor: 'Crucial' },
        { id: 3, sku: 'TN-3472', name: 'Toner TN-3472', category: 'Impressão', location: 'Prateleira C', qty: 1, minQty: 2, vendor: 'Brother' }
      ],
      tickets: [
        { id: 1, title:'Computador não liga', description:'PC do financeiro não liga desde ontem.', clientId:1, category:'Hardware', status:'open', priority:'Alta', assigned:'tecnico', createdAt: now-86400000, updatedAt: now-3600000 },
        { id: 2, title:'Impressora com papel atolado', description:'Atolamento recorrente na impressora', clientId:2, category:'Impressora', status:'progress', priority:'Média', assigned:'tecnico', createdAt: now-172800000, updatedAt: now-7200000 },
        { id: 3, title:'Erro no sistema ERP', description:'Mensagem de erro ao emitir NF-e', clientId:1, category:'Software', status:'closed', priority:'Urgente', assigned:'tecnico', createdAt: now-259200000, updatedAt: now-10800000 }
      ],
      seq: { users:3, clients:3, inventory:3, tickets:3 }
    };
    localStorage.setItem('hd_db', JSON.stringify(db));
    return db;
  },
  save(db){ localStorage.setItem('hd_db', JSON.stringify(db)); },
};

let DBSTATE = DB.load();
const q = (sel, root=document) => root.querySelector(sel);
const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmtDate = ts => new Date(ts).toLocaleString();

// ======= Autenticação =======
const SESSION = {
  user: null,
  login(username, password){
    const u = DBSTATE.users.find(u=>u.username===username && u.password===password);
    if(!u) return false;
    this.user = { id:u.id, username:u.username, role:u.role, name:u.name };
    sessionStorage.setItem('hd_session', JSON.stringify(this.user));
    return true;
  },
  load(){ this.user = JSON.parse(sessionStorage.getItem('hd_session')||'null'); },
  logout(){ sessionStorage.removeItem('hd_session'); this.user=null; }
};
SESSION.load();

function updateHeader(){
  q('#userName').textContent = SESSION.user? SESSION.user.name : 'Visitante';
  q('#userRole').textContent = SESSION.user? (SESSION.user.role==='admin'?'Administrador':'Técnico') : '—';
}

function gateByRole(){
  const isAdmin = SESSION.user && SESSION.user.role==='admin';
  qa('.admin-only').forEach(el=> el.classList.toggle('hidden', !isAdmin));
}

// ======= Navegação =======
qa('nav [data-section]').forEach(btn=>{
  btn.addEventListener('click', ()=> showSection(btn.dataset.section));
});
function showSection(id){
  qa('main .content').forEach(s=> s.classList.toggle('hidden', s.id!==id));
}

// ======= Dashboard =======
function refreshKPIs(){
  const open = DBSTATE.tickets.filter(t=>t.status==='open').length;
  const prog = DBSTATE.tickets.filter(t=>t.status==='progress').length;
  const closed = DBSTATE.tickets.filter(t=>t.status==='closed' && Date.now()-t.updatedAt < 30*864e5).length;
  const low = DBSTATE.inventory.filter(i=>i.qty<=i.minQty).length;
  q('#kpiOpen').textContent=open; q('#kpiProgress').textContent=prog; q('#kpiClosed').textContent=closed; q('#kpiLow').textContent=low;
}
function refreshDashTables(){
  const input = q('#searchDashTickets').value?.toLowerCase()||'';
  const clientsById = Object.fromEntries(DBSTATE.clients.map(c=>[c.id,c]));
  const rows = DBSTATE.tickets
    .filter(t=> t.title.toLowerCase().includes(input) || (clientsById[t.clientId]?.name||'').toLowerCase().includes(input))
    .sort((a,b)=> b.updatedAt - a.updatedAt)
    .slice(0,12)
    .map(t=>`<tr><td>#${t.id}</td><td>${t.title}</td><td>${clientsById[t.clientId]?.name||'-'}</td><td><span class="status ${t.status}">${labelStatus(t.status)}</span></td><td><span class="priority ${prioClass(t.priority)}">${t.priority}</span></td><td>${fmtDate(t.updatedAt)}</td></tr>`)
    .join('');
  q('#dashTickets').innerHTML = rows || `<tr><td colspan="6" class="muted">Nenhum chamado</td></tr>`;

  const lows = DBSTATE.inventory.filter(i=>i.qty<=i.minQty)
    .sort((a,b)=> (a.qty-a.minQty)-(b.qty-b.minQty))
    .map(i=>`<tr><td>${i.sku}</td><td>${i.name}</td><td>${i.qty}</td><td>${i.minQty}</td><td>${i.location||'-'}</td></tr>`)
    .join('');
  q('#dashLowStock').innerHTML = lows || `<tr><td colspan="5" class="muted">Sem alertas</td></tr>`;
}
q('#searchDashTickets').addEventListener('input', refreshDashTables);

// ======= Chamados =======
function labelStatus(s){ return s==='open'?'Aberto': s==='progress'?'Em andamento':'Fechado'; }
function prioClass(p){ return p?.toLowerCase()==='urgente'?'urgent': p?.toLowerCase()==='alta'?'high':''; }

function renderTicketRows(){
  const txt = q('#searchTickets').value.toLowerCase();
  const fs = q('#filterStatus').value;
  const fp = q('#filterPriority').value;
  const clientsById = Object.fromEntries(DBSTATE.clients.map(c=>[c.id,c]));
  const rows = DBSTATE.tickets
    .filter(t=> (!fs||t.status===fs) && (!fp||t.priority===fp) &&
      (t.title.toLowerCase().includes(txt) || t.description.toLowerCase().includes(txt) || (clientsById[t.clientId]?.name||'').toLowerCase().includes(txt)))
    .sort((a,b)=> b.updatedAt-a.updatedAt)
    .map(t=>`
      <tr>
        <td>#${t.id}</td>
        <td>${t.title}</td>
        <td>${clientsById[t.clientId]?.name||'-'}</td>
        <td>${t.category||'-'}</td>
        <td><span class="status ${t.status}">${labelStatus(t.status)}</span></td>
        <td><span class="priority ${prioClass(t.priority)}">${t.priority||'-'}</span></td>
        <td>${t.assigned||'-'}</td>
        <td>${fmtDate(t.updatedAt)}</td>
        <td>
          <button class="btn small ghost" onclick="editTicket(${t.id})">Editar</button>
          ${SESSION.user?.role==='admin'? `<button class='btn small ghost' onclick='delTicket(${t.id})'>Excluir</button>`:''}
        </td>
      </tr>`)
    .join('');
  q('#ticketRows').innerHTML = rows || `<tr><td colspan="9" class="muted">Sem resultados</td></tr>`;
}
q('#searchTickets').addEventListener('input', renderTicketRows);
q('#filterStatus').addEventListener('change', renderTicketRows);
q('#filterPriority').addEventListener('change', renderTicketRows);

function openTicketForm(t){
  showModal('Novo Chamado', form=>{
    form.innerHTML = `
      <div class='row'>
        <label>Título <input name='title' required value="${t?.title||''}"></label>
        <label>Cliente <select name='clientId' required>${DBSTATE.clients.map(c=>`<option value='${c.id}' ${t?.clientId==c.id?'selected':''}>${c.name}</option>`)}</select></label>
      </div>
      <div class='row'>
        <label>Categoria <input name='category' value='${t?.category||''}' placeholder='Hardware, Software, Impressora...'></label>
        <label>Prioridade <select name='priority'>${['Baixa','Média','Alta','Urgente'].map(p=>`<option ${t?.priority===p?'selected':''}>${p}</option>`)}</select></label>
      </div>
      <div class='row'>
        <label>Status <select name='status'>${['open','progress','closed'].map(s=>`<option value='${s}' ${t?.status===s?'selected':''}>${labelStatus(s)}</option>`)}</select></label>
        <label>Atribuído a <select name='assigned'>${DBSTATE.users.filter(u=>u.role!=='admin').map(u=>`<option ${t?.assigned===u.username?'selected':''}>${u.username}</option>`)}</select></label>
      </div>
      <div class='row row-1'>
        <label>Descrição <textarea name='description' rows='4' placeholder='Detalhes do problema...'>${t?.description||''}</textarea></label>
      </div>
      <div class='row row-1'>
        <button class='btn brand'>Salvar</button>
      </div>`;
  }, (data)=>{
    const now = Date.now();
    if(t){ // update
      Object.assign(t, { ...data, clientId:+data.clientId, updatedAt: now });
    } else {
      const id = ++DBSTATE.seq.tickets;
      DBSTATE.tickets.push({ id, createdAt: now, updatedAt: now, ...data, clientId:+data.clientId });
    }
    DB.save(DBSTATE); refreshAll(); closeModal();
  });
}
function editTicket(id){ const t = DBSTATE.tickets.find(x=>x.id===id); openTicketForm(t); }
function delTicket(id){ if(confirm('Excluir chamado #' + id + '?')){ DBSTATE.tickets = DBSTATE.tickets.filter(t=>t.id!==id); DB.save(DBSTATE); refreshAll(); } }

// Export/Import Tickets
q('#btnExportTickets').addEventListener('click', ()=> downloadJSON('tickets.json', DBSTATE.tickets));
q('#importTickets').addEventListener('change', e=> importJSON(e, (arr)=>{ if(Array.isArray(arr)){ DBSTATE.tickets=arr; DB.save(DBSTATE); refreshAll(); }}));

// ======= Clientes =======
function renderClientRows(){
  const txt = q('#searchClients').value.toLowerCase();
  const rows = DBSTATE.clients
    .filter(c=> (c.name+c.email+c.phone).toLowerCase().includes(txt))
    .sort((a,b)=> a.name.localeCompare(b.name))
    .map(c=>`
      <tr>
        <td>#${c.id}</td>
        <td>${c.name}</td>
        <td>${c.email||'-'}</td>
        <td>${c.phone||'-'}</td>
        <td>${c.company||'-'}</td>
        <td>
          <button class="btn small ghost" onclick="editClient(${c.id})">Editar</button>
          ${SESSION.user?.role==='admin'? `<button class='btn small ghost' onclick='delClient(${c.id})'>Excluir</button>`:''}
        </td>
      </tr>`)
    .join('');
  q('#clientRows').innerHTML = rows || `<tr><td colspan='6' class='muted'>Sem clientes</td></tr>`;
}
q('#searchClients').addEventListener('input', renderClientRows);

function openClientForm(c){
  showModal('Cliente', form=>{
    form.innerHTML = `
      <div class='row'>
        <label>Nome <input name='name' required value='${c?.name||''}'></label>
        <label>E-mail <input name='email' type='email' value='${c?.email||''}'></label>
      </div>
      <div class='row'>
        <label>Telefone <input name='phone' value='${c?.phone||''}'></label>
        <label>Empresa/Local <input name='company' value='${c?.company||''}'></label>
      </div>
      <div class='row row-1'>
        <label>Observações <textarea name='notes' rows='3'>${c?.notes||''}</textarea></label>
      </div>
      <div class='row row-1'><button class='btn brand'>Salvar</button></div>`;
  }, data=>{
    if(c) Object.assign(c, data); else { const id=++DBSTATE.seq.clients; DBSTATE.clients.push({id, ...data}); }
    DB.save(DBSTATE); refreshAll(); closeModal();
  });
}
function editClient(id){ const c=DBSTATE.clients.find(x=>x.id===id); openClientForm(c); }
function delClient(id){ if(confirm('Excluir cliente #' + id + '?')){ DBSTATE.clients = DBSTATE.clients.filter(c=>c.id!==id); DB.save(DBSTATE); refreshAll(); } }

q('#btnExportClients').addEventListener('click', ()=> downloadJSON('clientes.json', DBSTATE.clients));
q('#importClients').addEventListener('change', e=> importJSON(e, arr=>{ if(Array.isArray(arr)){ DBSTATE.clients=arr; DB.save(DBSTATE); refreshAll(); }}));

// ======= Estoque =======
function renderInventoryRows(){
  const txt = q('#searchInventory').value.toLowerCase();
  const rows = DBSTATE.inventory
    .filter(i=> (i.name+i.sku).toLowerCase().includes(txt))
    .sort((a,b)=> a.name.localeCompare(b.name))
    .map(i=>`
      <tr>
        <td>${i.sku}</td>
        <td>${i.name}</td>
        <td>${i.category||'-'}</td>
        <td>${i.location||'-'}</td>
        <td>${i.qty}</td>
        <td>${i.minQty||0}</td>
        <td>${i.vendor||'-'}</td>
        <td>
          <button class='btn small ghost' onclick='adjustQty(${i.id},1)'>+1</button>
          <button class='btn small ghost' onclick='adjustQty(${i.id},-1)'>-1</button>
          <button class='btn small ghost' onclick='editItem(${i.id})'>Editar</button>
          ${SESSION.user?.role==='admin'? `<button class='btn small ghost' onclick='delItem(${i.id})'>Excluir</button>`:''}
        </td>
      </tr>`)
    .join('');
  q('#inventoryRows').innerHTML = rows || `<tr><td colspan='8' class='muted'>Sem itens</td></tr>`;
}

function openItemForm(i){
  showModal('Item de Estoque', form=>{
    form.innerHTML = `
      <div class='row'>
        <label>SKU <input name='sku' required value='${i?.sku||''}'></label>
        <label>Nome do Item <input name='name' required value='${i?.name||''}'></label>
      </div>
      <div class='row'>
        <label>Categoria <input name='category' value='${i?.category||''}'></label>
        <label>Local <input name='location' value='${i?.location||''}'></label>
      </div>
      <div class='row'>
        <label>Quantidade <input name='qty' type='number' value='${i?.qty||0}'></label>
        <label>Mínimo <input name='minQty' type='number' value='${i?.minQty||0}'></label>
      </div>
      <div class='row'>
        <label>Fornecedor <input name='vendor' value='${i?.vendor||''}'></label>
        <div></div>
      </div>
      <div class='row row-1'><button class='btn brand'>Salvar</button></div>`;
  }, data=>{
    data.qty = +data.qty||0; data.minQty=+data.minQty||0;
    if(i) Object.assign(i, data); else { const id=++DBSTATE.seq.inventory; DBSTATE.inventory.push({id, ...data}); }
    DB.save(DBSTATE); refreshAll(); closeModal();
  });
}
function editItem(id){ const i=DBSTATE.inventory.find(x=>x.id===id); openItemForm(i); }
function delItem(id){ if(confirm('Excluir item?')){ DBSTATE.inventory = DBSTATE.inventory.filter(i=>i.id!==id); DB.save(DBSTATE); refreshAll(); } }
function adjustQty(id, delta){ const i=DBSTATE.inventory.find(x=>x.id===id); if(!i) return; i.qty=Math.max(0,(i.qty||0)+delta); DB.save(DBSTATE); refreshAll(); }

q('#btnExportInventory').addEventListener('click', ()=> downloadJSON('estoque.json', DBSTATE.inventory));
q('#importInventory').addEventListener('change', e=> importJSON(e, arr=>{ if(Array.isArray(arr)){ DBSTATE.inventory=arr; DB.save(DBSTATE); refreshAll(); }}));

// ======= Usuários (Admin) =======
function renderUserRows(){
  const rows = DBSTATE.users
    .map(u=> `<tr><td>${u.username}</td><td>${u.name}</td><td>${u.role==='admin'?'Administrador':'Técnico'}</td><td>${u.role==='admin'?'—':`<button class='btn small ghost' onclick='editUser(${u.id})'>Editar</button> <button class='btn small ghost' onclick='delUser(${u.id})'>Excluir</button>`}</td></tr>`)
    .join('');
  q('#userRows').innerHTML = rows || `<tr><td colspan='4' class='muted'>Sem usuários</td></tr>`;
}
function openUserForm(u){
  showModal('Técnico', form=>{
    form.innerHTML = `
      <div class='row'>
        <label>Login <input name='username' required value='${u?.username||''}'></label>
        <label>Nome <input name='name' required value='${u?.name||''}'></label>
      </div>
      <div class='row'>
        <label>Senha <input name='password' type='password' value='${u?.password||''}' placeholder='${u?'(manter se vazio)':''}'></label>
        <label>Perfil <select name='role'><option value='tech' ${u?.role==='tech'?'selected':''}>Técnico</option><option value='admin' ${u?.role==='admin'?'selected':''}>Administrador</option></select></label>
      </div>
      <div class='row row-1'><button class='btn brand'>Salvar</button></div>`;
  }, data=>{
    if(u){
      u.username=data.username; u.name=data.name; if(data.password) u.password=data.password; u.role=data.role;
    } else {
      const id=++DBSTATE.seq.users; DBSTATE.users.push({id, ...data});
    }
    DB.save(DBSTATE); refreshAll(); closeModal();
  });
}
function editUser(id){ const u=DBSTATE.users.find(x=>x.id===id); openUserForm(u); }
function delUser(id){ if(confirm('Excluir usuário?')){ DBSTATE.users = DBSTATE.users.filter(u=>u.id!==id); DB.save(DBSTATE); refreshAll(); } }

// ======= Configurações (Admin) =======
function loadSettingsUI(){ q('#cfgTitle').value = DBSTATE.settings.title||''; q('#cfgCompany').value = DBSTATE.settings.company||''; }
q('#btnSaveSettings').addEventListener('click', ()=>{
  DBSTATE.settings.title = q('#cfgTitle').value.trim()||'Helpdesk & Estoque';
  DBSTATE.settings.company = q('#cfgCompany').value.trim()||'';
  DB.save(DBSTATE);
  document.title = DBSTATE.settings.title + ' — ' + (SESSION.user?.role==='admin'?'Admin':'Técnico');
  alert('Configurações salvas!');
});

// Backup geral
q('#btnBackupAll').addEventListener('click', ()=> downloadJSON('backup_helpdesk.json', DBSTATE));
q('#restoreAll').addEventListener('change', e=> importJSON(e, data=>{ if(data && data.users && data.tickets){ DBSTATE=data; DB.save(DBSTATE); refreshAll(); alert('Backup restaurado.'); } }));

// ======= Modal Dinâmico =======
function showModal(title, build, onsubmit){
  q('#formTitle').textContent = title;
  const form = q('#dynamicForm');
  build(form);
  q('#formModal').style.display='flex';
  form.onsubmit = (ev)=>{
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    onsubmit && onsubmit(data);
  }
}
function closeModal(){ q('#formModal').style.display='none'; q('#dynamicForm').innerHTML=''; }
q('#btnCloseModal').addEventListener('click', closeModal);

// ======= Helpers Export/Import =======
function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(evt, cb){
  const f = evt.target.files[0]; if(!f) return; const reader = new FileReader();
  reader.onload = () => { try{ const data = JSON.parse(reader.result); cb && cb(data); } catch(e){ alert('Arquivo inválido'); } };
  reader.readAsText(f);
}

// ======= Botões Globais =======
q('#btnNewTicket').addEventListener('click', ()=> openTicketForm());
q('#btnNewClient').addEventListener('click', ()=> openClientForm());
q('#btnNewItem').addEventListener('click', ()=> openItemForm());
q('#btnNewUser').addEventListener('click', ()=> openUserForm());

// ======= Login Flow =======
function requireAuth(){
  if(!SESSION.user){ q('#loginModal').style.display='flex'; }
  else { q('#loginModal').style.display='none'; updateHeader(); gateByRole(); refreshAll(); }
}
q('#btnDoLogin').addEventListener('click', ()=>{
  const u = q('#loginUser').value.trim(); const p=q('#loginPass').value;
  if(SESSION.login(u,p)){ requireAuth(); showSection('dashboard'); document.title = DBSTATE.settings.title + ' — ' + (SESSION.user.role==='admin'?'Admin':'Técnico'); }
  else alert('Credenciais inválidas');
});
q('#btnLogout').addEventListener('click', ()=>{ SESSION.logout(); requireAuth(); });

// ======= Refresh geral =======
function refreshAll(){
  updateHeader(); gateByRole(); loadSettingsUI();
  refreshKPIs(); refreshDashTables();
  renderTicketRows(); renderClientRows(); renderInventoryRows(); renderUserRows();
}

// ======= Inicialização =======
requireAuth();
showSection('dashboard');

// ======= Expor algumas funções ao escopo global para os botões inline =======
window.editTicket = editTicket; window.delTicket=delTicket;
window.editClient = editClient; window.delClient=delClient;
window.editItem = editItem; window.delItem=delItem; window.adjustQty=adjustQty;
window.editUser = editUser; window.delUser=delUser;

// ======= Menu Mobile =======
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainNav = document.getElementById('mainNav');

if (mobileMenuBtn && mainNav) {
  mobileMenuBtn.addEventListener('click', () => {
    mainNav.classList.toggle('active');
  });
  
  // Fechar menu ao clicar fora dele
  document.addEventListener('click', (e) => {
    if (mainNav.classList.contains('active') && 
        !mainNav.contains(e.target) && 
        e.target !== mobileMenuBtn) {
      mainNav.classList.remove('active');
    }
  });
  
  // Fechar menu ao clicar em um item
  const navItems = mainNav.querySelectorAll('button');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      mainNav.classList.remove('active');
    });
  });
}

// Melhorar a experiência em mobile
function improveMobileUX() {
  // Ajustar viewport para dispositivos móveis
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, shrink-to-fit=no');
  }
  
  // Prevenir zoom em inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      window.scrollTo(0, 0);
      document.body.style.zoom = "100%";
    });
  });
}

// Executar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  improveMobileUX();
});