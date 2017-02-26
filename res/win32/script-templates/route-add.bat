@echo off

echo Adding routes...
node "{{cliPath}}" route add "{{routesFile}}" -m {{routeMetric}}

echo Done.

goto :eof

:error
exit /b %errorlevel%
