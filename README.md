# PulseQ — Lightweight Zero-Login Classroom Q&A HUD

PulseQ is a real-time, zero-login live Q&A HUD engineered for classrooms and lecture halls. Students can submit questions anonymously and upvote peers' doubts, streaming them into a prioritized queue on the instructor's display with single-click lifecycle controls (Pending $\to$ Answering $\to$ Resolved) and post-session CSV/Markdown exports.

---

## ⚡ Key Features

- **Ephemeral Zero-Login Join (FR-1.1, FR-1.2)**: 6-character room codes (e.g. `MATH42`) and vector QR codes for instant student camera scan without accounts, emails, or names.
- **Anonymous Doubt Submission (FR-2.1)**: 280-character maximum input with live character counter and optional "Slide / Section #" tagging (e.g., `Slide 12`, `Step 3`).
- **Real-Time Peer Upvoting (FR-2.2)**: 1-click upvoting with strict deduplication (1 upvote per session ID) and instant $(<300\text{ms})$ re-ordering.
- **Instructor Priority HUD (FR-3.1, FR-3.2)**:
  - Dynamic queue auto-sorted by highest upvotes.
  - Active Spotlight banner when an instructor starts answering.
  - Single-click lifecycle transitions (`Pending` $\to$ `Answering` $\to$ `Resolved`).
  - Slide filter chips & live search.
- **Post-Session Export (FR-4)**: One-click CSV and Markdown summary generation with lecture topic, resolved doubts, upvote counts, and timestamps.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, TypeScript
- **QR Engine**: `qrcode.react` (client-side SVG)
- **Testing**: Vitest & TypeScript E2E Verification Suite

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build & Run Production Server
```bash
npm run build
npm start
```
Default server port: `http://localhost:3000`

---

## 🧪 Testing

Run automated unit and integration tests:
```bash
npm test
```

Run end-to-end Socket lifecycle verification:
```bash
npx tsx test/e2e_verify.ts
```
