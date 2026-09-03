# Gym Buddy AI

Prompt para Lovable — App personal de rutinas de gimnasio + Agente IA

Actúa como un desarrollador full-stack senior. Quiero que construyas una aplicación web personal (uso individual, no multiusuario público) para registrar y consultar mis rutinas de gimnasio, con un agente de IA integrado para dudas rápidas. Priorizá simplicidad, velocidad de uso desde el celular, y que los datos queden centralizados y fáciles de editar.

1. Stack y arquitectura

Usá Supabase como backend (autenticación simple de un solo usuario, base de datos Postgres, y Edge Functions para todo lo que hable con la API externa).

Nunca expongas la API key de NVIDIA NIM en el frontend. Guardala como secret de Supabase y llamala solo desde una Edge Function que actúe como proxy hacia el agente de IA.

La Edge Function debe llamar al endpoint compatible con OpenAI de NVIDIA NIM: https://integrate.api.nvidia.com/v1/chat/completions, con el modelo configurable (ej. openai/gpt-oss-20b u otro que yo elija desde un campo de configuración en la app), header Authorization: Bearer <API_KEY>.

Login básico (email/password de un solo usuario) para que la app no quede pública.

2. Perfil personalizable

Pantalla de "Mi perfil" con:

Peso actual, altura, edad, objetivo (ej. hipertrofia, fuerza, pérdida de grasa), nivel de experiencia, notas libres (lesiones, restricciones).

Historial de peso corporal (para ver evolución en el tiempo, no solo el dato actual).

Estos datos deben usarse como contexto que se le pasa al agente de IA en cada consulta, para que sus respuestas sean personalizadas.

3. Modelo de datos de rutinas

Necesito que el modelo de datos refleje exactamente cómo yo registro mis entrenamientos en texto (te paso mi formato real abajo). Cada sesión de entreno tiene:

Número de día y fecha.

Lista de ejercicios, cada uno con:

Nombre del ejercicio y grupo muscular.

Serie(s) programadas: formato "series x repeticiones - peso" (ej. 4 x 10 - 41kg).

Repeticiones reales logradas por serie (ej. 12, 11, 9, 8), porque a veces bajan set a set.

Notas libres por ejercicio: ajustes de técnica ("bajé a 32kg para mejorar técnica"), pausas ("pausa al primer fallo"), motivo de no haberlo hecho ("no hice por tiempo"), aproximaciones/calentamiento previo.

Un campo de estado/acción sugerida: subir peso, bajar peso, mantener, cambiar de ejercicio, revisar técnica — para que quede taggeado y sea filtrable.

Ejemplo real de cómo escribo mis rutinas en WhatsApp (usalo como referencia del formato a soportar):

Día 1, lunes 26/08/2026
-- aproximación:
1: 10 con 27 kg.
2: 8 con 36 kg.
3: 4 con 41.
4: 1 con 45.

Jalón al pecho 4 x 8 - 50 kg
12, 11, 9, 8

low row agarre ancho
4 x 10 - 41kg
-- baje a 32 x 12 para mejorar técnica

Remo unilateral 3 x 10 -18 kg

Polea baja, 2 x 10 - 41 kg
Hoy No hice por tiempo

--BICEPS--
Curl barra w 3 x 10 - 20 kg
12, 10, 5
Hoy No hice por tiempo

Martillo 3 x 8/12 - 8 kg
-- pausa al primer fallo


4. Funcionalidades principales

Registro rápido: formulario simple para crear una nueva sesión con sus ejercicios (pensado para completar desde el celular en el gimnasio).

Importador inteligente (recomendado): un campo de "pegar texto" donde pueda copiar mi rutina tal cual la escribo en WhatsApp, y que el agente de IA (vía la misma API de NVIDIA NIM) la interprete y la convierta automáticamente en los campos estructurados de arriba. Esto me ahorra reescribir todo a mano.

Historial / línea de tiempo: ver todas las sesiones pasadas ordenadas por fecha, agrupadas por día.

Vista por ejercicio: elegir un ejercicio (ej. "Jalón al pecho") y ver un gráfico de evolución de peso/repeticiones a lo largo del tiempo, más el historial de notas de técnica.

Edición: poder editar o borrar cualquier sesión o ejercicio pasado.

Etiquetas/acciones: marcar rápidamente "subir peso próxima vez", "bajar peso", "cambiar ejercicio", "revisar técnica" en cada ejercicio, y poder filtrar el historial por esas etiquetas.

5. Agente de IA (chat)

Botón flotante de chat accesible desde cualquier pantalla.

El agente debe recibir como contexto (via system prompt en la Edge Function): mi perfil, mis últimas sesiones, y los ejercicios marcados con alguna acción pendiente.

Debe poder responder dudas rápidas de gimnasio (técnica, progresión de cargas, sustitución de ejercicios, dolores/molestias comunes) y también dudas sobre mis propias rutinas ("¿qué peso usé la última vez en jalón al pecho?", "¿qué ejercicios tengo pendientes de revisar técnica?").

Campo de configuración donde pueda cambiar el modelo de NVIDIA NIM a usar sin tocar código.

6. UI/UX

Diseño limpio, mobile-first, oscuro por defecto (uso típico en el gimnasio).

Dashboard inicial con: resumen del último entreno, accesos rápidos a "nueva sesión", "importar de WhatsApp" y "chat con el agente".

Todo pensado para completarse rápido con el celular en la mano, sin fricción.

Notas finales

Es una app de uso personal: no hace falta sistema de roles ni multiusuario, pero sí login para que no sea pública.

Priorizá que el modelo de datos sea fiel a mi formato real de registro (arriba), ya que voy a migrar años de historial escrito en WhatsApp.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lift-and-learn-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/889f2666-97c4-4575-98df-fb72586f46bb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
