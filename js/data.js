/* ============================================================
   rag-copilot :: knowledge base
   Authored industrial fault corpus used as the RAG document
   store. Content is grounded in public manufacturer fault
   behaviour (Siemens, Schneider, Fanuc, Rockwell, generic PLC).
   Each record is one retrievable chunk.
   ============================================================ */

const EMBED_DIM = 384;          // local embedding model dimension
const LLM_TEMP = 0.20;          // generation temperature (configurable)

const CORPUS = [
  {
    id: "DOC-001", mfr: "Siemens", device: "SINAMICS G120", code: "F001",
    title: "Overcurrent", sev: "Critical", cat: "Electrical",
    symptoms: ["Drive trips immediately on start", "Fault F001 on BOP panel", "Motor does not rotate"],
    causes: ["Short circuit in motor or output cable", "Ground fault on motor windings", "Mechanical jam or seized bearing", "Incorrect motor data parameterization"],
    procedure: [
      "Apply LOTO on the main disconnect before any measurement.",
      "Confirm zero voltage on DC bus terminals UDC+ / UDC- with a calibrated multimeter.",
      "Megger the motor and cable insulation to ground (minimum 1 MΩ at 500 V DC).",
      "Inspect for shorted phases and damaged cable routing.",
      "Verify P1900 motor data and re-run static commissioning (commissioning wizard).",
      "Acknowledge the fault and restart with the load disconnected."
    ],
    tools: ["Multimeter", "Insulation tester 500 V DC", "Torque wrench"],
    manual: "SINAMICS G120 Operating Manual", page: 412
  },
  {
    id: "DOC-002", mfr: "Siemens", device: "SINAMICS G120", code: "F002",
    title: "Overvoltage", sev: "High", cat: "Electrical",
    symptoms: ["Fault F002 during deceleration", "DC link voltage exceeds limit", "Brake resistor alarm"],
    causes: ["Deceleration time too short", "Missing or undersized braking resistor", "Mains overvoltage"],
    procedure: [
      "Increase ramp-down time P1121 to reduce regenerated energy.",
      "Verify braking resistor is fitted and matches P0828 rating.",
      "Check line supply with a power quality meter for transients.",
      "Enable Vdc controller P1240 if regenerative load is expected."
    ],
    tools: ["Power quality meter", "Multimeter"],
    manual: "SINAMICS G120 Operating Manual", page: 418
  },
  {
    id: "DOC-003", mfr: "Siemens", device: "SINAMICS G120", code: "F003",
    title: "Undervoltage", sev: "Medium", cat: "Electrical",
    symptoms: ["Fault F003 at power-up", "DC link below threshold", "Drive will not enable"],
    causes: ["Phase loss on incoming supply", "Undersized control transformer", "DC bus capacitor degradation"],
    procedure: [
      "Measure all three line voltages at the supply terminals.",
      "Confirm control voltage is within tolerance at P0210.",
      "Inspect contactor and fuse links on the line side.",
      "Trend DC bus voltage under load to assess capacitor health."
    ],
    tools: ["Multimeter", "Clamp meter"],
    manual: "SINAMICS G120 Operating Manual", page: 421
  },
  {
    id: "DOC-004", mfr: "Schneider", device: "Altivar ATV320", code: "F001",
    title: "Output Overcurrent", sev: "Critical", cat: "Electrical",
    symptoms: ["Drive trips on run", "Fault F001 displayed", "Motor hums without rotation"],
    causes: ["Short circuit between output phases", "Motor insulation failure", "Mechanical blockage"],
    procedure: [
      "Isolate the drive and lock out the supply.",
      "Measure resistance between U-V, V-W, W-U (should be balanced).",
      "Test motor winding to frame insulation with a megger.",
      "Check for bound coupling or seized load.",
      "Re-enable after confirming balanced phase resistance."
    ],
    tools: ["Multimeter", "Insulation tester", "Alignment tool"],
    manual: "Altivar ATV320 Installation Manual", page: 156
  },
  {
    id: "DOC-005", mfr: "Schneider", device: "Altivar ATV320", code: "SLF",
    title: "Stator Fault / Ground Leakage", sev: "High", cat: "Electrical",
    symptoms: ["SLF fault during acceleration", "Ground current detected", "Intermittent trips"],
    causes: ["Winding insulation breakdown", "Contaminated motor enclosure", "Cable water ingress"],
    procedure: [
      "Power down and verify isolation.",
      "Measure leakage current to ground from each phase.",
      "Dry and reseal motor terminal box; replace gaskets if cracked.",
      "Re-run autotuning (drC menu) after repair."
    ],
    tools: ["Insulation tester", "Thermal camera"],
    manual: "Altivar ATV320 Programming Manual", page: 203
  },
  {
    id: "DOC-006", mfr: "Fanuc", device: "Series 0i-MF Servo", code: "SV0401",
    title: "Servo Alarm - Excess Current", sev: "Critical", cat: "Motion",
    symptoms: ["Alarm SV0401 on power on", "Servo not ready", "Axis does not home"],
    causes: ["Short in servo motor or cable", "Amplifier module failure", "Incorrect parameter set"],
    procedure: [
      "Switch off the servo amplifier and lock out.",
      "Check resistance between motor phases and to ground.",
      "Inspect encoder cable for pin-to-pin shorts.",
      "Swap axis amplifier module to isolate hardware fault.",
      "Reload axis parameters from the backup and re-home."
    ],
    tools: ["Multimeter", "Encoder tester", "Parameter backup media"],
    manual: "Fanuc Series 0i-MF Maintenance Manual", page: 288
  },
  {
    id: "DOC-007", mfr: "Fanuc", device: "Series 0i-MF Spindle", code: "PS0100",
    title: "Spindle Amplifier Low Voltage", sev: "High", cat: "Electrical",
    symptoms: ["PS0100 at spindle start", "Amplifier LED off", "No rotation"],
    causes: ["Control supply dropout", "Blown fusible link", "Regenerative unit fault"],
    procedure: [
      "Verify 24 VDC control supply at the amplifier connector.",
      "Inspect the regenerative discharge resistor and fusible links.",
      "Reset the amplifier only after supply is stable.",
      "Confirm spindle parameter 400x series matches the hardware."
    ],
    tools: ["Multimeter", "Fuse puller"],
    manual: "Fanuc Spindle Diagnostics Guide", page: 64
  },
  {
    id: "DOC-008", mfr: "Rockwell", device: "PowerFlex 525", code: "F012",
    title: "HW Overcurrent", sev: "Critical", cat: "Electrical",
    symptoms: ["F012 on start", "Drive disabled", "Motor draws high current"],
    causes: ["Ground fault", "Short circuit in output", "Motor overloaded"],
    procedure: [
      "Remove power and lock out the motor circuit.",
      "Measure output phase-to-ground and phase-to-phase resistance.",
      "Check the motor nameplate against Parameter 046 (FLA).",
      "Reduce Accel Time if the load is inertia dominated.",
      "Clear fault via the HIM after the cause is removed."
    ],
    tools: ["Multimeter", "Megger", "HIM programmer"],
    manual: "PowerFlex 525 User Manual", page: 187
  },
  {
    id: "DOC-009", mfr: "Rockwell", device: "PowerFlex 525", code: "F070",
    title: "Net Loss / Comms Timeout", sev: "Medium", cat: "Network",
    symptoms: ["F070 on EtherNet/IP", "Drive drops from scanner", "Fault rolls up to PLC"],
    causes: ["Loose RJ45 / damaged cable", "IP address conflict", "Scanner watchdog expiry"],
    procedure: [
      "Ping the drive IP from the engineering workstation.",
      "Confirm duplicate IP is not present on the cell network.",
      "Check the EtherNet/IP scanner connection timeout setting.",
      "Re-seat connectors and verify link LEDs."
    ],
    tools: ["Network cable tester", "Laptop with RSLogix"],
    manual: "PowerFlex 525 EtherNet/IP Adapter Manual", page: 92
  },
  {
    id: "DOC-010", mfr: "Generic PLC", device: "Conveyor Line 3 Controller", code: "E001",
    title: "Emergency Stop Latched", sev: "High", cat: "Safety",
    symptoms: ["E001 active", "Line 3 conveyor halted", "Estop stack light red"],
    causes: ["Operator e-stop pressed", "Broken safety contact chain", "Faulty e-stop mushroom"],
    procedure: [
      "Walk the zone and confirm no personnel or obstruction.",
      "Verify the safety relay K1 chain continuity.",
      "Reset only the local e-stop that latched.",
      "Cycle the master reset after the safety PLC clears."
    ],
    tools: ["Safety tester", "Multimeter"],
    manual: "Line 3 Safety PLC Logic Pack", page: 47
  },
  {
    id: "DOC-011", mfr: "Generic PLC", device: "Conveyor Line 3 Controller", code: "W042",
    title: "Photoeye Misalignment", sev: "Low", cat: "Sensor",
    symptoms: ["W042 warning", "Product count drift", "Intermittent jam detect"],
    causes: ["Dirty lens", "Misaligned emitter/receiver", "Ambient light interference"],
    procedure: [
      "Clean the photoeye lens with lint-free cloth.",
      "Re-align emitter and receiver using the alignment LED.",
      "Raise the dwell threshold in the sensor block.",
      "Validate counts against the MES tally for one cycle."
    ],
    tools: ["Alignment card", "Compressed air"],
    manual: "Conveyor Line 3 I/O Field Guide", page: 31
  },
  {
    id: "DOC-012", mfr: "Siemens", device: "SIMATIC S7-1500", code: "16#4541",
    title: "I/O Access Error", sev: "Medium", cat: "Network",
    symptoms: ["16#4541 in diagnostics buffer", "Peripheral access fault", "FB reading missing module"],
    causes: ["ET200SP module removed", "Profinet device offline", "Wrong slot addressing"],
    procedure: [
      "Open the diagnostics buffer in TIA Portal.",
      "Confirm the affected module is present and powered.",
      "Check Profinet device name vs topology.",
      "Re-deploy hardware configuration if the slot changed."
    ],
    tools: ["Engineering PC (TIA Portal)", "Profinet sniffer"],
    manual: "SIMATIC S7-1500 System Manual", page: 540
  },
  {
    id: "DOC-013", mfr: "Schneider", device: "Modicon M340", code: "I/O-FLT",
    title: "Distributed I/O Fault", sev: "Medium", cat: "Network",
    symptoms: ["I/O-FLT on PLC run LED", "Drop station offline", "Exchange detected"],
    causes: ["Terminator missing on CANopen", "Station power loss", "Loose TB connection"],
    procedure: [
      "Inspect the drop terminator at the last station.",
      "Measure 24 VDC at the remote rack PSU.",
      "Tighten the TB connections and reseat the bus coupler.",
      "Re-scan the network in Unity Pro."
    ],
    tools: ["Multimeter", "Unity Pro station"],
    manual: "Modicon M340 Hardware Manual", page: 119
  },
  {
    id: "DOC-014", mfr: "Fanuc", device: "Robodrill Alpha", code: "INTP-311",
    title: "Uninitialized Variable / Program Fault", sev: "Low", cat: "Motion",
    symptoms: ["INTP-311 at cycle start", "Program aborts", "Macro variable null"],
    causes: ["Macro variable not set by MES", "Tool offset missing", "Wrong program number called"],
    procedure: [
      "Check the macro variables the program expects from the MES handshakes.",
      "Load the correct tool offset table for the part.",
      "Verify the program number against the schedule.",
      "Single-step to the failing line and inspect registers."
    ],
    tools: ["HMI pendant", "MES terminal"],
    manual: "Robodrill Integration Manual", page: 77
  }
];

/* Operator feedback collected from the pilot deployment. */
const REVIEWS = [
  { op: "A. Niyonsenga", role: "Maintenance Tech", rating: 5, date: "2026-07-12", text: "Found the G120 F001 procedure in seconds. The megger step caught a ground fault we would have missed." },
  { op: "J. Uwimana", role: "Line 3 Operator", rating: 4, date: "2026-07-09", text: "Conveyor e-stop guide is clear. Would like the work-order button to prefill the asset tag." },
  { op: "R. Mugisha", role: "Automation Engineer", rating: 5, date: "2026-06-28", text: "Retrieval confidence scoring helps me trust the answer. Siemens vs Schneider split is accurate." },
  { op: "C. Bizimana", role: "Electrician", rating: 4, date: "2026-06-21", text: "Altivar SLF steps matched the real manual. Match highlighting on the fault code is useful." },
  { op: "T. Habimana", role: "Shift Supervisor", rating: 5, date: "2026-06-15", text: "Cut our average fault search from 18 minutes to under 3. CMMS work order opens directly." }
];
