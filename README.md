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

## Tecnologías

- HTML, CSS y JavaScript para la interfaz.
- Supabase Auth para registro e inicio de sesión.
- Supabase Database (PostgreSQL) para perfiles, vacantes, postulaciones y notificaciones.
- Supabase Storage para hojas de vida privadas.
- GitHub para el control de versiones y GitHub Pages como opción de publicación estática.

## Funcionalidades implementadas

### Experiencia pública
- Interfaz adaptable a computadores, tabletas y celulares.
- Consulta y búsqueda de vacantes por palabra clave, ciudad y área.
- Visualización de los detalles de cada vacante.
- Vacantes que pueden mostrar la empresa como confidencial.

### Cuentas y perfiles
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

El esquema y las políticas SQL se encuentran en `supabase/schema.sql`.

**Claves y secretos:** nunca publiques la clave `service_role` ni secretos de proveedores en el código del navegador o en el repositorio. La aplicación web debe utilizar únicamente la clave pública/anon o publishable de Supabase, protegida por RLS.

## Notificaciones por correo: siguiente mejora

Las notificaciones descritas arriba son actualmente notificaciones internas del portal. **El envío de correos transaccionales automáticos todavía no está implementado.**

La mejora propuesta contempla correos como:
- Avisar al candidato cuando una empresa consulte su hoja de vida.
- Avisar al candidato cuando cambie el estado de su postulación o sea convocado a entrevista.
- Avisar a la empresa cuando reciba una nueva postulación.

La arquitectura prevista es Supabase Edge Functions más un proveedor de correo transaccional (por ejemplo, Resend). Requiere configurar y verificar un dominio o remitente, guardar la API key del proveedor como secreto del servidor y probar las plantillas y eventos. No se deben enviar correos directamente desde el navegador ni exponer claves privadas.

## Configuración y publicación

El proyecto está conectado al proyecto Supabase configurado para esta aplicación. Para revisar o cambiar la configuración:
1. En Supabase, verifica Authentication, URL Configuration y las URL de redirección del sitio.
2. Comprueba que el esquema de `supabase/schema.sql` esté aplicado en la base de datos.
3. En GitHub, entra a **Settings → Pages** y confirma que GitHub Pages esté desplegando la rama `main` desde la carpeta `/ (root)`, si se desea publicar desde GitHub Pages.
4. Configura en Supabase la URL pública definitiva del sitio.

La publicación de GitHub Pages y el funcionamiento completo en producción deben verificarse desde el navegador una vez habilitado el despliegue.

## Pendientes antes de producción

- Implementar y probar el envío de correos transaccionales descrito en la sección anterior.
- Completar el flujo de recuperación de contraseña, incluyendo la pantalla para establecer una contraseña nueva.
- Incorporar verificación documental de empresas y moderación administrativa de vacantes.
- Evaluar chat interno entre candidatos y empresas.
- Añadir controles anti-spam/CAPTCHA y límites de solicitudes.
- Completar la política de tratamiento de datos personales y autorización informada conforme a la normativa colombiana aplicable, incluida la Ley 1581 de 2012.
- Realizar pruebas de extremo a extremo con cuentas separadas de candidato y empresa, incluyendo carga, consulta y permisos de CV.
- Ejecutar una revisión de seguridad y privacidad antes de aceptar datos personales reales.

## Estado y alcance

Este repositorio contiene una base funcional en desarrollo para el proyecto académico. La existencia de funciones y políticas en el código no sustituye las pruebas integrales ni una auditoría de seguridad. No se debe considerar listo para producción hasta completar los pendientes anteriores y verificar el despliegue, la configuración de Supabase y los flujos reales con usuarios de prueba.
