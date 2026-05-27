import { useState, useCallback } from "react";

export interface YtJob {
  id: string;
  title: string;
  createdAt: number;
  srtUrl: string;
  fromLang: string;
  toLang: string;
  videoUrl: string;
  note?: string;
}

const STORAGE_KEY = "yt-history";
const MAX_JOBS = 50;

function readJobs(): YtJob[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeJobs(jobs: YtJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.warn("useYtHistory: localStorage write failed", e);
  }
}

export function useYtHistory() {
  const [jobs, setJobs] = useState<YtJob[]>(readJobs);

  const saveJob = useCallback((data: Omit<YtJob, "id" | "createdAt">): YtJob => {
    const newJob: YtJob = { ...data, id: String(Date.now()), createdAt: Date.now() };
    setJobs((prev) => {
      const updated = [newJob, ...prev].slice(0, MAX_JOBS);
      writeJobs(updated);
      return updated;
    });
    return newJob;
  }, []);

  const deleteJob = useCallback((id: string) => {
    setJobs((prev) => {
      const updated = prev.filter((j) => j.id !== id);
      writeJobs(updated);
      return updated;
    });
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setJobs((prev) => {
      const updated = prev.map((j) => (j.id === id ? { ...j, title } : j));
      writeJobs(updated);
      return updated;
    });
  }, []);

  return { jobs, saveJob, deleteJob, updateTitle };
}
