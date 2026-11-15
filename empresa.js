const db=window.supabase.createClient("https://azlfifojrhzvezcsyogg.supabase.co","sb_publishable_ZzYqXmSxef6YTilUe5Pk0w_2ODNM8eq");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const companyId=new URLSearchParams(location.search).get("id");
let user=null,company=null;
async function init(){
 if(!companyId){document.getElementById("companyName").textContent="Empresa no encontrada";return}
 const p=await db.from("company_profiles").select("*").eq("company_id",companyId).maybeSingle();company=p.data;
 if(p.error||!company){document.getElementById("companyName").textContent="No se encontró el perfil público";return}
 document.getElementById("companyName").textContent=company.public_name;
 document.getElementById("companyCity").textContent=company.city||"Norte de Santander";
 document.getElementById("companyDescription").textContent=company.description||"Esta empresa aún no ha agregado una descripción pública.";
 document.getElementById("companyWebsite").innerHTML=company.website?'<a href="'+esc(company.website)+'" target="_blank" rel="noopener noreferrer">Sitio web de la empresa ↗</a>':"";
 const r=await db.from("company_reviews").select("id,rating,comment,created_at").eq("company_id",companyId).order("created_at",{ascending:false});
 const reviews=r.data||[],avg=reviews.length?reviews.reduce((n,x)=>n+x.rating,0)/reviews.length:0;
 document.getElementById("companyRating").textContent=reviews.length?"★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg))+" "+avg.toFixed(1)+"/5 · "+reviews.length+" opinión(es)":"Aún sin calificaciones";
 document.getElementById("reviewSummary").textContent=reviews.length?"Promedio basado en opiniones de candidatos que han postulado a esta empresa.":"Sé el primero en compartir tu experiencia.";
 document.getElementById("reviewsList").innerHTML=reviews.length?reviews.map(x=>'<article class="candidate-row"><div><b>'+("★".repeat(x.rating))+'</b><p>'+esc(x.comment)+'</p><small>'+new Date(x.created_at).toLocaleDateString("es-CO")+'</small></div></article>').join(""):'<p class="muted">Todavía no hay comentarios.</p>';
 const s=await db.auth.getSession();user=s.data.session?.user||null;
 if(user){const pr=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();if(pr.data?.role==="candidate"){const eligible=await db.from("applications").select("id,jobs!inner(employer_id)").eq("candidate_id",user.id).eq("jobs.employer_id",companyId).limit(1);if(eligible.data?.length)document.getElementById("reviewPanel").hidden=false;}}
}
document.getElementById("reviewForm").addEventListener("submit",async e=>{e.preventDefault();if(!user){document.getElementById("reviewMessage").textContent="Inicia sesión como candidato para opinar.";return}
 const payload={company_id:companyId,candidate_id:user.id,rating:Number(document.getElementById("rating").value),comment:document.getElementById("reviewComment").value.trim(),updated_at:new Date().toISOString()};
 const saved=await db.from("company_reviews").upsert(payload,{onConflict:"company_id,candidate_id"});
 document.getElementById("reviewMessage").textContent=saved.error?"No se pudo publicar: "+saved.error.message:"Tu opinión quedó publicada.";
 if(!saved.error){document.getElementById("reviewForm").reset();await init();}
});
init();