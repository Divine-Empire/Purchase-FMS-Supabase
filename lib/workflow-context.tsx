"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export interface WorkflowRecord {
  id: string;
  stage: number;
  data: Record<string, any>;
  createdAt: Date;
  status: "pending" | "completed";
  history: { stage: number; data: Record<string, any>; date: Date }[];
}

interface WorkflowContextType {
  records: WorkflowRecord[];
  indentCounter: number;
  setIndentCounter: (counter: number | ((prev: number) => number)) => void;
  addRecord: (stageNum: number, data: Record<string, any>) => WorkflowRecord;
  moveToNextStage: (recordId: string) => void;
  updateRecord: (recordId: string, data: Record<string, any>) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined
);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<WorkflowRecord[]>([]);
  const [indentCounter, setIndentCounter] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedRecords = localStorage.getItem("workflow-records");
      if (savedRecords) {
        const parsed = JSON.parse(savedRecords);
        const restoredRecords = parsed.map((r: any) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          history: r.history.map((h: any) => ({ ...h, date: new Date(h.date) })),
        }));
        setRecords(restoredRecords);
      }
      
      const savedCounter = localStorage.getItem("indent-counter");
      if (savedCounter) {
        setIndentCounter(parseInt(savedCounter, 10));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save records to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("workflow-records", JSON.stringify(records));
      } catch (error) {
        console.error("Error saving records to localStorage:", error);
      }
    }
  }, [records, isLoaded]);

  // Save counter to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("indent-counter", indentCounter.toString());
      } catch (error) {
        console.error("Error saving counter to localStorage:", error);
      }
    }
  }, [indentCounter, isLoaded]);

  const addRecord = (stageNum: number, data: Record<string, any>) => {
    const newRecord: WorkflowRecord = {
      id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      stage: stageNum,
      data,
      createdAt: new Date(),
      status: "pending",
      history: [],
    };
    setRecords((prev) => [newRecord, ...prev]);
    return newRecord;
  };

  const moveToNextStage = (recordId: string) => {
    setRecords((prev) =>
      prev.map((record) => {
        if (record.id === recordId && record.stage < 14) {
          return {
            ...record,
            stage: record.stage + 1,
            history: [
              ...record.history,
              { stage: record.stage, data: { ...record.data }, date: new Date() },
            ],
          };
        }
        if (record.id === recordId && record.stage === 14) {
          return { ...record, status: "completed" };
        }
        return record;
      })
    );
  };

  const updateRecord = (recordId: string, data: Record<string, any>) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? { ...record, data: { ...record.data, ...data } }
          : record
      )
    );
  };

  return (
    <WorkflowContext.Provider
      value={{
        records,
        indentCounter,
        setIndentCounter,
        addRecord,
        moveToNextStage,
        updateRecord,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context)
    throw new Error("useWorkflow must be used within WorkflowProvider");
  return context;
}
