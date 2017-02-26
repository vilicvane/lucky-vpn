@echo off

echo Removing routes...
node "{{cliPath}}" route delete "{{routesFile}}"

goto :eof

:error
exit /b %errorlevel%
