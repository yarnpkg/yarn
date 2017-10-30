@echo off

set PLINK_PATH="%~1"
set PARAMS=""

REM Shift params once at the beginning to exclude the first one
shift

REM Start of the loop
:params_loop
  if "%~1"=="" (
    REM If we went through all the params, go to the end of the loop
    goto after_params_loop
  )

  if "%~1"=="-p" (
    REM If the param is `-p`, append it to `PARAMS` as a `-P` required by `plink.exe`
    set PARAMS=%PARAMS% "-P"
  ) else (
    REM Else, just append the parameter to `PARAMS`
    set PARAMS=%PARAMS% %1
  )

  REM Shift the params again
  shift

  REM Start the loop again
  goto params_loop
REM End of the loop
:after_params_loop

REM Run given plink.exe with proper params
%PLINK_PATH% %PARAMS%
