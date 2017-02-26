@echo off

echo Removing routes...
node "{{cliPath}}" route delete "{{routesFile}}" 1>nul

goto :eof

:error
exit /b %errorlevel%
