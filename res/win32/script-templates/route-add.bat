@echo off

echo Adding routes...
node "{{cliPath}}" route add "%~dp0routes.txt" -m {{routeMetric}}

echo Done.

goto :eof

:error
exit /b %errorlevel%
