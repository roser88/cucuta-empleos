/*
 * CONFIGURACIÓN:
 * 1) Crea un proyecto en https://supabase.com
 * 2) Copia Project URL y anon/public key desde Project Settings > API.
 * 3) Pégalos abajo. La anon key es pública; NUNCA pongas service_role key aquí.
 */
const SUPABASE_URL = "https://azlfifojrhzvezcsyogg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZzYqXmSxef6YTilUe5Pk0w_2ODNM8eq";
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
function hideModals() { document.querySelectorAll(".modal").forEach(modal=>modal.classList.add("hidden")); }
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
  const { data, error } = await db.from("jobs").select("id,title,company_name,is_confidential,city,area,contract_type,work_mode,description,salary,contact_email,created_at").eq("status","published").order("created_at",{ascending:false});
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
    <article class="job-card"><span class="job-area">${escapeHTML(j.area || "Oportunidad")}</span><h3>${escapeHTML(j.title)}</h3><div class="job-company">${escapeHTML(j.is_confidential ? "Empresa confidencial" : j.company_name)}</div>
    <div class="job-meta"><span>⌖ ${escapeHTML(j.city)}</span><span>◷ ${escapeHTML(j.work_mode || "Presencial")}</span><span>▣ ${escapeHTML(j.contract_type || "Por definir")}</span></div>
    <p class="job-desc">${escapeHTML((j.description || "").slice(0,145))}${(j.description||"").length>145?"…":""}</p>
    <div class="job-footer"><small>${j.salary ? escapeHTML(j.salary) : "Salario a convenir"}</small><button class="btn apply-btn" data-details="${j.id}">Ver detalles</button><button class="btn apply-btn" data-apply="${j.id}">Postularme</button></div></article>`).join("") : `<div class="empty">No encontramos vacantes con esos filtros. Intenta otra búsqueda.</div>`;
}
function escapeHTML(value="") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

let pendingJobId = null;
async function submitApplication(jobId) {
 if(!currentUser){authDialog("login");toast("Inicia sesión como candidato para postularte.");return;}
 if(profile?.role!=="candidate"){toast("Solo las cuentas de candidato pueden postularse.");return;}
 pendingJobId=jobId;$("coverLetter").value="";$("applicationMessage").textContent="";showModal("applicationModal");
}
async function saveApplication(e){
 e.preventDefault();if(!pendingJobId||!currentUser||profile?.role!=="candidate")return;
 const b=$("applicationSubmit");b.disabled=true;b.textContent="Enviando...";
 const {error}=await db.from("applications").insert({job_id:pendingJobId,candidate_id:currentUser.id,status:"submitted",cover_letter:$("coverLetter").value.trim()||null});
 b.disabled=false;b.textContent="Enviar postulación";
 if(error){$("applicationMessage").textContent=error.code==="23505"?"Ya te postulaste a esta vacante.":error.message;return;}
 hideModals();pendingJobId=null;toast("¡Postulación enviada!");await loadDashboard();await loadJobs();
}
function showJobDetails(id){
 const j=jobsCache.find(x=>x.id===id);if(!j)return;
 $("detailTitle").textContent=j.title;$("detailCompany").textContent=j.is_confidential?"Empresa confidencial":j.company_name;
 $("detailMeta").textContent=[j.city,j.area,j.contract_type,j.work_mode].filter(Boolean).join(" · ");
 $("detailDescription").textContent=j.description||"Sin descripción.";$("detailSalary").textContent=j.salary||"Salario a convenir";
 $("detailApply").dataset.apply=id;showModal("jobDetailsModal");
}
async function loadDashboardBase() {
  const dash = $("dashboard");
  if (!currentUser || !db) { dash.innerHTML = `<div class="empty">${!db?"Configura Supabase para habilitar las cuentas.":"Inicia sesión para ver tu panel personal."}</div>`; return; }
  await loadProfile();
  if (!profile) { dash.innerHTML = `<div class="empty">Tu perfil está pendiente de configuración. Cierra sesión y vuelve a ingresar.</div>`; return; }
  if (profile.role === "candidate") {
    const {data,error} = await db.from("applications").select("id,status,created_at,cv_viewed_at,jobs(title,company_name,city,is_confidential)").eq("candidate_id",currentUser.id).order("created_at",{ascending:false});
    if(error){dash.innerHTML=`<div class="empty">No se pudieron cargar tus postulaciones.</div>`;return;}
    dash.innerHTML = `<h3>Hola, ${escapeHTML(profile.full_name||"candidato")}</h3><p class="hint">Aquí puedes revisar el estado de tus postulaciones.</p><div class="dash-panel">${(data||[]).length?(data||[]).map(a=>`<div class="dash-item"><b>${escapeHTML(a.jobs?.title||"Vacante")}</b> · ${escapeHTML(a.jobs?.is_confidential?"Empresa confidencial":(a.jobs?.company_name||"Empresa"))}<br><small>${escapeHTML(a.jobs?.city||"")} · ${new Date(a.created_at).toLocaleDateString("es-CO")}</small><br><span class="status ${a.status==="hired"?"hired":a.status==="rejected"?"rejected":""}">${statusLabel(a.status)}</span><p class="hint">${a.cv_viewed_at?"La empresa visualizó tu hoja de vida el "+new Date(a.cv_viewed_at).toLocaleString("es-CO")+".":"La empresa aún no ha registrado la visualización de tu hoja de vida."}</p></div>`).join(""):"Aún no tienes postulaciones. Explora las vacantes y postúlate."}</div>`;
  } else {
    const {data:jobs,error} = await db.from("jobs").select("id,title,status,created_at,is_confidential").eq("employer_id",currentUser.id).order("created_at",{ascending:false});
    if(error){dash.innerHTML=`<div class="empty">No se pudieron cargar tus vacantes.</div>`;return;}
    const jobIds=(jobs||[]).map(j=>j.id);
    let apps=[];
    if(jobIds.length){const result=await db.from("applications").select("id,status,created_at,candidate_id,jobs(title),profiles:profiles!applications_candidate_id_fkey(full_name,email)").in("job_id",jobIds).order("created_at",{ascending:false});if(!result.error)apps=result.data||[];}
    dash.innerHTML = `<div class="dashboard-grid"><div class="dash-panel"><h3>Mis vacantes</h3><button class="btn" id="dashPublish">Publicar vacante</button>${(jobs||[]).map(j=>`<div class="dash-item"><b>${escapeHTML(j.title)}</b>${j.is_confidential?" · Confidencial":""}<br><span class="status">${escapeHTML(j.status)}</span><label class="job-state-label">Gestionar vacante<select data-job-status="${j.id}"><option value="published" ${j.status==="published"?"selected":""}>Publicada</option><option value="paused" ${j.status==="paused"?"selected":""}>Pausada</option><option value="closed" ${j.status==="closed"?"selected":""}>Cerrada</option></select></label></div>`).join("")||"<p class='hint'>Todavía no has publicado vacantes.</p>"}</div><div class="dash-panel"><h3>Postulaciones recibidas</h3>${apps.map(a=>`<div class="dash-item"><b>${escapeHTML(a.profiles?.full_name||"Candidato")}</b><br><small>${escapeHTML(a.jobs?.title||"Vacante")}</small><br><span class="status">${statusLabel(a.status)}</span><br><select data-status="${a.id}"><option value="submitted" ${a.status==="submitted"?"selected":""}>Recibida</option><option value="reviewing" ${a.status==="reviewing"?"selected":""}>En revisión</option><option value="interview" ${a.status==="interview"?"selected":""}>Entrevista</option><option value="contactable" ${a.status==="contactable"?"selected":""}>Puede ser contactado</option><option value="kept_in_file" ${a.status==="kept_in_file"?"selected":""}>Hoja de vida conservada</option><option value="hired" ${a.status==="hired"?"selected":""}>Contratado</option><option value="rejected" ${a.status==="rejected"?"selected":""}>No seleccionado</option></select></div>`).join("")||"<p class='hint'>Aún no hay postulaciones.</p>"}</div></div>`;
    $("dashPublish")?.addEventListener("click",openPublish);
    dash.querySelectorAll("[data-job-status]").forEach(sel=>sel.addEventListener("change",async()=>{const {error}=await db.from("jobs").update({status:sel.value,updated_at:new Date().toISOString()}).eq("id",sel.dataset.jobStatus);if(error){toast("No se pudo cambiar el estado: "+error.message);return;}toast("Estado de vacante actualizado.");await loadJobs();}));
    dash.querySelectorAll("[data-status]").forEach(sel=>sel.addEventListener("change",()=>updateApplicationStatus(sel.dataset.status,sel.value)));
  }
}
function statusLabel(status){return ({submitted:"Postulación recibida",reviewing:"En revisión",interview:"Entrevista",contactable:"Puede ser contactado en cualquier momento",kept_in_file:"Hoja de vida conservada para futuras oportunidades",hired:"Contratado",rejected:"No seleccionado"})[status]||status;}
async function updateApplicationStatus(id,status){
  const {error}=await db.from("applications").update({status}).eq("id",id);
  if(error){toast("No se pudo actualizar el estado.");return;}
  toast("Estado de postulación actualizado.");loadDashboard();
}


async function renderNotifications(dash){
 if(!currentUser||!db)return;
 const {data,error}=await db.from("notifications").select("id,title,message,is_read,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(10);
 if(error){console.warn("No se pudieron cargar notificaciones",error);return;}
 const panel=document.createElement("section");panel.className="dash-panel notification-panel";
 const items=(data||[]).map(n=>'<article class="notification-item '+(n.is_read?"read":"unread")+'"><b>'+escapeHTML(n.title)+'</b><p>'+escapeHTML(n.message)+'</p><small>'+new Date(n.created_at).toLocaleString("es-CO")+'</small>'+(n.is_read?"":' <button class="text-button" data-notification-read="'+n.id+'">Marcar como leída</button>')+'</article>').join("");
 panel.innerHTML="<h3>Notificaciones</h3>"+(items||'<p class="hint">No tienes notificaciones.</p>');
 dash.appendChild(panel);
 panel.querySelectorAll("[data-notification-read]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await db.from("notifications").update({is_read:true}).eq("id",b.dataset.notificationRead);if(!error){b.closest(".notification-item").classList.remove("unread");b.closest(".notification-item").classList.add("read");b.remove();}}));
}
async function loadDashboard() {
  await loadDashboardBase();
  await renderNotifications($("dashboard"));
  if (!currentUser || !profile || !db) return;
  const dash=$("dashboard");
  if(profile.role==="candidate"){
    const panel=document.createElement("div");panel.className="dash-panel";
    panel.innerHTML='<h3>Mi perfil profesional</h3><form id="profileForm" class="profile-grid">'+
      '<label>Nombre completo<input name="full_name" required value="'+escapeHTML(profile.full_name||"")+'"></label>'+
      '<label>Teléfono<input name="phone" value="'+escapeHTML(profile.phone||"")+'"></label>'+
      '<label>Ciudad<input name="city" value="'+escapeHTML(profile.city||"Cúcuta")+'"></label>'+
      '<label>Profesión o cargo<input name="professional_title" value="'+escapeHTML(profile.professional_title||"")+'"></label>'+
      '<label class="wide">Resumen profesional<textarea name="bio">'+escapeHTML(profile.bio||"")+'</textarea></label>'+
      '<label class="wide">Habilidades<input name="skills" value="'+escapeHTML(profile.skills||"")+'"></label>'+
      '<label class="wide">Formación académica<textarea name="education">'+escapeHTML(profile.education||"")+'</textarea></label>'+
      '<label class="wide">Experiencia laboral<textarea name="experience">'+escapeHTML(profile.experience||"")+'</textarea></label>'+
      '<label class="wide">LinkedIn<input name="linkedin_url" type="url" value="'+escapeHTML(profile.linkedin_url||"")+'"></label>'+
      '<button class="btn wide" type="submit">Guardar perfil</button><p id="profileMsg" class="form-message wide"></p></form>'+
      '<hr><h3>Hoja de vida</h3><p class="hint">PDF, DOC o DOCX · máximo 10 MB. Archivo privado para ti y las empresas a las que te postules.</p>'+
      '<form id="cvForm"><input id="cvFile" type="file" accept=".pdf,.doc,.docx" required><button class="btn" type="submit">Subir hoja de vida</button><p id="cvMsg" class="form-message"></p></form>'+
      '<p class="hint">'+(profile.cv_storage_path?"Tienes una hoja de vida cargada.":"Aún no has cargado tu hoja de vida.")+'</p>';
    dash.appendChild(panel);
    $("profileForm").addEventListener("submit",async e=>{
      e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());data.updated_at=new Date().toISOString();
      const {error}=await db.from("profiles").update(data).eq("id",currentUser.id);
      $("profileMsg").textContent=error?error.message:"Perfil actualizado.";if(!error){await loadProfile();toast("Perfil guardado.");}
    });
    $("cvForm").addEventListener("submit",async e=>{
      e.preventDefault();const f=$("cvFile").files[0];if(!f)return;
      const allowed=["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if(!allowed.includes(f.type)||f.size>10*1024*1024){$("cvMsg").textContent="Selecciona PDF, DOC o DOCX de máximo 10 MB.";return;}
      const path=currentUser.id+"/"+Date.now()+"."+f.name.split(".").pop().toLowerCase();
      $("cvMsg").textContent="Subiendo...";
      const {error:up}=await db.storage.from("candidate-cvs").upload(path,f,{upsert:true,contentType:f.type});
      if(up){$("cvMsg").textContent=up.message;return;}
      const {error}=await db.from("profiles").update({cv_storage_path:path,cv_url:null}).eq("id",currentUser.id);
      $("cvMsg").textContent=error?error.message:"Hoja de vida cargada correctamente.";
      if(!error){await loadProfile();toast("Hoja de vida guardada.");}
    });
  } else {
    const {data:jobs}=await db.from("jobs").select("id").eq("employer_id",currentUser.id);
    const ids=(jobs||[]).map(j=>j.id);if(!ids.length)return;
    const {data:apps,error}=await db.from("applications").select("id,status,cover_letter,cv_viewed_at,profiles:profiles!applications_candidate_id_fkey(full_name,email,phone,city,professional_title,bio,skills,education,experience,linkedin_url,cv_storage_path),jobs(title)").in("job_id",ids);
    if(error){console.error(error);return;}
    const panel=document.createElement("div");panel.className="dash-panel";panel.innerHTML="<h3>Perfiles de candidatos y hojas de vida</h3>";
    (apps||[]).forEach(a=>{
      const item=document.createElement("div");item.className="dash-item";
      const p=a.profiles||{};
      item.innerHTML="<b>"+escapeHTML(p.full_name||"Candidato")+"</b><br>"+escapeHTML(a.jobs?.title||"Vacante")+
        "<p>"+escapeHTML(p.professional_title||"")+" · "+escapeHTML(p.city||"")+"</p><p>"+escapeHTML(p.bio||"")+"</p>"+
        "<p><b>Habilidades:</b> "+escapeHTML(p.skills||"No registradas")+"</p><p><b>Formación:</b> "+escapeHTML(p.education||"No registrada")+"</p>"+
        "<p><b>Experiencia:</b> "+escapeHTML(p.experience||"No registrada")+"</p>"+
        (a.cover_letter?"<p><b>Mensaje de postulación:</b> "+escapeHTML(a.cover_letter)+"</p>":"") +
        (p.linkedin_url?'<a href="'+escapeHTML(p.linkedin_url)+'" target="_blank" rel="noopener">LinkedIn</a>':"")+
        (p.cv_storage_path?'<p><button class="btn btn-outline">Ver hoja de vida</button></p>':"<p class='hint'>Sin hoja de vida cargada.</p>");
      const button=item.querySelector("button");
      if(button)button.addEventListener("click",async()=>{
        const win=window.open("about:blank","_blank");if(!win){toast("Permite las ventanas emergentes para abrir la hoja de vida.");return;}
        const {data,error}=await db.storage.from("candidate-cvs").createSignedUrl(p.cv_storage_path,60);
        if(error){win.close();toast(error.message);return;}
        const {error:mark}=await db.from("applications").update({cv_viewed_at:new Date().toISOString()}).eq("id",a.id);
        if(mark){win.close();toast(mark.message);return;}
        win.location.href=data.signedUrl;toast("Visualización registrada.");
      });
      panel.appendChild(item);
    });
    dash.appendChild(panel);
  }
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
$("forgotPassword")?.addEventListener("click",async()=>{const email=$("authEmail").value.trim();if(!email){$("authMessage").textContent="Escribe primero tu correo electrónico.";return;}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$("authMessage").textContent=error?error.message:"Si el correo está registrado, recibirás instrucciones para restablecer la contraseña.";});
$("accountRole").addEventListener("change",()=> $("companyField").classList.toggle("hidden",$("accountRole").value!=="employer"));
$("jobForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!db||!currentUser||!profile){$("jobMessage").textContent="Inicia sesión con tu cuenta de empresa.";return;}
  const payload={employer_id:currentUser.id,title:$("jobTitle").value.trim(),company_name:$("jobConfidential").checked?"Empresa confidencial":$("jobCompany").value.trim(),is_confidential:$("jobConfidential").checked,city:$("jobCity").value,area:$("jobArea").value,contract_type:$("jobContract").value,work_mode:$("jobMode").value,description:$("jobDescription").value.trim(),salary:$("jobSalary").value.trim()||null,contact_email:$("jobContact").value.trim()||null,status:"published"};
  const {error}=await db.from("jobs").insert(payload);
  if(error){$("jobMessage").textContent=error.message;return;}
  $("jobForm").reset();hideModals();toast("Vacante publicada correctamente.");loadJobs();loadDashboard();location.hash="#vacantes";
});
$("jobsList").addEventListener("click",e=>{const d=e.target.closest("[data-details]");if(d){showJobDetails(d.dataset.details);return;}const b=e.target.closest("[data-apply]");if(b)submitApplication(b.dataset.apply);});
$("detailApply").addEventListener("click",()=>{const id=$("detailApply").dataset.apply;hideModals();submitApplication(id);});
$("applicationForm").addEventListener("submit",saveApplication);
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
