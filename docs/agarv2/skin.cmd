REM --- Count the total number of PNG files in the skins folder ---
set "total=0"
for %%a in (skins\*.png) do (
    set /a total+=1
)
echo Total skins found: %total%

for %%a in (skins\*.png) do @echo|set /p="%%~na,">>skinList.txt