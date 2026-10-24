@echo off
rem Opens Inventory Analyzer in its own Microsoft Edge app window.
rem Nothing is installed and nothing is uploaded; the app runs entirely in the browser.
setlocal
set "APP=%~dp0Inventory Analyzer.html"
if not exist "%APP%" (
  echo Could not find "%APP%".
  echo Keep this launcher in the same folder as "Inventory Analyzer.html".
  pause
  exit /b 1
)
set "URL=file:///%APP:\=/%"
start "" msedge --app="%URL%" 2>nul
if errorlevel 1 start "" "%APP%"
endlocal
