@echo off

echo Disconnecting...

rasdial /disconnect

echo Removing routes...

{{#each routes}}
route delete {{network}} 1>nul
{{#route-progress @index}}
echo {{@index}}/{{../routes.length}}...
{{/route-progress}}
{{/each}}

echo Done.

goto :eof

:error
exit /b %errorlevel%
