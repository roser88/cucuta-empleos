const db=window.supabase.createClient("https://azlfifojrhzvezcsyogg.supabase.co","sb_publishable_ZzYqXmSxef6YTilUe5Pk0w_2ODNM8eq");

const form=document.getElementById("jobForm");
const msg=document.getElementById("msg");
const submit=form.querySelector('button[type="submit"]');

function showMessage(text,kind="info"){
  msg.textContent=text;
  msg.dataset.kind=kind;
  msg.setAttribute("role","status");
  msg.style.color=kind==="error"?"#b42332":kind==="success"?"#087a55":"#52657b";
}

async function publishVacancy(event){
  event.preventDefault();
  submit.disabled=true;
  submit.textContent="Publicando...";
  showMessage("Estamos validando la información de tu empresa.");

  try{
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError) throw authError;
    if(!user){
      showMessage("Tu sesión no está activa. Inicia sesión para publicar.", "error");
      setTimeout(()=>location.href="index.html",1200);
      return;
    }

    const {data:profile,error:profileError}=await db
      .from("profiles")
      .select("role,company_name,data_consent_at")
      .eq("id",user.id)
      .single();

    if(profileError) throw profileError;
    if(!profile?.data_consent_at){
      showMessage("Antes de publicar debes aceptar la política de tratamiento de datos desde tu cuenta.", "error");
      return;
    }
    if(!profile||!["employer","admin"].includes(profile.role)){
      showMessage("Esta cuenta no tiene permisos de empresa. Regístrate o solicita que tu cuenta sea habilitada como empresa.", "error");
      return;
    }

    const values=Object.fromEntries(new FormData(form).entries());
    const vacancy={
      title:values.title.trim(),
      company_name:(values.company_name||profile.company_name||"").trim(),
      city:values.city.trim(),
      area:values.area.trim(),
      contract_type:values.contract_type.trim()||null,
      work_mode:values.work_mode.trim()||null,
      description:values.description.trim(),
      salary:values.salary.trim()||null,
      contact_email:values.contact_email.trim()||null,
      employer_id:user.id,
      status:"published"
    };

    if(!vacancy.company_name){
      showMessage("Escribe el nombre de la empresa para continuar.", "error");
      return;
    }

    const {error:insertError}=await db.from("jobs").insert(vacancy);
    if(insertError){
      if(insertError.code==="42501"||insertError.code==="PGRST301"){
        throw new Error("Supabase rechazó la publicación por permisos. Verifica que tu perfil tenga rol Empresa o Administrador y que la sesión siga activa.");
      }
      if(insertError.code==="23503") throw new Error("No encontramos el perfil de esta cuenta. Cierra sesión, vuelve a ingresar e inténtalo otra vez.");
      throw insertError;
    }

    showMessage("¡Vacante publicada correctamente! Ya está disponible en el listado de empleos.", "success");
    form.reset();
    form.elements.city.value="Cúcuta";
    form.elements.work_mode.value="Presencial";
    setTimeout(()=>location.href="dashboard.html",1400);
  }catch(error){
    console.error("Error al publicar vacante:",error);
    showMessage(error?.message||"No fue posible publicar la vacante. Revisa tu conexión e inténtalo de nuevo.", "error");
  }finally{
    submit.disabled=false;
    submit.textContent="Publicar vacante";
  }
}

form.addEventListener("submit",publishVacancy);
