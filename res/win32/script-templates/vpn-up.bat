@echo off

{{#if dnsServers}}
REM assure administrative privileges.
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if errorlevel 1 (
  echo You need administrative privileges to run this batch file.
  exit /b 1
)
{{/if}}

echo Connecting {{entry}}...
rasdial "{{entry}}"{{#if username}} "{{username}}"{{#if password}} "{{password}}"{{/if}}{{/if}}{{#if phonebook}} /phonebook:"{{phonebook}}"{{/if}} || goto :error

{{#if dnsServers}}
echo Overriding DNS servers...
netsh interface ipv4 delete dnsservers "{{entry}}" all 1>nul
{{#each dnsServers}}
netsh interface ipv4 add dnsservers "{{../entry}}" {{this}} validate=no 1>nul
{{/each}}
{{/if}}

echo Flushing DNS...
ipconfig /flushdns 1>nul

echo Querying gateway...
for /F "tokens=3" %%* in ('route print ^| findstr "\<0.0.0.0\>"') do (
  set "gateway=%%*"
  goto :gatewaySet
)

echo No gateway found.
exit /b 1

:gatewaySet

echo Adding routes...
{{#each routes}}
route add {{network}} mask {{mask}} %gateway% metric {{../routeMetric}} 1>nul
{{#route-progress @index}}
echo {{@index}}/{{../routes.length}}...
{{/route-progress}}
{{/each}}
echo Done.

goto :eof

:error
exit /b %errorlevel%
