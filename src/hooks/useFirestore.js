// src/hooks/useFirestore.js
// Small reusable hooks so pages don't each hand-roll onSnapshot boilerplate.

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../config/firebase";

// Live-subscribes to a collection (optionally with query constraints:
// where(), orderBy(), limit() — pass them as extra args).
export function useCollection(collectionName, constraints = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, collectionName), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, JSON.stringify(constraints.map(String))]);

  return { data, loading, error };
}

// Sorts by an ISO date string field and splits into past / upcoming
// relative to right now. Handy for "next lab session" style cards.
export function splitByDate(items, dateField = "date") {
  const now = new Date();
  const upcoming = [];
  const past = [];
  [...items]
    .sort((a, b) => new Date(a[dateField]) - new Date(b[dateField]))
    .forEach((item) => {
      (new Date(item[dateField]) >= now ? upcoming : past).push(item);
    });
  return { upcoming, past };
}
