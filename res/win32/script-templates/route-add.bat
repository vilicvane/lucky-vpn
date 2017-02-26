@echo off

echo Querying gateway...
for /F "tokens=3" %%* in ('route print 0.0.0.0 ^| findstr "\<0.0.0.0\>"') do (
  set "gateway=%%*"
  goto :gatewaySet
)

echo No gateway found.
exit /b 1

:gatewaySet

echo Adding routes...
node "{{cliPath}}" route add "{{routesFile}}" %gateway% -m {{routeMetric}}

echo Done.

goto :eof

:error
exit /b %errorlevel%
