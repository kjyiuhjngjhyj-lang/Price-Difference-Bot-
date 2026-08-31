@echo off
title Solana Helius Bot Service
:loop
echo [%DATE% %TIME%] Starting Solana Helius Bot...
node index.js
echo [%DATE% %TIME%] Bot stopped. Restarting in 5 seconds...
timeout /t 5 >nul
goto loop
