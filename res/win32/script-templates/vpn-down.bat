@echo off

echo Disconnecting...
rasdial /disconnect

echo Done.

goto :eof

:error
exit /b %errorlevel%
