# Cúcuta Empleos

Portal web de intermediación laboral para publicar vacantes, crear perfiles profesionales y gestionar postulaciones.

## Información del proyecto

- **Proyecto académico:** Proyecto de Grado – UNAD, Fase 3
- **Código:** 202016907A_2204
- **Universidad:** Universidad Nacional Abierta y a Distancia (UNAD)
- **Creadores:**
  - Juan Luis Vásquez Mújica
  - Gabriel Andrés Roser Cortés
- **Repositorio:** https://github.com/roser88/cucuta-empleos

## Panel de administración

- Cuentas administrativas del proyecto:
  - Gabriel Andrés Roser Cortés (`gabrielroser@outlook.com`).
  - Juan Luis Vásquez Mújica (`jlvasquezmu@unadvirtual.edu.co`).
  Ambas cuentas están registradas con el rol `admin` en Supabase. El acceso requiere la contraseña personal de cada titular o el restablecimiento mediante el flujo de recuperación por correo. No existe una contraseña predeterminada ni se almacenan claves en el repositorio.
- Panel de control para publicar/desactivar banners y logos, gestionar anuncios de portada, revisar reportes, moderar vacantes y eliminar opiniones.
- Los administradores del proyecto son Gabriel Andrés Roser Cortés (`gabrielroser@outlook.com`) y Juan Luis Vásquez Mújica (`jlvasquezmu@unadvirtual.edu.co`), ambos con rol `admin` en Supabase. Para establecer o cambiar la contraseña se utiliza el flujo de recuperación por correo.
- Diagnóstico básico de conectividad y disponibilidad de tablas. La reparación de errores de código/infraestructura sigue requiriendo intervención técnica y despliegues controlados.
- Archivos visuales en bucket público `site-assets` con escritura restringida a administradores.

## Tecnologías

- HTML, CSS y JavaScript para la interfaz.
- Supabase Auth para registro e inicio de sesión.
- Supabase Database (PostgreSQL) para perfiles, vacantes, postulaciones y notificaciones.
- Supabase Storage para hojas de vida privadas.
- GitHub para el control de versiones y GitHub Pages como opción de publicación estática.

## Funcionalidades implementadas

### Experiencia pública
- Páginas institucionales independientes: Quiénes somos, Misión y Visión, enlazadas desde el menú principal.
- Página pública de empresas con perfiles, promedio de estrellas y comentarios de candidatos.
- Filtros de búsqueda y orden por fecha, más recientes o más antiguas.
- Interfaz adaptable a computadores, tabletas y celulares.
- Consulta y búsqueda de vacantes por palabra clave, ciudad y área.
- Visualización de los detalles de cada vacante.
- Vacantes que pueden mostrar la empresa como confidencial.

### Cuentas y perfiles
- Consentimiento expreso para tratamiento de datos en el registro y autorización específica antes de cada postulación, con fecha y versión registradas.
- Política de tratamiento de datos personales publicada en `politica-datos.html` (borrador pendiente de completar datos legales y canales del responsable).
- Registro e inicio de sesión para candidatos y empresas mediante Supabase Auth.
- Perfil profesional editable del candidato con nombre, teléfono, ciudad, título profesional, resumen, habilidades, formación, experiencia y enlace de LinkedIn.
- Solicitud de recuperación de contraseña por correo mediante Supabase Auth. El envío y la redirección dependen de la configuración de correo y URL en Supabase.

### Hojas de vida y postulaciones
- Carga de hojas de vida en PDF, DOC o DOCX, con límite de 10 MB.
- Almacenamiento privado de los archivos en Supabase Storage.
- Acceso al CV limitado al candidato propietario y a empresas autorizadas por una postulación.
- Postulación a vacantes con mensaje de presentación opcional.
- Panel del candidato para consultar sus postulaciones y la fecha en que una empresa visualizó su hoja de vida.

### Panel de empresas
- Perfiles públicos de empresa editables por cada empresa y reseñas con calificación de 1 a 5 estrellas, limitadas a candidatos con postulaciones a esa empresa.
- Consulta de las personas postuladas a las vacantes propias.
- Consulta de perfiles profesionales y hojas de vida de candidatos postulados.
- Visualización del mensaje de presentación.
- Administración de vacantes propias: publicar, pausar o cerrar.
- Actualización del estado de cada candidatura: recibida, en revisión, entrevista, puede ser contactado, hoja de vida conservada, contratado o no seleccionado.

### Notificaciones dentro del portal
- Notificación a la empresa cuando recibe una nueva postulación.
- Notificación al candidato cuando la empresa cambia el estado de su candidatura.
- Consulta de notificaciones desde el panel y opción para marcarlas como leídas.
- Registro de la fecha de visualización de la hoja de vida para mostrarla al candidato.

## Base de datos y seguridad

El proyecto utiliza Supabase con políticas de seguridad a nivel de fila (RLS) para controlar el acceso a perfiles, vacantes, postulaciones y notificaciones. También dispone de políticas para el almacenamiento privado de hojas de vida y controles para evitar cambios no autorizados de rol o de identidad de una postulación.

Las tablas principales son:
- `profiles`
- `jobs`
- `applications`
- `notifications`
- `company_profiles`
- `company_reviews`

El esquema y las políticas SQL se encuentran en `supabase/schema.sql`.

**Claves y secretos:** nunca publiques la clave `service_role` ni secretos de proveedores en el código del navegador o en el repositorio. La aplicación web debe utilizar únicamente la clave pública/anon o publishable de Supabase, protegida por RLS.

## Notificaciones por correo: siguiente mejora

Las notificaciones internas siguen disponibles. La integración de correo ya cuenta con una Edge Function desplegada y llamadas desde los eventos de consulta de HV, cambio de estado y nueva postulación. **El envío real queda pendiente de configurar los secretos `RESEND_API_KEY` y `EMAIL_FROM` en Supabase y verificar el dominio/remitente en Resend.**

La mejora propuesta contempla correos como:
- Avisar al candidato cuando una empresa consulte su hoja de vida.
- Avisar al candidato cuando cambie el estado de su postulación o sea convocado a entrevista.
- Avisar a la empresa cuando reciba una nueva postulación.

La arquitectura implementada usa Supabase Edge Functions y Resend. Configura `RESEND_API_KEY`, `EMAIL_FROM` y opcionalmente `APP_URL` como secretos de la función. Verifica el dominio o remitente en Resend antes de esperar entregas reales. No se envían correos directamente desde el navegador ni se exponen claves privadas.

## Configuración y publicación

El proyecto está conectado al proyecto Supabase configurado para esta aplicación. Para revisar o cambiar la configuración:
1. En Supabase, verifica Authentication, URL Configuration y las URL de redirección del sitio.
2. Comprueba que el esquema de `supabase/schema.sql` esté aplicado en la base de datos.
3. En GitHub, entra a **Settings → Pages** y confirma que GitHub Pages esté desplegando la rama `main` desde la carpeta `/ (root)`, si se desea publicar desde GitHub Pages.
4. Configura en Supabase la URL pública definitiva del sitio.

La publicación de GitHub Pages y el funcionamiento completo en producción deben verificarse desde el navegador una vez habilitado el despliegue.

## Pendientes antes de producción

- Configurar y probar Resend: verificar dominio/remitente y guardar `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL` como secretos de Edge Functions.
- Completar el flujo de recuperación de contraseña, incluyendo la pantalla para establecer una contraseña nueva.
- Incorporar verificación documental de empresas y moderación administrativa de vacantes.
- Evaluar chat interno entre candidatos y empresas.
- Añadir controles anti-spam/CAPTCHA y límites de solicitudes.
- Completar identificación legal, dirección y canales de atención del responsable de datos; validar y aprobar jurídicamente la política y los plazos de retención antes de operar públicamente.
- Realizar pruebas de extremo a extremo con cuentas separadas de candidato y empresa, incluyendo carga, consulta y permisos de CV.
- Ejecutar una revisión de seguridad y privacidad antes de aceptar datos personales reales.

## Estado y alcance

Este repositorio contiene una base funcional en desarrollo para el proyecto académico. La existencia de funciones y políticas en el código no sustituye las pruebas integrales ni una auditoría de seguridad. No se debe considerar listo para producción hasta completar los pendientes anteriores y verificar el despliegue, la configuración de Supabase y los flujos reales con usuarios de prueba.


## Registro de cambios – 15 de noviembre de 2026

- Se agregó el panel de administración para los dos integrantes del proyecto: Gabriel Andrés Roser Cortés (`gabrielroser@outlook.com`) y Juan Luis Vásquez Mújica (`jlvasquezmu@unadvirtual.edu.co`), ambos con rol `admin` en Supabase y control RLS en backend; se habilitó el flujo de restablecimiento de contraseña.
- Se habilitó gestión de banners/logos, anuncios, reportes de errores, moderación de vacantes y opiniones.
- Se agregaron tablas y políticas de administrador, bucket de recursos visuales y diagnóstico básico.
- Se completó la política con nombres y correos de contacto de los dos integrantes del proyecto; falta formalizar responsable legal y datos físicos no suministrados.

- Se corrigieron enlaces del logo del panel para regresar al sitio público y se añadió acceso directo a Buscar empleos.
- Se añadieron ordenamiento por fecha ascendente/descendente y filtro por ciudad en la página de vacantes.
- Se crearon páginas de Quiénes somos, Misión y Visión con enlaces en la navegación principal.
- Se publicó una política de tratamiento de datos y se añadió autorización no premarcada en registro y postulación, con versión y fecha persistidas en Supabase.
- Se añadieron perfiles públicos de empresas, calificaciones y comentarios de candidatos que hayan postulado.
- Se crearon tablas `company_profiles` y `company_reviews` con RLS y políticas de acceso.
- Se restringió la inserción de postulaciones para exigir consentimiento y se protegió la evidencia de autorización contra modificaciones posteriores; se mantuvo el almacenamiento privado de hojas de vida.
- Pendiente: completar datos de identificación/contacto del responsable legal, validar jurídicamente la política, configurar proveedor de correo, pruebas end-to-end y pruebas de penetración independientes.
