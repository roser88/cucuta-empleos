const db=window.supabase.createClient("https://azlfifojrhzvezcsyogg.supabase.co","sb_publishable_ZzYqXmSxef6YTilUe5Pk0w_2ODNM8eq");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function load(){
 const el=document.getElementById("companies");
 const {data:companies,error}=await db.from("company_profiles").select("company_id,public_name,city,description,website").order("public_name");
 if(error){el.textContent="No se pudieron cargar las empresas.";return}
 const ids=(companies||[]).map(x=>x.company_id);
 let reviews=[];
 if(ids.length){const r=await db.from("company_reviews").select("company_id,rating").in("company_id",ids);reviews=r.data||[]}
 const stats=new Map();reviews.forEach(r=>{const x=stats.get(r.company_id)||{sum:0,count:0};x.sum+=r.rating;x.count++;stats.set(r.company_id,x)});
 el.innerHTML=companies?.length?companies.map(c=>{const s=stats.get(c.company_id)||{sum:0,count:0},avg=s.count?s.sum/s.count:0;return '<article class="application-card"><span class="eyebrow">EMPRESA REGISTRADA</span><h3>'+esc(c.public_name)+'</h3><p>'+esc(c.city||"Norte de Santander")+'</p><p class="company-rating">'+(s.count?'★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg))+' '+avg.toFixed(1)+'/5 · '+s.count+' opinión(es):':'Aún sin calificaciones')+'</p><p>'+esc(c.description||"Conoce el perfil y las opiniones de esta empresa.")+'</p><a class="primary-btn" href="empresa.html?id='+encodeURIComponent(c.company_id)+'">Ver empresa y opiniones</a></article>'}).join(""):'<div class="empty">Aún no hay empresas registradas.</div>';
}
load();