# Checklist de prueba

1. Landing abre y el CTA entra al configurador.
2. Se pueden seleccionar Hilux, Ranger y L200.
3. Cambiar vehículo reinicia la configuración previa con confirmación.
4. Agregar accesorio no elimina los anteriores.
5. El botón × elimina solo la pieza indicada.
6. Deshacer restaura la última acción.
7. Jaula Hilux aparece fija.
8. Faro/baliza/parrilla/caja permiten TransformControls según configuración.
9. Vinil permite definir ancho/alto y colocar sobre carrocería.
10. Reflectivo registra longitud aproximada en metros.
11. Interior permite cambiar cámara y acabado demo.
12. Empresa exige razón social y RUC; persona no.
13. Enviar crea un código `SOL-AAAA-XXXXX`.
14. El enlace público abre el mismo snapshot en 3D y no permite edición.
15. Comercial puede iniciar sesión, ver la solicitud, cambiar estado y guardar notas.
16. Con la escena quieta el visor no redibuja (sin consumo de GPU); girar, hacer zoom o mover una pieza sí redibuja.
17. Girar la cámara o arrastrar el gizmo no deselecciona la pieza; un clic en el fondo sí la suelta.
18. Al arrastrar una pieza ajustable no sale de su zona permitida y la escala es uniforme (0,5× a 2×).
19. El color de la unidad cambia la carrocería y aparece en el resumen, en el enlace público y en Comercial.
20. Las vistas F / LI / LD / P / 3D encuadran el vehículo completo con transición suave.
21. El botón de cámara descarga un PNG sin gizmos ni resaltados.
22. Cambiar rápido entre vehículos no deja piezas ni modelos duplicados.
23. Si un modelo no carga, aparece el aviso con botón Reintentar.

## Flujo comercial completo (`npm run build && npm start`)

24. `http://localhost:3000/` abre la web KASAC; el botón *Configurador 3D* abre el configurador dentro de la web.
25. El cliente arma su unidad, envía la solicitud y en ninguna pantalla ve precios.
26. El enlace que recibe el cliente abre su configuración en 3D dentro de la web, en solo lectura.
27. `http://localhost:3000/comercial` pide login; con sesión se ve la bandeja con la nueva solicitud.
28. En *Cotización* aparecen las líneas prellenadas por sección; al ingresar precios se recalculan subtotales, IGV y total.
29. Al guardar se asigna `COT-AAAA-NNNNN`, la solicitud pasa a *Cotizada* y se toman 6 fotos del modelo.
30. *Descargar PDF* genera la cotización formal con anexo de fotos; *Descargar Excel* abre con el formato de Grupo KA y fórmulas.
31. *Aprobar cotización* bloquea la edición y muestra el resumen con fotos; *Reabrir* vuelve a *Cotizada*.

