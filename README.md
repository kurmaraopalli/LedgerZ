# 🏦 LedgerZ: High-Speed Flat-File Mainframe Batch Processor

`LedgerZ` is an educational, production-grade mock application designed to run entirely on **IBM Z Mainframe environments**. It demonstrates pure, high-performance mainframe batch engineering without relying on DB2, SQL, or external relational databases.

This repository is optimized to be edited using **VS Code (with IBM Z Open Editor)** and runs natively on IBM terminal environments, including **AntiGravity** or any modern Z/OS LPAR.

---

## 🎯 Problem Statements: What LedgerZ Solves

LedgerZ addresses two distinct challenges—one relating to **enterprise banking architecture** and the other to **modern developer training**:

### A. The Banking Challenge: Scaling High-Volume Transactions
In retail banking or card networks, processing millions of balances every night on database servers (like DB2 or SQL) is slow and expensive. Writing and locking database records "in place" creates massive system bottlenecks. 
* **The Solution**: Mainframes solve this by treating records as sequential streams (**QSAM** flat files). By reading yesterday's state file and today's transaction file, the system matches keys in a single pass ($O(N)$ linear time) and writes a brand new ledger file. This method is incredibly fast and operates without the overhead of active database engines.

### B. The Developer Challenge: Mainframe Accessibility & Testing
Testing or learning COBOL and JCL historically requires access to a mainframe partition (LPAR), proprietary emulators, and complex FTP/Zowe uploading sequences. This high barrier makes learning mainframe programming difficult.
* **The Solution**: LedgerZ provides a **local interactive web simulator dashboard**. It emulates TSO/E terminal commands, visualizes step-by-step dataset merges, compiles COBOL, and executes jobs in-browser. This allows developers to learn flat-file mainframe structures entirely offline inside standard browsers.

---

## 🏗️ Architecture: Pure Flat-File Batch Processing

Unlike modern cloud stacks, enterprise mainframes process millions of records using simple, ultra-fast sequential flat files (**QSAM** - Queued Sequential Access Method). 

```text
 [ INPUT: Master File ]  ────┐
 (Ledger Balance State)      │
                             ├─► [ LedgerZ COBOL Engine ] ─► [ OUTPUT: New Master File ]
 [ INPUT: Trans File ]   ────┘      (Processes Flat Records)      (Updated Account Ledger)
 (Nightly ATM Drops)                                                │
                                                                    ▼
                                                             [ PRINT: Audit Log ]
                                                             (System Audit Trail)
```

### 📋 The Three-File Ledger Swap
Because it uses standard flat sequential files, the application cannot update a file "in place." Instead, it uses the classic mainframe pattern:
1. It reads the current state (**Old Master File**).
2. It reads the incoming updates (**Transaction File**).
3. It merges them into a brand-new sequential dataset (**New Master File**), while outputting a readable text report (**Audit Log**).

---

## 💾 1. Data Structure Definitions (Flat File Layouts)

Both the Master and Transaction data files are **Fixed Block (FB) text files with an 80-byte record length**. This means they can be viewed and edited natively in VS Code or ISPF Option 3.4.

### A. Master File Record Layout (80 Bytes)

| Position | Field Name | Format | Description |
| :--- | :--- | :--- | :--- |
| `01-10` | `MSR-ACC-NUM` | `PIC X(10)` | Unique Account Key |
| `11-30` | `MSR-NAME` | `PIC X(20)` | Cardholder Name |
| `31-40` | `MSR-BALANCE` | `PIC 9(8)V99` | Account Balance (Explicit Decimal) |
| `41-80` | `FILLER` | `PIC X(40)` | System padding |

### B. Transaction File Record Layout (80 Bytes)

| Position | Field Name | Format | Description |
| :--- | :--- | :--- | :--- |
| `01-10` | `TRN-ACC-NUM` | `PIC X(10)` | Target Account Key |
| `11-11` | `TRN-TYPE` | `PIC X(01)` | Action Code (`D` = Deposit, `W` = Withdrawal) |
| `12-21` | `TRN-AMOUNT` | `PIC 9(8)V99` | Transaction Cash Value |
| `22-80` | `FILLER` | `PIC X(59)` | System padding |

---

## 💻 2. Application Core: `LEDGERZ.cbl`

Save this file as `src/LEDGERZ.cbl`. This COBOL program contains the sequential processing logic.

```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. LEDGERZ.
       AUTHOR. MAINFRAME-DEV.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT OLD-MASTER ASSIGN TO OLDMAST.
           SELECT TRANS-FILE ASSIGN TO TRANSIN.
           SELECT NEW-MASTER ASSIGN TO NEWMAST.
           SELECT AUDIT-LOG  ASSIGN TO AUDITOUT.

       DATA DIVISION.
       FILE SECTION.
       FD  OLD-MASTER.
       01  OLD-MASTER-REC.
           05  OM-ACC-NUM         PIC X(10).
           05  OM-NAME            PIC X(20).
           05  OM-BALANCE         PIC 9(8)V99.
           05  FILLER             PIC X(40).

       FD  TRANS-FILE.
       01  TRANS-REC.
           05  TR-ACC-NUM         PIC X(10).
           05  TR-TYPE            PIC X(01).
           05  TR-AMOUNT          PIC 9(8)V99.
           05  FILLER             PIC X(59).

       FD  NEW-MASTER.
       01  NEW-MASTER-REC.
           05  NM-ACC-NUM         PIC X(10).
           05  NM-NAME            PIC X(20).
           05  NM-BALANCE         PIC 9(8)V99.
           05  FILLER             PIC X(40).

       FD  AUDIT-LOG.
       01  AUDIT-REC              PIC X(80).

       WORKING-STORAGE SECTION.
       01  FLAGS.
           05  EOF-OLD            PIC X(01) VALUE 'N'.
           05  EOF-TRN            PIC X(01) VALUE 'N'.

       01  PRINT-LINES.
           05  PL-ACC             PIC X(10).
           05  FILLER             PIC X(02) VALUE '  '.
           05  PL-NAME            PIC X(20).
           05  FILLER             PIC X(02) VALUE '  '.
           05  PL-MSG             PIC X(46).

       PROCEDURE DIVISION.
       0000-MAIN.
           OPEN INPUT  OLD-MASTER TRANS-FILE
           OPEN OUTPUT NEW-MASTER AUDIT-LOG
           
           PERFORM 1000-READ-OLD
           PERFORM 2000-READ-TRN
           
           PERFORM 3000-PROCESS-BALANCE 
               UNTIL EOF-OLD = 'Y' AND EOF-TRN = 'Y'
               
           CLOSE OLD-MASTER TRANS-FILE NEW-MASTER AUDIT-LOG
           STOP RUN.

       1000-READ-OLD.
           READ OLD-MASTER AT END MOVE 'Y' TO EOF-OLD.

       2000-READ-TRN.
           READ TRANS-FILE AT END MOVE 'Y' TO EOF-TRN.

       3000-PROCESS-BALANCE.
           IF OM-ACC-NUM = TR-ACC-NUM AND EOF-OLD = 'N' AND EOF-TRN = 'N'
               MOVE OM-ACC-NUM TO NM-ACC-NUM
               MOVE OM-NAME    TO NM-NAME
               
               IF TR-TYPE = 'D'
                   COMPUTE NM-BALANCE = OM-BALANCE + TR-AMOUNT
                   MOVE "DEPOSIT APPLIED SUCCESSFUL" TO PL-MSG
               ELSE
                   COMPUTE NM-BALANCE = OM-BALANCE - TR-AMOUNT
                   MOVE "WITHDRAWAL APPLIED SUCCESSFUL" TO PL-MSG
               END-IF
               
               WRITE NEW-MASTER-REC
               PERFORM 4000-WRITE-AUDIT
               PERFORM 1000-READ-OLD
               PERFORM 2000-READ-TRN
           ELSE
               IF (OM-ACC-NUM < TR-ACC-NUM OR EOF-TRN = 'Y') AND EOF-OLD = 'N'
                   MOVE OLD-MASTER-REC TO NEW-MASTER-REC
                   WRITE NEW-MASTER-REC
                   MOVE OM-ACC-NUM TO PL-ACC
                   MOVE OM-NAME    TO PL-NAME
                   MOVE "NO CHANGES - RECORD COPIED" TO PL-MSG
                   PERFORM 4000-WRITE-AUDIT
                   PERFORM 1000-READ-OLD
               ELSE
                   IF EOF-TRN = 'N'
                       MOVE TR-ACC-NUM TO PL-ACC
                       MOVE SPACES     TO PL-NAME
                       MOVE "REJECTED: ACCOUNT NOT IN MASTER" TO PL-MSG
                       PERFORM 4000-WRITE-AUDIT
                       PERFORM 2000-READ-TRN
                   END-IF
               END-IF
           END-IF.

       4000-WRITE-AUDIT.
           MOVE OM-ACC-NUM TO PL-ACC
           MOVE OM-NAME    TO PL-NAME
           WRITE AUDIT-REC FROM PRINT-LINES.
```

---

## ⚙️ 3. Execution Script: `EXECZ.jcl`

Save this file as `jcl/EXECZ.jcl`. This script compiles the source and maps your raw data via text parameter cards (**instream datasets**).

```jcl
//EXECZ    JOB (LEDGER),'RUN LEDGERZ APP',CLASS=A,MSGCLASS=X
//*****************************************************************
//* STEP 1: COMPILE THE COBOL FLAT-FILE APPLICATON
//*****************************************************************
//COMPILE  EXEC IGYWCL,PARM.COBOL='NONUMBER,APOST'
//COBOL.SYSIN  DD DSN=USER.PROJECT.SOURCE(LEDGERZ),DISP=SHR
//LKED.SYSLMOD DD DSN=USER.PROJECT.LOAD(LEDGERZ),DISP=SHR
//*****************************************************************
//* STEP 2: RUN LOGIC AND POPULATE FLAT-FILE DATA
//*****************************************************************
//RUNBATCH EXEC PGM=LEDGERZ
//STEPLIB  DD DSN=USER.PROJECT.LOAD,DISP=SHR
//NEWMAST  DD DSN=USER.BANK.NEWMAST,DISP=(NEW,CATLG,DELETE),
//            SPACE=(TRK,(1,1)),DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)
//AUDITOUT DD SYSOUT=*
//*****************************************************************
//* INLINE MOCK DATABASES (FLAT RECORD STREAMS)
//*****************************************************************
//OLDMAST  DD *
0000000001ALICE SMITH         0000500000
0000000002BOB JOHNSON        0001250050
0000000003CHARLIE BROWN      0000004500
/*
//TRANSIN  DD *
0000000001D0000015000
0000000002W0000005050
0000000009D000010000
/*
```

---

## 🚀 How to Run this Project

You can run this project in two ways: using the **Interactive Local Web Simulator** (recommended for quick offline testing) or deploying it natively to an **IBM Z Mainframe**.

### Option A: Interactive Local Web Simulator (Recommended)

This project includes a retro, client-side web simulator representing an IBM 3270 Mainframe developer station. 

#### 1. Start a Local HTTP Server
Because the simulator dynamically displays code files from the workspace, run a local web server to avoid browser CORS restrictions. Open your terminal in the `LedgerZ` folder and run:
```bash
python -m http.server 8000
```

#### 2. Open the Simulator in your Browser
* If you ran the command inside the **`LedgerZ`** directory, open:
  👉 **[http://localhost:8000/index.html](http://localhost:8000/index.html)**
* If you ran the command in the **parent workspace** directory, open:
  👉 **[http://localhost:8000/LedgerZ/index.html](http://localhost:8000/LedgerZ/index.html)**

#### 3. Operating the Simulator
1. **Interactive Datasets**: Click on the **Flat Datasets** tab. You can directly edit the raw 80-byte records for the initial balances (`OLDMAST`) and ATM transactions (`TRANSIN`).
2. **Compile the COBOL Engine**: Under the **Compiler & JCL** tab, click **Run Compile**. The emulated console will display the compile steps.
3. **Submit the Batch Job**: Click **Submit Job** (or type `SUB` in TSO command prompt on the screen and press **Enter**).
4. **Verify Outputs**:
   * Inspect the updated account sheets in the **Database Grids** tab.
   * View the processed entries and transaction logs in the **JCL Console** (which outputs the simulated JCL printer log `AUDITOUT`).

---

### Option B: Native IBM Z Mainframe Deployment

To deploy and execute the code on a real mainframe LPAR:

1. **Upload Source Members**: Transfer `src/LEDGERZ.cbl` and `jcl/EXECZ.jcl` to your mainframe partitioned datasets (PDS) e.g. `USER.PROJECT.SOURCE(LEDGERZ)` and `USER.PROJECT.JCL(EXECZ)` using FTP or Zowe CLI.
2. **Submit Job Card**: Submit `EXECZ.jcl` using your emulator console or command-line submission (`sub`).
3. **Inspect Output**: View job results in System Display and Search Facility (`SDSF`). The output sequential dataset `USER.BANK.NEWMAST` will be created with updated balances.

---

## 🔒 Security & Code Integrity Review

A strict security analysis was performed on this codebase to verify compliance and protect sensitive information:

* **No Credential Leaks**: There are no hardcoded API keys, passwords, LPAR mainframe credentials, or private SSH keys present in the repository.
* **No Real PII (Personally Identifiable Information)**: All names (`ALICE SMITH`, `BOB JOHNSON`), account numbers, and transaction balances are completely simulated mock banking records.
* **Client-Side Sandbox Isolation**: The web simulator executes 100% locally in your browser. It does not establish external network connections, perform API calls, or upload any user-modified datasets to external servers.
* **Safe DOM Injection**: All user inputs in the dataset editors are sanitized and escaped via `escapeHtml()` prior to table rendering to prevent Cross-Site Scripting (XSS) injection.

