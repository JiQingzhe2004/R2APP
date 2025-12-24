!macro customInit
    ; 使用 customInit 而不是 preInit，防止冲突
    System::Call 'user32::SetProcessDPIAware'
!macroend
