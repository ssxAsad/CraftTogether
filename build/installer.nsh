!macro customInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\splash.bmp "${BUILD_RESOURCES_DIR}\splash.bmp"
  advsplash::show 2000 600 400 -1 "$PLUGINSDIR\splash"
  Pop $0
!macroend
