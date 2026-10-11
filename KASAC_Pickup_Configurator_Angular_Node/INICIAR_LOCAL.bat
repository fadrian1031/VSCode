@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title KASAC - Configurador 3D
echo ==================================================
echo    KASAC - Web, configurador 3D y Area Comercial
echo ==================================================

where node >nul 2>nul
if errorlevel 1 goto :sin_node

node scripts\diagnostico.js
if errorlevel 1 goto :fin

if exist node_modules\.bin\ng.cmd goto :iniciar
echo Instalando dependencias. Solo la primera vez; puede tardar de 3 a 10 minutos...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fallo_install

:iniciar
if exist frontend\dist\kasac-comercial\browser\index.html goto :arrancar
echo.
echo Preparando la web y el Area Comercial. Solo la primera vez; tarda cerca de un minuto...
call npm run build
if errorlevel 1 goto :fallo_build

:arrancar
echo.
echo ==================================================
echo   Web KASAC con configurador 3D:  http://localhost:3000
echo   Area Comercial - uso interno:   http://localhost:3000/comercial
echo ==================================================
echo El navegador se abrira solo. Para detener todo: cierre esta ventana o presione Ctrl+C.
echo Si modifica el codigo, ejecute "npm run build" antes de volver a iniciar.
echo.
start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"
call npm start
goto :fin

:fallo_build
echo.
echo [ERROR] No se pudo compilar el proyecto. Revise el primer mensaje en rojo de arriba.
echo   Mas ayuda: docs\SOLUCION_PROBLEMAS.md
goto :fin

:sin_node
echo.
echo [ERROR] No se encontro Node.js en esta ventana.
echo   1. Instala Node.js 22 LTS desde https://nodejs.org  - version LTS, instalador .msi
echo   2. Durante la instalacion deja marcada la opcion "Add to PATH".
echo   3. Cierra TODAS las ventanas de comandos y vuelve a hacer doble clic aqui.
echo   Si ya lo instalaste, reinicia la PC.
goto :fin

:fallo_install
echo.
echo [ERROR] npm install fallo. Revisa el primer mensaje en rojo de arriba.
echo   - EPERM / EBUSY: cierra VS Code y el antivirus bloquea archivos; mueve el proyecto a C:\Proyectos.
echo   - ENOTFOUND / ETIMEDOUT: sin Internet o la red bloquea registry.npmjs.org.
echo   - ENAMETOOLONG: la ruta es muy larga; mueve el proyecto a C:\Proyectos.
echo   Luego borra la carpeta node_modules y vuelve a hacer doble clic.
echo   Mas ayuda: docs\SOLUCION_PROBLEMAS.md

:fin
echo.
pause
