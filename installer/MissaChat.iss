; Inno Setup Skript – erzeugt MissaChat-Setup.exe
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{7C3A8E52-4B1D-4F6A-9E0B-6D2C5A1F9B37}
AppName=Missa Chat
AppVersion={#AppVersion}
AppPublisher=Missa Chat
DefaultDirName={autopf}\Missa Chat
DefaultGroupName=Missa Chat
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=MissaChat-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\MissaChat.exe

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\MissaChat.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Missa Chat"; Filename: "{app}\MissaChat.exe"
Name: "{group}\Missa Chat deinstallieren"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Missa Chat"; Filename: "{app}\MissaChat.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\MissaChat.exe"; Description: "{cm:LaunchProgram,Missa Chat}"; Flags: nowait postinstall skipifsilent
