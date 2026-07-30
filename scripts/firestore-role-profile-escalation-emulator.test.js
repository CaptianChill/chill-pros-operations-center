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
} = require("firebase/firestore");

const PROJECT_ID = "demo-chill-pros-role-profile-escalation";

async function main() {
  const rules = fs.readFileSync(path.resolve(__dirname, "..", "firestore.rules"), "utf8");
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  const ownerUid = "owner-uid";
  const officeUid = "office-uid";
  const technicianUid = "technician-uid";
  const otherTechnicianUid = "other-technician-uid";
  const missingProfileUid = "missing-profile-uid";

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
      await setDoc(doc(db, "Users", technicianUid), {
        role: "technician",
        technicianName: "Assigned Technician",
      });
      await setDoc(doc(db, "Users", otherTechnicianUid), {
        role: "technician",
        technicianName: "Other Technician",
      });
    });

    const ownerDb = testEnv.authenticatedContext(ownerUid).firestore();
    const officeDb = testEnv.authenticatedContext(officeUid).firestore();
    const technicianDb = testEnv.authenticatedContext(technicianUid).firestore();
    const missingProfileDb = testEnv.authenticatedContext(missingProfileUid).firestore();
    const anonymousDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "Users", officeUid)));
    await assertSucceeds(getDoc(doc(officeDb, "Users", officeUid)));
    await assertFails(getDoc(doc(officeDb, "Users", ownerUid)));
    await assertSucceeds(getDoc(doc(technicianDb, "Users", technicianUid)));
    await assertFails(getDoc(doc(technicianDb, "Users", otherTechnicianUid)));
    await assertFails(getDoc(doc(missingProfileDb, "Users", ownerUid)));
    await assertFails(getDoc(doc(anonymousDb, "Users", ownerUid)));

    await assertFails(updateDoc(doc(officeDb, "Users", officeUid), {
      role: "owner",
    }));
    await assertFails(updateDoc(doc(technicianDb, "Users", technicianUid), {
      role: "owner",
    }));
    await assertFails(updateDoc(doc(technicianDb, "Users", technicianUid), {
      technicianName: "Forged Technician Identity",
    }));
    await assertFails(setDoc(doc(missingProfileDb, "Users", missingProfileUid), {
      role: "owner",
      displayName: "Self Provisioned Owner",
    }));
    await assertFails(deleteDoc(doc(officeDb, "Users", officeUid)));
    await assertFails(deleteDoc(doc(technicianDb, "Users", technicianUid)));

    await assertFails(setDoc(doc(ownerDb, "Users", "invalid-role"), {
      role: "administrator",
      displayName: "Invalid Role",
    }));
    await assertFails(setDoc(doc(ownerDb, "Users", "missing-tech-name"), {
      role: "technician",
    }));
    await assertFails(setDoc(doc(ownerDb, "Users", "blank-tech-name"), {
      role: "technician",
      technicianName: "",
    }));
    await assertFails(setDoc(doc(ownerDb, "Users", "space-only-tech-name"), {
      role: "technician",
      technicianName: "   ",
    }));
    await assertFails(setDoc(doc(ownerDb, "Users", "tab-only-tech-name"), {
      role: "technician",
      technicianName: "\t\t",
    }));
    await assertFails(setDoc(doc(ownerDb, "Users", "oversized-tech-name"), {
      role: "technician",
      technicianName: "T".repeat(201),
    }));
    await assertFails(updateDoc(doc(ownerDb, "Users", officeUid), {
      role: "invalid-role",
    }));

    await assertSucceeds(updateDoc(doc(ownerDb, "Users", officeUid), {
      displayName: "Updated Office",
    }));
    await assertSucceeds(setDoc(doc(ownerDb, "Users", missingProfileUid), {
      role: "technician",
      technicianName: "Provisioned Technician",
    }));
    await assertSucceeds(setDoc(doc(ownerDb, "Users", "trimmed-valid-technician"), {
      role: "technician",
      technicianName: "  Valid Technician  ",
    }));
    await assertSucceeds(setDoc(doc(ownerDb, "Users", "provisioned-office"), {
      role: "office",
      displayName: "Provisioned Office",
    }));
    await assertSucceeds(deleteDoc(doc(ownerDb, "Users", otherTechnicianUid)));

    console.log("Firestore role-profile escalation matrix passed.");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
