import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface JobPosting {
  id: string;
  label: string;
  content: string;
}

interface ProfileData {
  resume: string;
  jobPostings: JobPosting[];
}

interface ProfileContextValue extends ProfileData {
  setResume: (text: string) => void;
  addJobPosting: (label: string, content: string) => void;
  updateJobPosting: (id: string, label: string, content: string) => void;
  deleteJobPosting: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "interview_coach_profile";

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { resume: "", jobPostings: [] };
}

function saveProfile(data: ProfileData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>(loadProfile);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const setResume = (text: string) =>
    setProfile((p) => ({ ...p, resume: text }));

  const addJobPosting = (label: string, content: string) =>
    setProfile((p) => ({
      ...p,
      jobPostings: [
        ...p.jobPostings,
        { id: `posting-${Date.now()}`, label, content },
      ],
    }));

  const updateJobPosting = (id: string, label: string, content: string) =>
    setProfile((p) => ({
      ...p,
      jobPostings: p.jobPostings.map((jp) =>
        jp.id === id ? { ...jp, label, content } : jp
      ),
    }));

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

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
