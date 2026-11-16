Unicode true
!include "LogicLib.nsh"
Name "EdiTAL"
Icon "${ICON}"
OutFile "${OUTPUT}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
SetCompressor /SOLID lzma
Section
  SetOutPath "$EXEDIR"
  nsExec::Exec '"$EXEDIR\runtime\node.exe" "$EXEDIR\launcher.cjs" ${ACTION}'
  Pop $0
  ${If} $0 != 0
    ReadEnvStr $1 EDITAL_NO_BROWSER
    ${If} $1 != 1
      MessageBox MB_OK|MB_ICONEXCLAMATION "EDITAL non è stato avviato. Chiudi la vecchia finestra di avvio e riprova.$\r$\nDettagli: %LOCALAPPDATA%\EDITAL\data\avvio.log"
    ${EndIf}
    SetErrorLevel 1
  ${EndIf}
SectionEnd
