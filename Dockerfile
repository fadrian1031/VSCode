# Imagen única: web KASAC + configurador 3D + Área Comercial + API (puerto 3000).
# Construir desde la raíz del repositorio:  docker build -t kasac .
# Ejecutar:  docker run -p 3000:3000 --env-file KASAC_Pickup_Configurator_Angular_Node/backend/.env -v kasac-datos:/data kasac
FROM node:22-alpine AS build
WORKDIR /app
COPY KASAC_Pickup_Configurator_Angular_Node/package.json KASAC_Pickup_Configurator_Angular_Node/package-lock.json KASAC_Pickup_Configurator_Angular_Node/
COPY KASAC_Pickup_Configurator_Angular_Node/frontend/package.json KASAC_Pickup_Configurator_Angular_Node/frontend/
COPY KASAC_Pickup_Configurator_Angular_Node/backend/package.json KASAC_Pickup_Configurator_Angular_Node/backend/
RUN cd KASAC_Pickup_Configurator_Angular_Node && npm ci --include=dev
COPY . .
RUN cd KASAC_Pickup_Configurator_Angular_Node && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/requests.json
COPY --from=build /app/kasac-web-con-configurador/kasac-web ./kasac-web-con-configurador/kasac-web
COPY --from=build /app/KASAC_Pickup_Configurator_Angular_Node/package.json ./KASAC_Pickup_Configurator_Angular_Node/
COPY --from=build /app/KASAC_Pickup_Configurator_Angular_Node/node_modules ./KASAC_Pickup_Configurator_Angular_Node/node_modules
COPY --from=build /app/KASAC_Pickup_Configurator_Angular_Node/backend ./KASAC_Pickup_Configurator_Angular_Node/backend
COPY --from=build /app/KASAC_Pickup_Configurator_Angular_Node/frontend/dist ./KASAC_Pickup_Configurator_Angular_Node/frontend/dist
EXPOSE 3000
VOLUME /data
CMD ["node","KASAC_Pickup_Configurator_Angular_Node/backend/src/server.js"]
