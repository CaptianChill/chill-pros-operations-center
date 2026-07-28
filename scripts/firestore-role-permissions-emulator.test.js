"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} = require("firebase/firestore");

const PROJECT_ID = "demo-chill-pros-role-permissions";

async function main() {
  const rules = fs.readFileSync(path.resolve(__dirname, "..", "firestore.rules"), "utf8");
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  const ownerUid = "owner-uid";
  const officeUid = "office-uid";
  const assignedTechUid = "assigned-tech-uid";
  const otherTechUid = "other-tech-uid";
  const missingProfileUid = "missing-profile-uid";
  const assignedTechName = "Brae Morrison";
  const otherTechName = "Other Technician";
  const assignedJobId = "assigned-job";
  const otherJobId = "other-job";

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "Users", ownerUid), {
        role: "owner",
        displayName: "Owner",
      });
      await setDoc(doc(db, "Users", officeUid), {
        role: "office",
        displayName: "Office",
      });
      await setDoc(doc(db, "Users", assignedTechUid), {
        role: "technician",
        technicianName: assignedTechName,
      });
      await setDoc(doc(db, "Users", otherTechUid), {
        role: "technician",
        technicianName: otherTechName,
      });
      await setDoc(doc(db, "Customers", assignedJobId), {
        customerName: "Assigned Customer",
        assignedTechnician: assignedTechName,
        officeStatus: "Scheduled",
        statusUpdatedAt: Timestamp.fromMillis(1_700_000_000_000),
        estimatedAmount: 750,
        internalCost: 200,
      });
      await setDoc(doc(db, "Customers", otherJobId), {
        customerName: "Other Customer",
        assignedTechnician: otherTechName,
        officeStatus: "Scheduled",
        statusUpdatedAt: Timestamp.fromMillis(1_700_000_000_000),
      });
    });

    const ownerDb = testEnv.authenticatedContext(ownerUid).firestore();
    const officeDb = testEnv.authenticatedContext(officeUid).firestore();
    const assignedTechDb = testEnv.authenticatedContext(assignedTechUid).firestore();
    const otherTechDb = testEnv.authenticatedContext(otherTechUid).firestore();
    const missingProfileDb = testEnv.authenticatedContext(missingProfileUid).firestore();
    const anonymousDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "Customers", assignedJobId)));
    await assertSucceeds(getDoc(doc(officeDb, "Customers", assignedJobId)));
    await assertSucceeds(getDoc(doc(assignedTechDb, "Customers", assignedJobId)));
    await assertFails(getDoc(doc(otherTechDb, "Customers", assignedJobId)));
    await assertFails(getDoc(doc(missingProfileDb, "Customers", assignedJobId)));
    await assertFails(getDoc(doc(anonymousDb, "Customers", assignedJobId)));

    await assertSucceeds(setDoc(doc(ownerDb, "Customers", "owner-created"), {
      customerName: "Owner Created",
      assignedTechnician: assignedTechName,
      officeStatus: "Scheduled",
      statusUpdatedAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(officeDb, "Customers", "office-created"), {
      customerName: "Office Created",
      assignedTechnician: assignedTechName,
      officeStatus: "Scheduled",
      statusUpdatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(assignedTechDb, "Customers", "tech-created"), {
      customerName: "Technician Created",
      assignedTechnician: assignedTechName,
      officeStatus: "Scheduled",
      statusUpdatedAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(doc(assignedTechDb, "Customers", assignedJobId), {
      workNotes: "Checked pressures and electrical readings.",
    }));
    await assertSucceeds(updateDoc(doc(assignedTechDb, "Customers", assignedJobId), {
      officeStatus: "In Progress",
      statusUpdatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(assignedTechDb, "Customers", assignedJobId), {
      officeStatus: "Completed",
      statusUpdatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      findings: "Failed component confirmed.",
    }));
    await assertFails(updateDoc(doc(assignedTechDb, "Customers", assignedJobId), {
      internalCost: 1,
    }));
    await assertFails(updateDoc(doc(assignedTechDb, "Customers", assignedJobId), {
      assignedTechnician: otherTechName,
    }));
    await assertFails(updateDoc(doc(otherTechDb, "Customers", assignedJobId), {
      workNotes: "Unauthorized edit",
    }));

    await assertSucceeds(updateDoc(doc(ownerDb, "Customers", assignedJobId), {
      internalCost: 225,
    }));
    await assertSucceeds(updateDoc(doc(officeDb, "Customers", assignedJobId), {
      estimatedAmount: 800,
    }));
    await assertSucceeds(deleteDoc(doc(ownerDb, "Customers", otherJobId)));
    await assertFails(deleteDoc(doc(assignedTechDb, "Customers", assignedJobId)));

    console.log("Firestore emulator role-permission matrix passed.");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
