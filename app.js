/*
 * CONFIGURACIÓN:
 * 1) Crea un proyecto en https://supabase.com
 * 2) Copia Project URL y anon/public key desde Project Settings > API.
 * 3) Pégalos abajo. La anon key es pública; NUNCA pongas service_role key aquí.
 */
const SUPABASE_URL = "PEGA_AQUI_TU_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "PEGA_AQUI_TU_SUPABASE_ANON_PUBLIC_KEY";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
let currentUser = null;
let profile = null;
let authMode = "login";
let jobsCache = [];

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  setTimeout(() => $("toast").classList.add("hidden"), 4000);
}
function showModal(id) { $(id).classList.remove("hidden"); }
function hideModals() { $("authModal").classList.add("hidden"); $("jobModal").classList.add("hidden"); }
function authDialog(mode="login", role="candidate") {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "Iniciar sesión" : "Crear una cuenta";
  $("authSubtitle").textContent = mode === "login" ? "Ingresa con tu correo y contraseña." : "Regístrate para usar todas las funciones de la plataforma.";
  $("nameField").classList.toggle("hidden", mode === "login");
  $("roleField").classList.toggle("hidden", mode === "login");
  $("companyField").classList.toggle("hidden", mode === "login" || role !== "employer");
  $("accountRole").value = role;
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authSubmit").textContent = mode === "login" ? "Iniciar sesión" : "Crear cuenta";
  $("switchAuth").textContent = mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión";
  $("authMessage").textContent = "";
  showModal("authModal");
}
function openPublish() {
  if (!currentUser) { authDialog("login"); toast("Inicia sesión con una cuenta de empresa para publicar vacantes."); return; }
  if (profile?.role !== "employer" && profile?.role !== "admin") { toast("La publicación de vacantes está habilitada para cuentas de empresa."); return; }
  $("jobMessage").textContent = "";
  showModal("jobModal");
}
async function loadProfile() {
  if (!db || !currentUser) { profile = null; return; }
  const { data, error } = await db.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  if (error) console.error(error);
  profile = data;
}
function updateAuthUI() {
  $("loginBtn").classList.toggle("hidden", !!currentUser);
  $("registerBtn").classList.toggle("hidden", !!currentUser);
  $("logoutBtn").classList.toggle("hidden", !currentUser);
}
async function loadJobs() {
  const list = $("jobsList");
  if (!db) {
    list.innerHTML = `<div class="empty">La página ya está lista visualmente. Para cargar y guardar vacantes reales, configura Supabase siguiendo el archivo <b>README.md</b> y ejecuta <b>supabase/schema.sql</b>.</div>`;
    $("jobsCount").textContent = "0"; $("companiesCount").textContent = "0"; return;
  }
  const { data, error } = await db.from("jobs").select("id,title,company_name,city,area,contract_type,work_mode,description,salary,created_at,profiles(full_name)").eq("status","published").order("created_at",{ascending:false});
  if (error) { console.error(error); list.innerHTML = `<div class="empty">No fue posible cargar las vacantes. Verifica las políticas y la configuración de Supabase.</div>`; return; }
  jobsCache = data || [];
  $("jobsCount").textContent = jobsCache.length;
  const { count } = await db.from("profiles").select("*",{count:"exact",head:true}).eq("role","employer");
  $("companiesCount").textContent = count ?? 0;
  renderJobs();
}
function renderJobs() {
  const term = $("searchJobs").value.toLowerCase().trim();
  const city = $("filterCity").value;
  const area = $("filterArea").value;
  const filtered = jobsCache.filter(j => (!city || j.city===city) && (!area || j.area===area) && (!term || `${j.title} ${j.company_name} ${j.description}`.toLowerCase().includes(term)));
  $("jobsList").innerHTML = filtered.length ? filtered.map(j => `
    <article class="job-card"><span class="job-area">${escapeHTML(j.area || "Oportunidad")}</span><h3>${escapeHTML(j.title)}</h3><div class="job-company">${escapeHTML(j.company_name)}</div>
    <div class="job-meta"><span>⌖ ${escapeHTML(j.city)}</span><span>◷ ${escapeHTML(j.work_mode || "Presencial")}</span><span>▣ ${escapeHTML(j.contract_type || "Por definir")}</span></div>
    <p class="job-desc">${escapeHTML((j.description || "").slice(0,145))}${(j.description||"").length>145?"…":""}</p>
    <div class="job-footer"><small>${j.salary ? escapeHTML(j.salary) : "Salario a convenir"}</small><button class="btn apply-btn" data-apply="${j.id}">Postularme</button></div></article>`).join("") : `<div class="empty">No encontramos vacantes con esos filtros. Intenta otra búsqueda.</div>`;
}
function escapeHTML(value="") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function submitApplication(jobId) {
  if (!currentUser) { authDialog("login"); toast("Inicia sesión como candidato para postularte."); return; }
  if (profile?.role !== "candidate") { toast("Solo las cuentas de candidato pueden postularse."); return; }
  const { error } = await db.from("applications").insert({job_id:jobId,candidate_id:currentUser.id,status:"submitted"});
  if (error) { toast(error.code==="23505" ? "Ya te postulaste a esta vacante." : `No se pudo enviar la postulación: ${error.message}`); return; }
  toast("¡Postulación enviada! Puedes consultar su estado en tu panel.");
  loadDashboard();
}
async function loadDashboard() {
  const dash = $("dashboard");
  if (!currentUser || !db) { dash.innerHTML = `<div class="empty">${!db?"Configura Supabase para habilitar las cuentas.":"Inicia sesión para ver tu panel personal."}</div>`; return; }
  await loadProfile();
  if (!profile) { dash.innerHTML = `<div class="empty">Tu perfil está pendiente de configuración. Cierra sesión y vuelve a ingresar.</div>`; return; }
  if (profile.role === "candidate") {
    const {data,error} = await db.from("applications").select("id,status,created_at,jobs(title,company_name,city)").eq("candidate_id",currentUser.id).order("created_at",{ascending:false});
    if(error){dash.innerHTML=`<div class="empty">No se pudieron cargar tus postulaciones.</div>`;return;}
    dash.innerHTML = `<h3>Hola, ${escapeHTML(profile.full_name||"candidato")}</h3><p class="hint">Aquí puedes revisar el estado de tus postulaciones.</p><div class="dash-panel">${(data||[]).length?(data||[]).map(a=>`<div class="dash-item"><b>${escapeHTML(a.jobs?.title||"Vacante")}</b> · ${escapeHTML(a.jobs?.company_name||"Empresa")}<br><small>${escapeHTML(a.jobs?.city||"")} · ${new Date(a.created_at).toLocaleDateString("es-CO")}</small><br><span class="status ${a.status==="hired"?"hired":a.status==="rejected"?"rejected":""}">${statusLabel(a.status)}</span></div>`).join(""):"Aún no tienes postulaciones. Explora las vacantes y postúlate."}</div>`;
  } else {
    const {data:jobs,error} = await db.from("jobs").select("id,title,status,created_at").eq("employer_id",currentUser.id).order("created_at",{ascending:false});
    if(error){dash.innerHTML=`<div class="empty">No se pudieron cargar tus vacantes.</div>`;return;}
    const jobIds=(jobs||[]).map(j=>j.id);
    let apps=[];
    if(jobIds.length){const result=await db.from("applications").select("id,status,created_at,candidate_id,jobs(title),profiles:profiles!applications_candidate_id_fkey(full_name,email)").in("job_id",jobIds).order("created_at",{ascending:false});if(!result.error)apps=result.data||[];}
    dash.innerHTML = `<div class="dashboard-grid"><div class="dash-panel"><h3>Mis vacantes</h3><button class="btn" id="dashPublish">Publicar vacante</button>${(jobs||[]).map(j=>`<div class="dash-item"><b>${escapeHTML(j.title)}</b><br><span class="status">${escapeHTML(j.status)}</span></div>`).join("")||"<p class='hint'>Todavía no has publicado vacantes.</p>"}</div><div class="dash-panel"><h3>Postulaciones recibidas</h3>${apps.map(a=>`<div class="dash-item"><b>${escapeHTML(a.profiles?.full_name||"Candidato")}</b><br><small>${escapeHTML(a.jobs?.title||"Vacante")}</small><br><span class="status">${statusLabel(a.status)}</span><br><select data-status="${a.id}"><option value="submitted" ${a.status==="submitted"?"selected":""}>Recibida</option><option value="reviewing" ${a.status==="reviewing"?"selected":""}>En revisión</option><option value="interview" ${a.status==="interview"?"selected":""}>Entrevista</option><option value="hired" ${a.status==="hired"?"selected":""}>Contratado</option><option value="rejected" ${a.status==="rejected"?"selected":""}>No seleccionado</option></select></div>`).join("")||"<p class='hint'>Aún no hay postulaciones.</p>"}</div></div>`;
    $("dashPublish")?.addEventListener("click",openPublish);
    dash.querySelectorAll("[data-status]").forEach(sel=>sel.addEventListener("change",()=>updateApplicationStatus(sel.dataset.status,sel.value)));
  }
}
function statusLabel(status){return ({submitted:"Postulación recibida",reviewing:"En revisión",interview:"Entrevista",hired:"Contratado",rejected:"No seleccionado"})[status]||status;}
async function updateApplicationStatus(id,status){
  const {error}=await db.from("applications").update({status}).eq("id",id);
  if(error){toast("No se pudo actualizar el estado.");return;}
  toast("Estado de postulación actualizado.");loadDashboard();
}

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!db){$("authMessage").textContent="Primero configura Supabase siguiendo README.md.";return;}
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  $("authMessage").textContent="Procesando...";
  if(authMode==="login"){
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){$("authMessage").textContent=error.message;return;}
    currentUser=data.user; await loadProfile(); hideModals(); updateAuthUI(); loadDashboard(); toast("Sesión iniciada correctamente.");
  } else {
    const role=$("accountRole").value,fullName=$("fullName").value.trim();
    const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:fullName,role,company_name:$("companyName").value.trim()}}});
    if(error){$("authMessage").textContent=error.message;return;}
    $("authMessage").textContent="Cuenta creada. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada. Después inicia sesión.";
    $("authForm").reset();
  }
});
$("switchAuth").addEventListener("click",()=>authDialog(authMode==="login"?"signup":"login"));
$("accountRole").addEventListener("change",()=> $("companyField").classList.toggle("hidden",$("accountRole").value!=="employer"));
$("jobForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!db||!currentUser||!profile){$("jobMessage").textContent="Inicia sesión con tu cuenta de empresa.";return;}
  const payload={employer_id:currentUser.id,title:$("jobTitle").value.trim(),company_name:$("jobCompany").value.trim(),city:$("jobCity").value,area:$("jobArea").value,contract_type:$("jobContract").value,work_mode:$("jobMode").value,description:$("jobDescription").value.trim(),salary:$("jobSalary").value.trim()||null,contact_email:$("jobContact").value.trim()||null,status:"published"};
  const {error}=await db.from("jobs").insert(payload);
  if(error){$("jobMessage").textContent=error.message;return;}
  $("jobForm").reset();hideModals();toast("Vacante publicada correctamente.");loadJobs();loadDashboard();location.hash="#vacantes";
});
$("jobsList").addEventListener("click",e=>{const b=e.target.closest("[data-apply]");if(b)submitApplication(b.dataset.apply);});
$("loginBtn").addEventListener("click",()=>authDialog("login"));
$("registerBtn").addEventListener("click",()=>authDialog("signup"));
$("logoutBtn").addEventListener("click",async()=>{if(db)await db.auth.signOut();currentUser=null;profile=null;updateAuthUI();loadDashboard();toast("Sesión cerrada.");});
$("heroPublish").addEventListener("click",openPublish);
document.querySelectorAll("[data-register-role]").forEach(b=>b.addEventListener("click",()=>authDialog("signup",b.dataset.registerRole)));
$("reloadJobs").addEventListener("click",loadJobs);
$("searchBtn").addEventListener("click",renderJobs);
$("searchJobs").addEventListener("input",renderJobs);
$("filterCity").addEventListener("change",renderJobs);$("filterArea").addEventListener("change",renderJobs);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",hideModals));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hideModals();}));
$("menuToggle").addEventListener("click",()=>{const n=$("mainNav");n.classList.toggle("open");$("menuToggle").setAttribute("aria-expanded",String(n.classList.contains("open")));});
$("mainNav").querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>$("mainNav").classList.remove("open")));
$("year").textContent=new Date().getFullYear();

async function init(){
  if(!db){updateAuthUI();await loadJobs();loadDashboard();return;}
  const {data:{session}}=await db.auth.getSession();
  currentUser=session?.user||null;await loadProfile();updateAuthUI();await loadJobs();await loadDashboard();
  db.auth.onAuthStateChange(async(_event,session)=>{currentUser=session?.user||null;await loadProfile();updateAuthUI();loadDashboard();});
}
init();
