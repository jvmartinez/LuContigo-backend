# MediCita: instrucciones de Copilot

Lee y aplica [AGENTS.md](../AGENTS.md), fuente unica de las reglas del proyecto,
el mapa tecnologico y el flujo de agentes.

Si la peticion incluye la palabra independiente `equipo` (sin distinguir
mayusculas y fuera de codigo o citas), la primera delegacion debe ser a
**Prompt Senior**, definido en [prompt-senior.agent.md](agents/prompt-senior.agent.md).
Espera su prompt operativo antes de implementar o invocar especialistas.
Si falta la tarea, pregunta al usuario. Si el entorno no permite invocar ese agente,
explica la limitacion y sigue su definicion directamente; no simules una invocacion.

Los agentes estan en [agents](agents) y las skills en [skills](skills).
Estas instrucciones no son un listener de teclado ni un disparador del servidor:
solo se aplican cuando el cliente carga las personalizaciones del repositorio.
