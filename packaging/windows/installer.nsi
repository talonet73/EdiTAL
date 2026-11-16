Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "EdiTAL"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\EDITAL"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
ShowInstDetails show
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\EDITAL.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Apri EDITAL"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Italian"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Serve Windows a 64 bit."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Serve Windows 10 o Windows 11."
    Abort
  ${EndIf}
FunctionEnd
Section "EDITAL" Main
  IfFileExists "$INSTDIR\CHIUDI-EDITAL.exe" 0 +2
    ExecWait '"$INSTDIR\CHIUDI-EDITAL.exe"'
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*"
  WriteUninstaller "$INSTDIR\Disinstalla.exe"
  CreateDirectory "$SMPROGRAMS\EDITAL"
  CreateShortcut "$DESKTOP\EDITAL.lnk" "$INSTDIR\EDITAL.exe" "" "$INSTDIR\edital.ico" 0
  CreateShortcut "$SMPROGRAMS\EDITAL\EDITAL.lnk" "$INSTDIR\EDITAL.exe" "" "$INSTDIR\edital.ico" 0
  CreateShortcut "$SMPROGRAMS\EDITAL\Chiudi EDITAL.lnk" "$INSTDIR\CHIUDI-EDITAL.exe"
  CreateShortcut "$SMPROGRAMS\EDITAL\File e progetti.lnk" "$WINDIR\explorer.exe" '"$LOCALAPPDATA\EDITAL\data"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "DisplayName" "EdiTAL"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "DisplayIcon" "$INSTDIR\edital.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "UninstallString" '$\"$INSTDIR\Disinstalla.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL" "NoRepair" 1
SectionEnd
Section "Uninstall"
  ExecWait '"$INSTDIR\CHIUDI-EDITAL.exe"'
  Delete "$DESKTOP\EDITAL.lnk"
  RMDir /r "$SMPROGRAMS\EDITAL"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EDITAL"
  ; Media and user projects live outside INSTDIR and are deliberately preserved.
  RMDir /r "$INSTDIR"
SectionEnd
