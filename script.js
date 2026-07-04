// Application State
let terminalPower = true;
let soundEnabled = true;
let compileDone = false;
let executionDone = false;

// Mock database models parsed from flat files
let oldMasterDb = [];
let transactionsDb = [];
let newMasterDb = [];
let auditLogs = [];

// Audio Context for Mainframe click and hum sounds
let audioCtx = null;
let humOsc = null;
let humGain = null;

// Initialize Dashboard and Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    initTime();
    initTerminalInput();
    initKeypad();
    initTabs();
    initSourceCodeViewer();
    initPowerAndSound();
    
    // Parse initial flat files and build grids
    syncDatabases();

    // Setup action buttons
    document.getElementById("btn-sync-databases").addEventListener("click", () => {
        syncDatabases();
        logConsole("SYSTEM: Physical files updated in DASD storage.");
        playCompileSound(120, 0.05);
    });

    document.getElementById("btn-reset-datasets").addEventListener("click", () => {
        document.getElementById("dataset-oldmast").value = 
`0000000001ALICE SMITH         0000500000
0000000002BOB JOHNSON        0001250050
0000000003CHARLIE BROWN      0000004500`;
        document.getElementById("dataset-transin").value = 
`0000000001D000015000
0000000002W0000005050
0000000009D000010000`;
        syncDatabases();
        logConsole("SYSTEM: Datasets restored to default mock bank state.");
        playCompileSound(100, 0.05);
    });

    document.getElementById("btn-compile-cobol").addEventListener("click", runCobolCompilation);
    document.getElementById("btn-submit-jcl").addEventListener("click", submitJclJob);
    document.getElementById("btn-clear-logs").addEventListener("click", () => {
        document.getElementById("jcl-console").textContent = "> Console cleared.";
    });
});

// Update Header clock and terminal time
function initTime() {
    const termTime = document.getElementById("term-time");
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        if (termTime) termTime.textContent = timeStr;
        
        // Sim CPU fluctuation
        const cpu = document.getElementById("cpu-load");
        if (cpu && terminalPower) {
            const load = (Math.random() * 0.8 + 0.1).toFixed(1);
            cpu.textContent = `${load}%`;
        }
    }, 1000);
}

// Power and Audio system
function initPowerAndSound() {
    const powerBtn = document.getElementById("btn-power");
    const powerScreen = document.getElementById("power-off-screen");
    const soundBtn = document.getElementById("btn-sound-toggle");

    powerBtn.addEventListener("click", () => {
        terminalPower = !terminalPower;
        if (terminalPower) {
            powerBtn.classList.remove("off");
            powerScreen.classList.remove("active");
            startTerminalHum();
            logTerminal("READY", "text-green");
            logTerminal("TSO/E V2R5 - ENTER TSO COMMAND OR SUBMIT JCL ON RIGHT", "text-cyan");
        } else {
            powerBtn.classList.add("off");
            powerScreen.classList.add("active");
            stopTerminalHum();
        }
    });

    soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.innerHTML = soundEnabled ? "🔊" : "🔇";
        if (!soundEnabled) {
            stopTerminalHum();
        } else if (terminalPower) {
            startTerminalHum();
        }
    });

    // Start audio on first interaction
    document.body.addEventListener("click", () => {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (terminalPower && soundEnabled) startTerminalHum();
            } catch (e) {
                console.error("Web Audio API not supported", e);
            }
        }
    }, { once: true });
}

function startTerminalHum() {
    if (!soundEnabled || !audioCtx) return;
    try {
        if (humOsc) stopTerminalHum();
        humOsc = audioCtx.createOscillator();
        humGain = audioCtx.createGain();
        
        humOsc.type = "sine";
        humOsc.frequency.setValueAtTime(60, audioCtx.currentTime); // 60Hz hum
        
        humGain.gain.setValueAtTime(0.005, audioCtx.currentTime); // very quiet
        
        humOsc.connect(humGain);
        humGain.connect(audioCtx.destination);
        humOsc.start();
    } catch(e) {}
}

// Sound effects controls
function stopTerminalHum() {
    try {
        if (humOsc) {
            humOsc.stop();
            humOsc.disconnect();
            humOsc = null;
        }
        if (humGain) {
            humGain.disconnect();
            humGain = null;
        }
    } catch(e) {}
}

function playKeySound() {
    if (!soundEnabled || !audioCtx) return;
    try {
        // High frequency click
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(800 + Math.random() * 400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch(e) {}
}

function playCompileSound(freq = 300, duration = 0.1) {
    if (!soundEnabled || !audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function playNotificationSound(success = true) {
    if (!soundEnabled || !audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = "sine";
        if (success) {
            osc.frequency.setValueAtTime(520, audioCtx.currentTime);
            osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1);
        } else {
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.setValueAtTime(100, audioCtx.currentTime + 0.15);
        }
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch(e) {}
}

// Terminal Commands Input Handler
function initTerminalInput() {
    const input = document.getElementById("tso-cmd-input");
    const cursor = document.querySelector(".custom-cursor");

    // Align custom cursor to input text width
    const updateCursor = () => {
        const val = input.value;
        // Estimate character spacing
        const charWidth = 11; 
        cursor.style.left = `${val.length * charWidth}px`;
    };

    input.addEventListener("input", updateCursor);
    input.addEventListener("keydown", (e) => {
        playKeySound();
        if (e.key === "Enter") {
            const cmd = input.value.trim();
            executeTsoCommand(cmd);
            input.value = "";
            updateCursor();
        }
    });

    // Cursor position setup
    updateCursor();
}

function initKeypad() {
    document.getElementById("key-clear").addEventListener("click", () => {
        playKeySound();
        document.getElementById("tso-cmd-input").value = "";
        const cursor = document.querySelector(".custom-cursor");
        cursor.style.left = "0px";
    });

    document.getElementById("key-reset").addEventListener("click", () => {
        playKeySound();
        logTerminal("READY", "text-green");
    });

    document.getElementById("key-pa1").addEventListener("click", () => {
        playNotificationSound(false);
        logTerminal("IKJ56650I TSO ATTENTION SIGNAL SENT", "text-error");
    });

    document.getElementById("key-sub").addEventListener("click", () => {
        playKeySound();
        executeTsoCommand("SUBMIT");
    });

    document.getElementById("key-enter").addEventListener("click", () => {
        playKeySound();
        const input = document.getElementById("tso-cmd-input");
        const cmd = input.value.trim();
        executeTsoCommand(cmd);
        input.value = "";
        const cursor = document.querySelector(".custom-cursor");
        cursor.style.left = "0px";
    });
}

function logTerminal(message, cssClass = "text-green") {
    if (!terminalPower) return;
    const body = document.getElementById("terminal-body-output");
    const div = document.createElement("div");
    div.className = `log-line ${cssClass}`;
    div.textContent = message;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

// TSO Command Engine
function executeTsoCommand(cmdStr) {
    if (!terminalPower) return;
    if (!cmdStr) return;

    logTerminal(`===> ${cmdStr}`, "text-white");
    const upperCmd = cmdStr.toUpperCase();

    if (upperCmd === "CLEAR") {
        document.getElementById("terminal-body-output").innerHTML = "";
    } else if (upperCmd.startsWith("SUBMIT") || upperCmd === "SUB") {
        if (!compileDone) {
            logTerminal("IEF212I JOB REJECTED: COBOL LOAD MODULE NOT FOUND. RUN COMPILE STEP FIRST.", "text-error");
            playNotificationSound(false);
        } else {
            logTerminal("JOB00256 SUBMITTED - USER.PROJECT.JCL(EXECZ)", "text-yellow");
            setTimeout(() => {
                submitJclJob();
            }, 1000);
        }
    } else if (upperCmd === "COMPCOB" || upperCmd === "COMPILE") {
        runCobolCompilation();
    } else if (upperCmd === "HELP") {
        logTerminal("AVAILABLE COMMANDS:", "text-cyan");
        logTerminal("  COMPCOB   - Compile LEDGERZ COBOL application module", "text-cyan");
        logTerminal("  SUBMIT    - Submit JCL job to run batch transaction processor", "text-cyan");
        logTerminal("  CLEAR     - Clear console screens", "text-cyan");
    } else {
        logTerminal(`IKJ56621I INVALID COMMAND: ${cmdStr}. TYPE 'HELP' FOR DETAILS.`, "text-error");
        playNotificationSound(false);
    }
}

// Tab Selection Logic
function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");
            playKeySound();
        });
    });
}

// Flat-File Parser & Database Sync
function syncDatabases() {
    const rawOldMast = document.getElementById("dataset-oldmast").value;
    const rawTrans = document.getElementById("dataset-transin").value;

    oldMasterDb = parseFlatFile(rawOldMast, "master");
    transactionsDb = parseFlatFile(rawTrans, "transaction");

    renderGridTable("table-oldmast", oldMasterDb, "master");
    renderGridTable("table-transin", transactionsDb, "transaction");
}

function parseFlatFile(text, type) {
    const lines = text.split("\n");
    const records = [];

    lines.forEach(line => {
        if (!line.trim()) return;
        // Pad line to 80 bytes to emulate fixed block layout
        const paddedLine = line.padEnd(80, " ");

        if (type === "master") {
            const acc = paddedLine.substring(0, 10).trim();
            const name = paddedLine.substring(10, 30).trim();
            const rawBalance = paddedLine.substring(30, 40).trim();
            // Convert PIC 9(8)V99 implied decimal
            const parsedBalance = parseFloat(rawBalance) / 100;

            if (acc) {
                records.push({ acc, name, balance: isNaN(parsedBalance) ? 0.0 : parsedBalance });
            }
        } else if (type === "transaction") {
            const acc = paddedLine.substring(0, 10).trim();
            const trnType = paddedLine.substring(10, 11).trim();
            const rawAmount = paddedLine.substring(11, 21).trim();
            const parsedAmount = parseFloat(rawAmount) / 100;

            if (acc) {
                records.push({ acc, type: trnType, amount: isNaN(parsedAmount) ? 0.0 : parsedAmount });
            }
        }
    });

    return records;
}

function renderGridTable(tableId, data, type) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">Empty Dataset</td></tr>`;
        return;
    }

    data.forEach(rec => {
        let rowHtml = "";
        if (type === "master") {
            rowHtml = `
                <td><code>${rec.acc.padStart(10, "0")}</code></td>
                <td>${escapeHtml(rec.name)}</td>
                <td class="text-green">$${rec.balance.toFixed(2)}</td>
            `;
        } else if (type === "transaction") {
            const typeClass = rec.type === 'D' ? 'text-green' : 'text-error';
            rowHtml = `
                <td><code>${rec.acc.padStart(10, "0")}</code></td>
                <td class="${typeClass}"><b>${rec.type === 'D' ? 'Deposit (D)' : 'Withdrawal (W)'}</b></td>
                <td>$${rec.amount.toFixed(2)}</td>
            `;
        }
        const tr = document.createElement("tr");
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Source Code Viewer
function initSourceCodeViewer() {
    const viewer = document.getElementById("code-content-area");
    const btns = document.querySelectorAll(".src-file-btn");

    const loadSource = (fileType) => {
        viewer.textContent = "Fetching mainframe PDS member...";
        let url = fileType === "cbl" ? window.cblSourcePath : window.jclSourcePath;
        
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("File not found");
                return res.text();
            })
            .then(code => {
                viewer.textContent = code;
            })
            .catch(err => {
                viewer.textContent = `CRITICAL: Could not fetch source dataset file member: ${err.message}`;
            });
    };

    btns.forEach(btn => {
        btn.addEventListener("click", () => {
            btns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            loadSource(btn.getAttribute("data-file"));
            playKeySound();
        });
    });

    // Default load
    loadSource("cbl");
}

// Compiler simulation
function logConsole(msg) {
    const consoleElem = document.getElementById("jcl-console");
    consoleElem.textContent += `\n${msg}`;
    consoleElem.scrollTop = consoleElem.scrollHeight;
}

function runCobolCompilation() {
    if (!terminalPower) return;
    const compileCard = document.getElementById("step-compile-card");
    const btn = document.getElementById("btn-compile-cobol");
    const jclBtn = document.getElementById("btn-submit-jcl");

    btn.disabled = true;
    compileCard.classList.remove("success");
    logConsole("\n--- JOB STEP: COMPCOB (IGYWCL) STARTED ---");
    logConsole("IEF233D: Allocating system datasets for compiler phase...");
    logConsole("IGYDS0001-I: Parsing source code LEDGERZ.cbl...");
    
    logTerminal("IGY1001-I COMPILE STEP STARTED FOR LEDGERZ", "text-cyan");
    
    // Animate compile logs
    let tick = 0;
    const interval = setInterval(() => {
        tick++;
        playCompileSound(350 + tick * 50, 0.05);
        if (tick === 1) logConsole("IGYDS0020-I: Reading Environment and Data Divisions...");
        if (tick === 2) logConsole("IGYDS0035-I: Validating file control blocks...");
        if (tick === 3) logConsole("IGYDS0102-I: Generating assembler output machine card deck...");
        if (tick === 4) {
            clearInterval(interval);
            compileDone = true;
            compileCard.classList.add("success");
            btn.disabled = false;
            jclBtn.disabled = false;
            
            logConsole("SUCCESS: Compile and link edit completed. Return code: RC=0000.");
            logConsole("USER.PROJECT.LOAD(LEDGERZ) allocated in DASD.");
            logConsole("--- JOB STEP: COMPCOB COMPLETED ---");
            
            logTerminal("READY - COMPILATION SUCCESSFUL. RC=0000", "text-green");
            playNotificationSound(true);
        }
    }, 600);
}

// Batch execution engine
function submitJclJob() {
    if (!terminalPower || !compileDone) return;
    
    const jclCard = document.getElementById("step-jcl-card");
    const btn = document.getElementById("btn-submit-jcl");
    
    btn.disabled = true;
    jclCard.classList.remove("success");
    syncDatabases(); // Sync input databases first
    
    logConsole("\n--- JES2 JOB EXECZ SUBMITTED ---");
    logConsole("$HASP100 EXECZ ON CLASS A SOURCE=TSO");
    logConsole("IEF233D: Allocating OLDMAST, TRANSIN, NEWMAST, AUDITOUT...");
    logConsole("--- JOB STEP: RUNBATCH (LEDGERZ) EXECUTION STARTED ---");

    logTerminal("JOB00256 EXECZ STARTED - ACTIVE STEP: RUNBATCH", "text-yellow");

    // Run the actual matching batch logic in JavaScript
    setTimeout(() => {
        try {
            executeBatchProcessor();
            
            // Render outputs
            renderGridTable("table-newmast", newMasterDb, "master");
            document.getElementById("newmast-status").textContent = "Processed";
            document.getElementById("newmast-status").className = "badge-status processed";

            // Print spool audit results
            logConsole("\n>>> JES2 JOB LOG OUT: AUDITOUT (PRINT STREAM) <<<");
            auditLogs.forEach(line => {
                logConsole(line);
            });
            logConsole(">>> END OF AUDITOUT STREAM <<<\n");

            logConsole("SUCCESS: Flat File Ledger Swap Completed.");
            logConsole("USER.BANK.NEWMAST generated on volume MVS001.");
            logConsole("$HASP395 EXECZ ENDED - RC=0000");
            logConsole("--- JOB STEP: RUNBATCH COMPLETED ---");

            jclCard.classList.add("success");
            btn.disabled = false;
            executionDone = true;

            logTerminal("JOB00256 EXECZ ENDED - SYSTEM SUCCESSFUL. RC=0000", "text-green");
            logTerminal("FLAT FILE MERGE GENERATED DSN: USER.BANK.NEWMAST", "text-cyan");
            playNotificationSound(true);
        } catch (e) {
            logConsole(`CRITICAL RUNTIME ERROR: Program aborted with abend code S0C7: ${e.message}`);
            logTerminal("JOB00256 EXECZ ABENDED WITH CODE S0C7", "text-error");
            playNotificationSound(false);
            btn.disabled = false;
        }
    }, 1500);
}

// Javascript replica of the corrected COBOL LEDGERZ batch-merge logic
function executeBatchProcessor() {
    newMasterDb = [];
    auditLogs = [];

    // Clone inputs so we don't mutate active parsed editors directly
    let oldMastArr = JSON.parse(JSON.stringify(oldMasterDb));
    let transArr = JSON.parse(JSON.stringify(transactionsDb));

    // Sort files to replicate mainframe sequential processing order (keys are strings)
    oldMastArr.sort((a, b) => a.acc.localeCompare(b.acc));
    transArr.sort((a, b) => a.acc.localeCompare(b.acc));

    let oldIdx = 0;
    let trnIdx = 0;
    let wsUpdatedFlag = 'N';

    // Sentinel Keys
    const HIGH_VALUES = "9999999999"; 

    const getOldKey = () => (oldIdx >= oldMastArr.length) ? HIGH_VALUES : oldMastArr[oldIdx].acc;
    const getTrnKey = () => (trnIdx >= transArr.length) ? HIGH_VALUES : transArr[trnIdx].acc;

    while (getOldKey() !== HIGH_VALUES || getTrnKey() !== HIGH_VALUES) {
        let wsKeyOld = getOldKey();
        let wsKeyTrn = getTrnKey();

        if (wsKeyOld < wsKeyTrn) {
            // Case 1: No more transactions for this master record.
            // Replicate: IF WS-UPDATED-FLAG = 'N' PERFORM 4000-WRITE-AUDIT
            const oldRec = oldMastArr[oldIdx];
            if (wsUpdatedFlag === 'N') {
                writeAuditLine(oldRec.acc, oldRec.name, "NO CHANGES - RECORD COPIED");
            }
            
            // Replicate: WRITE NEW-MASTER-REC from OLD-MASTER
            newMasterDb.push({
                acc: oldRec.acc,
                name: oldRec.name,
                balance: oldRec.balance
            });

            // Replicate: PERFORM 1000-READ-OLD
            oldIdx++;
            wsUpdatedFlag = 'N';
        } 
        else if (wsKeyOld === wsKeyTrn) {
            // Case 2: Matching transaction. Replicate: apply in-place.
            const oldRec = oldMastArr[oldIdx];
            const trnRec = transArr[trnIdx];

            let msg = "";
            if (trnRec.type === 'D') {
                oldRec.balance += trnRec.amount;
                msg = "DEPOSIT APPLIED SUCCESSFUL";
            } else if (trnRec.type === 'W') {
                oldRec.balance -= trnRec.amount;
                msg = "WITHDRAWAL APPLIED SUCCESSFUL";
            } else {
                msg = `REJECTED: INVALID TRANSACTION TYPE '${trnRec.type}'`;
            }

            // Replicate: PERFORM 4000-WRITE-AUDIT
            writeAuditLine(oldRec.acc, oldRec.name, msg);

            // Replicate: MOVE 'Y' TO WS-UPDATED-FLAG
            wsUpdatedFlag = 'Y';

            // Replicate: PERFORM 2000-READ-TRN
            trnIdx++;
        } 
        else {
            // Case 3: wsKeyOld > wsKeyTrn: Transaction key doesn't exist in master.
            // Replicate: MOVE TR-ACC-NUM TO PL-ACC, SPACES TO PL-NAME, REJECTED TO PL-MSG
            const trnRec = transArr[trnIdx];
            writeAuditLine(trnRec.acc, "", "REJECTED: ACCOUNT NOT IN MASTER");

            // Replicate: PERFORM 2000-READ-TRN
            trnIdx++;
        }
    }
}

// Replicate PIC layouts for Audit Log Output formatting
// Line layout: 80 bytes
// PL-ACC: PIC X(10) (01-10)
// FILLER: PIC X(02) (11-12) -> '  '
// PL-NAME: PIC X(20) (13-32)
// FILLER: PIC X(02) (33-34) -> '  '
// PL-MSG: PIC X(46) (35-80)
function writeAuditLine(acc, name, message) {
    const formattedAcc = acc.padStart(10, "0");
    const formattedName = name.padEnd(20, " ");
    const formattedMsg = message.padEnd(46, " ");

    const line = `${formattedAcc}  ${formattedName}  ${formattedMsg}`;
    auditLogs.push(line);
}
