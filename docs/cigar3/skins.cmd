@echo off
setlocal EnableDelayedExpansion

REM --- Count the total number of PNG files in the skins folder ---
set "total=0"
for %%a in (skins\*.png) do (
    set /a total+=1
)
echo Total skins found: %total%

REM --- Compute the index of the last entry (0-indexed) ---
set /a last=total-1

REM --- Specify the output JSON file ---
set "outfile=skins.json"

REM --- Write the opening brace of the JSON file ---
(
    echo {
) > "%outfile%"

set /a count=0

REM --- Iterate over each PNG file in the skins folder ---
for %%a in (skins\*.png) do (
    REM Get the file name (without extension) as the token and create a label.
    set "token=%%~na"
    set "label=%%~na"
    set "label=!label:_= !"

    REM Write the JSON object header with proper indentation.
    >> "%outfile%" echo(    "!count!": {
    >> "%outfile%" echo(        "src": "./skins/%%~na.png",
    >> "%outfile%" echo(        "label": "!label!"

    REM Append the closing brace with a trailing comma if this is not the last entry.
    if !count! lss !last! (
         >> "%outfile%" echo(    },
    ) else (
         >> "%outfile%" echo(    }
    )

    set /a count+=1
)

REM --- Write the final closing brace without an extra newline ---
<nul set /p ="}" >> "%outfile%"

echo skins.json has been generated.