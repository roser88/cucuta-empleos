# Cúcuta Empleos — Proyecto de Grado UNAD, Fase 3

**Creadores**
- Juan Luis Vásquez Mújica
- Gabriel Andrés Roser Cortés

**Universidad:** UNAD — Universidad Nacional Abierta y a Distancia  
**Proyecto de Grado:** 202016907A_2204

## Funciones incluidas en la versión actual
- Interfaz adaptable a computador, tableta y celular.
- Búsqueda de vacantes por palabra clave, ciudad y área.
- Vista de detalles de cada vacante.
- Registro e inicio de sesión de candidatos y empresas con Supabase Auth.
- Perfil profesional editable del candidato: contacto, ciudad, profesión, resumen, habilidades, formación, experiencia y LinkedIn.
- Carga de hoja de vida PDF, DOC o DOCX de máximo 10 MB en almacenamiento privado.
- Postulación a una vacante con mensaje de presentación opcional.
- Panel del candidato para consultar postulaciones y la fecha de visualización de su hoja de vida.
- Panel de empresa para consultar perfiles y hojas de vida de personas postuladas.
- Gestión de vacantes propias: publicar, pausar o cerrar.
- Seguimiento de candidaturas: recibida, en revisión, entrevista, puede ser contactado, hoja de vida conservada, contratado o no seleccionado.
- Vacantes con nombre de empresa confidencial.
- Notificaciones internas cuando una persona se postula y cuando cambia el estado de una candidatura.
- Recuperación de contraseña por correo (requiere configurar redirecciones y correo en Supabase).
- Base de datos relacional con políticas RLS y permisos de almacenamiento privado.

## Importante: activar la base de datos
El sitio no queda conectado a una base de datos hasta crear y configurar tu proyecto Supabase.

1. Entra a https://supabase.com y crea un proyecto.
2. Abre **SQL Editor → New query**.
3. Copia y ejecuta todo el contenido de `supabase/schema.sql`.
4. Ve a **Project Settings → API**.
5. Copia el **Project URL** y la clave **anon / publishable**.
6. Abre `app.js` y reemplaza:
   - `PEGA_AQUI_TU_SUPABASE_PROJECT_URL`
   - `PEGA_AQUI_TU_SUPABASE_ANON_PUBLIC_KEY`
7. Guarda los cambios y vuelve a subir los archivos a GitHub.

No uses ni publiques la clave `service_role`. La clave anon/publishable está diseñada para el navegador y queda protegida por las políticas RLS del esquema.

## Configuración recomendada de Auth
En Supabase → Authentication → URL Configuration:
- Site URL: la URL final publicada (por ejemplo, GitHub Pages o Vercel).
- Redirect URLs: agrega también la URL local de pruebas si la usas.
- Para producción, activa confirmación de correo y configura SMTP para que los mensajes lleguen correctamente.

## Publicar gratis en GitHub Pages
1. Crea un repositorio público llamado `cucuta-empleos`.
2. Sube `index.html`, `styles.css`, `app.js`, `README.md` y la carpeta `supabase`.
3. En Settings → Pages, elige Deploy from a branch, `main`, carpeta `/ (root)`.
4. Espera el enlace de GitHub Pages.
5. Registra ese enlace en Supabase Auth → URL Configuration.

También puedes desplegar el repositorio con Vercel o Netlify.

## Antes de recibir datos reales
Esta es una base funcional inicial para un proyecto académico, no una plataforma auditada para producción. Antes de abrir registros públicos:
- Completa una política de tratamiento de datos personales conforme a la Ley 1581 de 2012 (Colombia) y solicita autorización informada.
- Configura privacidad de perfiles y archivos de hojas de vida.
- Crea un bucket privado de Supabase Storage y políticas para que cada candidato administre su propio CV y solo las empresas autorizadas puedan consultarlo durante una postulación.
- Implementa verificación de empresas, moderación de vacantes, recuperación de contraseña, protección anti-spam, CAPTCHA y correo transaccional.
- Revisa permisos, RLS y pruebas de seguridad con usuarios de prueba.

## Limitaciones conocidas de esta entrega
- Incluye perfil profesional editable y carga privada de hojas de vida PDF/DOC/DOCX (máximo 10 MB), con acceso limitado al candidato y a empresas que recibieron su postulación.
- Registra la fecha en que una empresa abre la hoja de vida y permite mostrarla al candidato.
- Incluye etapas adicionales de selección: puede ser contactado y hoja de vida conservada para futuras oportunidades.
- Permite publicar vacantes con identidad de empresa confidencial.
- No incluye chat interno entre candidato y empresa ni envío de notificaciones por WhatsApp/SMS.
- Las notificaciones actuales son internas dentro del panel; no son correos automáticos.
- No incluye todavía verificación documental automática de empresas ni un panel administrativo de moderación.
- El flujo de contratación se representa mediante el estado de la postulación que actualiza la empresa; la contratación legal se realiza por fuera de la plataforma.
- Los formularios y la autenticación requieren configurar Supabase para operar.
