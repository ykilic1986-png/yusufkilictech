(* TURKO Uçan Testere - CODESYS SoftMotion uyarlama taslağı
   Browser runtime bu ST metnini derlemez. Axis ve MC_CAM_REF hedefte tanımlanmalıdır.
   MasterPosition ve SyncZone aynı kam koordinat sisteminde değerlendirilir. *)
PROGRAM PLC_PRG
VAR
    fbPower : MC_Power;
    fbSelect : MC_CamTableSelect;
    fbCam : MC_CamIn;
    StartCam, LoadCam, ServoEnable : BOOL;
    SyncZone, ClampOK, CutStep, Q_TestereIn : BOOL;
    MasterPosition, CamPhase : LREAL;
END_VAR

fbPower(Axis := X_Servo, Enable := ServoEnable,
    bRegulatorOn := TRUE, bDriveStart := TRUE);
fbSelect(Master := E1_Encoder, Slave := X_Servo, CamTable := CAM_SAW,
    Execute := LoadCam, Periodic := TRUE,
    MasterAbsolute := TRUE, SlaveAbsolute := TRUE);
fbCam(Master := E1_Encoder, Slave := X_Servo,
    Execute := StartCam AND fbPower.Status AND fbSelect.Done,
    CamTableID := fbSelect.CamTableID, StartMode := MC_StartMode.absolute,
    MasterScaling := 1.0, SlaveScaling := 1.0);

(* MasterPosition fiziksel enkoderin mm cinsinden konum girişidir. *)
CamPhase := MasterPosition - DINT_TO_LREAL(TRUNC(MasterPosition / 1000.000000)) * 1000.000000;
SyncZone := (CamPhase >= 100) AND (CamPhase < 500);
CutStep := (CamPhase >= 200) AND (CamPhase < 360);
Q_TestereIn := fbCam.InSync AND SyncZone AND ClampOK AND CutStep;
(* Geri dönüş: master 550..800 mm aralığında kam Y'si 475..0 mm'dir.
   Bu çevrimde MC_MoveAbsolute kullanılmaz. Hedefte pnömatik I/O,
   limitler, home, güvenlik ve kam verisi ayrıca yapılandırılmalıdır. *)
