@echo off
title GitHub'a Yukle - aztubasvuru
echo ========================================================
echo     AzTU Kamikaze IDA - GitHub'a Yukleme
echo ========================================================
echo.
echo Repo: https://github.com/Lopeinte/aztubasvuru.git
echo.
cd /d "C:\Users\eneso\.gemini\antigravity\scratch\kamikaze-ida-mulakat"
echo Kodlar GitHub'a gonderiliyor...
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [BASARILI] Kodlar GitHub'a yuklendi!
) else (
    echo [UYARI] Bir hata olustu. Eger tarayici acildiysa giris yapin.
)
echo.
pause
