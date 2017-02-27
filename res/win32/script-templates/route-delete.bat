@echo off

echo Removing routes...
node "{{cliPath}}" route delete "%~dp0routes.txt"

goto :eof

:error
exit /b %errorlevel%
