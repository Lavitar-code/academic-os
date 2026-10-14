import Dexie from "dexie";

export const db = new Dexie("academic_os");

// v1
db.version(1).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode",
  focus_checks: "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear",
  plans: "++id,date,plannedMinutes",
});

// v2
db.version(2).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode,sessionType",
  focus_checks:
    "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear,sessionType",
  plans: "++id,date,plannedMinutes",
  doubts: "++id,createdAt,subjectId,topicId,status,sessionId",
});

// v3
db.version(3).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode,sessionType",
  focus_checks:
    "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear,sessionType",
  plans: "++id,date,plannedMinutes",
  doubts: "++id,createdAt,subjectId,topicId,status,sessionId",
  documents: "++id,createdAt,subjectId",
});

// v4
db.version(4).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode,sessionType",
  focus_checks:
    "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear,sessionType",
  plans: "++id,date,plannedMinutes",
  doubts: "++id,createdAt,subjectId,topicId,status,sessionId",
  documents: "++id,createdAt,subjectId",
  review_items: "++id,[subjectId+hash],subjectId,createdAt,status,lastReviewedAt",
});

// v5
db.version(5).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode,sessionType",
  focus_checks:
    "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear,sessionType",
  plans: "++id,date,plannedMinutes",
  doubts: "++id,createdAt,subjectId,topicId,status,sessionId",
  documents: "++id,createdAt,subjectId",
  review_items: "++id,[subjectId+hash],subjectId,status,dueAt,createdAt,lastReviewedAt",
});

// ✅ v6: subjects include activeDocumentId (no schema change needed besides bump)
db.version(6).stores({
  subjects: "++id,name",
  topics: "++id,subjectId,name",
  sessions: "++id,startedAt,endedAt,subjectId,topicId,durationSeconds,mode,sessionType",
  focus_checks:
    "++id,createdAt,sessionId,subjectId,topicId,rating,summary,unclear,sessionType",
  plans: "++id,date,plannedMinutes",
  doubts: "++id,createdAt,subjectId,topicId,status,sessionId",
  documents: "++id,createdAt,subjectId",
  review_items: "++id,[subjectId+hash],subjectId,status,dueAt,createdAt,lastReviewedAt",
});

export async function seedIfEmpty() {
  return;
}