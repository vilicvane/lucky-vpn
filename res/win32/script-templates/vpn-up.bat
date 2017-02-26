@echo off

echo Connecting {{entry}}...
rasdial "{{entry}}"{{#if username}} "{{username}}"{{#if password}} "{{password}}"{{/if}}{{/if}}{{#if phonebook}} /phonebook:"{{phonebook}}"{{/if}} || goto :error

echo Flushing DNS...
ipconfig /flushdns 1>nul

{{#if dnsServers}}
echo Overriding DNS servers...
netsh interface ipv4 delete dnsservers "{{entry}}" all
{{#each dnsServers}}
netsh interface ipv4 add dnsservers "{{../entry}}" {{this}} validate=no
{{/each}}
{{/if}}

echo Querying gateway...
for /F "tokens=3" %%* in ('route print ^| findstr "\<0.0.0.0\>"') do (
  set "gw=%%*"
  goto :gatewaySet
)

echo No gateway found.
exit /b 1

:gatewaySet

echo Adding routes...
{{#each routes}}
route add {{network}} mask {{mask}} %gw% metric {{../routeMetric}} 1>nul 2>nul
{{#route-progress @index}}
echo {{@index}}/{{../routes.length}}...
{{/route-progress}}
{{/each}}
echo Done.

goto :eof

:error
exit /b %errorlevel%
