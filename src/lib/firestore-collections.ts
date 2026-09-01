"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  return null;
}

export function normalize<T extends { id: string }>(id: string, data: DocumentData): T {
  const out: DocumentData = { id, ...data };
  for (const key of Object.keys(out)) {
    if (out[key] instanceof Timestamp) out[key] = toMillis(out[key]);
  }
  return out as T;
}

export function useCollection<T extends { id: string }>(
  path: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => normalize<T>(d.id, d.data())));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(constraints.map((c) => c.type))]);

  return { data, loading, error };
}

export async function createDoc(path: string, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, path), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocById(path: string, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() });
}

export async function setDocById(path: string, id: string, data: Record<string, unknown>) {
  await setDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteDocById(path: string, id: string) {
  await deleteDoc(doc(db, path, id));
}

export const byCreatedDesc: QueryConstraint[] = [orderBy("createdAt", "desc")];
