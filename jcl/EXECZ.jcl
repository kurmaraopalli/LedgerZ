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
0000000001D000015000
0000000002W0000005050
0000000009D000010000
/*
