/**
 * profile-context.tsx — Global user profile state
 *
 * Provides resume text and saved job postings to the entire app via React
 * context. Data is persisted to localStorage so it survives page reloads.
 *
 * How to use anywhere in the app:
 *   const { resume, setResume, jobPostings, addJobPosting } = useProfile();
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/** A saved job posting the user has labelled and stored for quick access. */
export interface JobPosting {
  id: string;     // unique stable ID (timestamp-based)
  label: string;  // user-provided name, e.g. "Google SWE 2025"
  content: string; // full job posting text
}

/** The shape of all data stored in the profile. */
interface ProfileData {
  resume: string;           // full resume text (plain text, extracted from PDF or pasted)
  jobPostings: JobPosting[]; // list of saved job postings
}

/** Everything the context exposes to consumers. */
interface ProfileContextValue extends ProfileData {
  setResume: (text: string) => void;
  addJobPosting: (label: string, content: string) => void;
  updateJobPosting: (id: string, label: string, content: string) => void;
  deleteJobPosting: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** localStorage key used to persist the profile between sessions. */
const STORAGE_KEY = "interview_coach_profile";

/** Reads the profile from localStorage, or returns empty defaults if missing. */
function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { resume: "", jobPostings: [] };
}

/** Serialises and writes the profile to localStorage. */
function saveProfile(data: ProfileData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * ProfileProvider — wrap your app (or subtree) with this so that
 * any child component can call useProfile() to read/write the profile.
 *
 * Usage (already done in App.tsx):
 *   <ProfileProvider>
 *     <App />
 *   </ProfileProvider>
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  // Load the stored profile once on mount.
  const [profile, setProfile] = useState<ProfileData>(loadProfile);

  // Whenever the profile changes, persist it to localStorage.
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  /** Replace the resume text entirely. */
  const setResume = (text: string) =>
    setProfile((p) => ({ ...p, resume: text }));

  /** Add a new job posting with a generated unique ID. */
  const addJobPosting = (label: string, content: string) =>
    setProfile((p) => ({
      ...p,
      jobPostings: [
        ...p.jobPostings,
        { id: `posting-${Date.now()}`, label, content },
      ],
    }));

  /** Update an existing job posting's label and/or content by ID. */
  const updateJobPosting = (id: string, label: string, content: string) =>
    setProfile((p) => ({
      ...p,
      jobPostings: p.jobPostings.map((jp) =>
        jp.id === id ? { ...jp, label, content } : jp
      ),
    }));

  /** Remove a job posting by ID. */
  const deleteJobPosting = (id: string) =>
    setProfile((p) => ({
      ...p,
      jobPostings: p.jobPostings.filter((jp) => jp.id !== id),
    }));

  return (
    <ProfileContext.Provider
      value={{ ...profile, setResume, addJobPosting, updateJobPosting, deleteJobPosting }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * useProfile — hook to access the user's profile from any component.
 * Must be called inside a component that is a descendant of ProfileProvider.
 */
export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
