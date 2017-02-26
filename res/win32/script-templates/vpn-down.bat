@echo off

echo Disconnecting...
rasdial /disconnect

echo Removing routes...
node "{{cliPath}}" route delete "{{routesFile}}" 1>nul

echo Done.

goto :eof

:error
exit /b %errorlevel%
