const db = window.supabase.createClient("https://azlfifojrhzvezcsyogg.supabase.co","sb_publishable_ZzYqXmSxef6YTilUe5Pk0w_2ODNM8eq");
let rows=[];let pendingJob=null;
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(){
 const q=document.getElementById("q").value.toLowerCase();
 const city=document.getElementById("cityFilter").value;const sort=document.getElementById("sortJobs").value;const filtered=rows.filter(x=>(!city||x.city===city)&&(x.title+" "+x.company_name+" "+x.description).toLowerCase().includes(q)).sort((a,b)=>sort==="oldest"?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at));
 document.getElementById("jobs").innerHTML=filtered.length?filtered.map(j=>
  '<article class="candidate-row"><div><h3>'+esc(j.title)+'</h3><p>'+esc(j.is_confidential?"Empresa confidencial":j.company_name)+' · '+esc(j.city)+' · '+esc(j.work_mode||"Presencial")+'</p><p>'+esc((j.description||"").slice(0,220))+'</p></div><button class="primary-btn" data-apply="'+esc(j.id)+'">Postularme</button></article>'
 ).join(""):'<div class="empty">No hay vacantes que coincidan con tu búsqueda.</div>';
}
db.from("jobs").select("id,title,company_name,is_confidential,city,work_mode,description,created_at").eq("status","published").order("created_at",{ascending:false}).then(({data,error})=>{
 rows=data||[];
 document.getElementById("jobs").innerHTML=error?"No se pudieron cargar las vacantes.":"";
 render();
});
document.getElementById("q").addEventListener("input",render);document.getElementById("sortJobs").addEventListener("change",render);document.getElementById("cityFilter").addEventListener("change",render);
document.getElementById("jobs").addEventListener("click",async e=>{
 const b=e.target.closest("[data-apply]");if(!b)return;
 const {data:{user}}=await db.auth.getUser();
 if(!user){location.href="index.html";return;}
 const {data:p,error:profileError}=await db.from("profiles").select("role,cv_storage_path").eq("id",user.id).single();
 if(profileError){alert("No se pudo consultar tu perfil: "+profileError.message);return;}
 if(p?.role!=="candidate"){alert("Esta acción está disponible para cuentas de candidato.");return;}
 if(!p.cv_storage_path){alert("Antes de postularte, carga tu hoja de vida en tu perfil.");location.href="dashboard.html";return;}
 pendingJob=b.dataset.apply;document.getElementById("applyConsent").checked=false;document.getElementById("applyCover").value="";document.getElementById("applyMessage").textContent="";
 document.getElementById("applyModal").hidden=false;
});
document.getElementById("closeApply").addEventListener("click",()=>document.getElementById("applyModal").hidden=true);
document.getElementById("applyForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!pendingJob||!document.getElementById("applyConsent").checked)return;
 const submit=e.currentTarget.querySelector("button[type=submit]");submit.disabled=true;submit.textContent="Enviando…";
 const {data:{user}}=await db.auth.getUser();
 const {data:createdApplication,error}=await db.from("applications").insert({job_id:pendingJob,candidate_id:user.id,status:"submitted",cover_letter:document.getElementById("applyCover").value.trim()||null,data_consent:true,data_consent_at:new Date().toISOString(),data_consent_version:"2026-11-15"}).select("id").single();
 submit.disabled=false;submit.textContent="Enviar postulación";
 if(error){document.getElementById("applyMessage").textContent=error.code==="23505"?"Ya te postulaste a esta vacante.":error.message;return;}
 if(createdApplication?.id){const mail=await db.functions.invoke("send-notification-email",{body:{event_type:"new_application",entity_id:createdApplication.id}});if(mail.error)console.warn("Correo de nueva postulación pendiente:",mail.error.message);}
 document.getElementById("applyModal").hidden=true;location.href="dashboard.html";
});
