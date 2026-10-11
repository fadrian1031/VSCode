# Proyecto KA SAC

Web de KASAC con configurador 3D integrado y Área Comercial para cotizar y aprobar, en un solo servidor.

- `KASAC_Pickup_Configurator_Angular_Node/`: configurador 3D (Angular + Three.js), Área Comercial y API (Node.js + Express).
- `kasac-web-con-configurador/`: web corporativa (HTML/CSS), que el servidor publica en `/` con el configurador embebido.

## Iniciar en Windows

1. Instale **Node.js 22 LTS** desde https://nodejs.org.
2. Extraiga todo el proyecto a una carpeta corta, por ejemplo `C:\Proyectos`.
3. Doble clic en **`INICIAR_KASAC.bat`**.

| Dirección | Qué es |
|---|---|
| http://localhost:3000 | Web KASAC con el configurador 3D (lo que ve el cliente) |
| http://localhost:3000/comercial | Área Comercial (login: `comercial@kasac.pe` / `Kasac2026!`, solo en modo local) |

Si algo falla, revise `KASAC_Pickup_Configurator_Angular_Node/docs/SOLUCION_PROBLEMAS.md`.
Documentación completa: `KASAC_Pickup_Configurator_Angular_Node/README.md`.
