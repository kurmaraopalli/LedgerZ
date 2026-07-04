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
           05  WS-UPDATED-FLAG    PIC X(01) VALUE 'N'.

       01  KEYS-AND-SENTINELS.
           05  WS-KEY-OLD         PIC X(10) VALUE LOW-VALUES.
           05  WS-KEY-TRN         PIC X(10) VALUE LOW-VALUES.

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
           
           PERFORM 3000-PROCESS-MERGE 
               UNTIL WS-KEY-OLD = HIGH-VALUES AND 
                     WS-KEY-TRN = HIGH-VALUES
               
           CLOSE OLD-MASTER TRANS-FILE NEW-MASTER AUDIT-LOG
           STOP RUN.

       1000-READ-OLD.
           READ OLD-MASTER 
               AT END 
                   MOVE 'Y' TO EOF-OLD
                   MOVE HIGH-VALUES TO WS-KEY-OLD
               NOT AT END
                   MOVE OM-ACC-NUM TO WS-KEY-OLD
           END-READ.

       2000-READ-TRN.
           READ TRANS-FILE 
               AT END 
                   MOVE 'Y' TO EOF-TRN
                   MOVE HIGH-VALUES TO WS-KEY-TRN
               NOT AT END
                   MOVE TR-ACC-NUM TO WS-KEY-TRN
           END-READ.

       3000-PROCESS-MERGE.
           IF WS-KEY-OLD < WS-KEY-TRN
               * No more transactions for this master record
               IF WS-UPDATED-FLAG = 'N'
                   MOVE OM-ACC-NUM TO PL-ACC
                   MOVE OM-NAME    TO PL-NAME
                   MOVE "NO CHANGES - RECORD COPIED" TO PL-MSG
                   PERFORM 4000-WRITE-AUDIT
               END-IF
               
               MOVE OM-ACC-NUM TO NM-ACC-NUM
               MOVE OM-NAME    TO NM-NAME
               MOVE OM-BALANCE TO NM-BALANCE
               WRITE NEW-MASTER-REC
               
               PERFORM 1000-READ-OLD
               MOVE 'N' TO WS-UPDATED-FLAG
           ELSE
               IF WS-KEY-OLD = WS-KEY-TRN
                   * Match found: apply transaction to master record in-place
                   MOVE OM-ACC-NUM TO PL-ACC
                   MOVE OM-NAME    TO PL-NAME
                   
                   IF TR-TYPE = 'D'
                       COMPUTE OM-BALANCE = OM-BALANCE + TR-AMOUNT
                       MOVE "DEPOSIT APPLIED SUCCESSFUL" TO PL-MSG
                   ELSE
                       COMPUTE OM-BALANCE = OM-BALANCE - TR-AMOUNT
                       MOVE "WITHDRAWAL APPLIED SUCCESSFUL" TO PL-MSG
                   END-IF
                   
                   PERFORM 4000-WRITE-AUDIT
                   MOVE 'Y' TO WS-UPDATED-FLAG
                   PERFORM 2000-READ-TRN
               ELSE
                   * WS-KEY-OLD > WS-KEY-TRN: transaction has no master record
                   MOVE TR-ACC-NUM TO PL-ACC
                   MOVE SPACES     TO PL-NAME
                   MOVE "REJECTED: ACCOUNT NOT IN MASTER" TO PL-MSG
                   
                   PERFORM 4000-WRITE-AUDIT
                   PERFORM 2000-READ-TRN
               END-IF
           END-IF.

       4000-WRITE-AUDIT.
           WRITE AUDIT-REC FROM PRINT-LINES.
