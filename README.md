# 🏛️ Integrated Legal AI Workspace

![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-blue)
![Architecture: React %2B Express](https://img.shields.io/badge/Architecture-React%20%7C%20Express%20%7C%20Firestore-success)
![AI: Gemini 3.5 Flash](https://img.shields.io/badge/AI-Gemini%203.5%20Flash-orange)

## 📌 Overview
The **Integrated Legal AI Workspace** is a multi-tenant SaaS application designed to operate as a centralized, premium digital chamber for legal practitioners. Moving beyond generic chatbots, this platform pairs a highly secure, isolated matter-management environment with a cognitive drafting agent powered by Gemini 3.5 Flash, all wrapped in a sleek, professional interface tailored for modern law firms.

## 🚀 Core Features

### 🏢 Secure Multi-Tenant Architecture & Onboarding
* **Chamber Isolation:** Integrated Google Authentication ensures every practitioner is bound to a strictly consolidated Tenant (Firm/Chamber) workspace.
* **Frictionless Onboarding:** Spawn a new Private Independent Chamber (generating a shareable invite code) or join an existing organization instantly using a colleague's code.

### 💳 SaaS Subscription Billing Simulator
* **Tier-Based Access:** Robust plan profiles including *Free Trial*, *Practitioner Pro*, and *Law Firm Enterprise* with defined seat allotments and feature guardrails.
* **Simulated Checkout:** Immersive, PCI-compliant checkout wizard that instantly elevates tenant plans in Firestore, unlocking capacity limits (e.g., removing the 2-case trial limit) and generating mock invoices in Workspace Settings.

### ⚖️ Cognitive Legal AI Drafting Agent
* **Common Law Engine:** A custom Express backend proxy interfaces with Gemini 3.5 Flash (via the `@google/genai` SDK) to draft highly formal, traditional common-law pleadings.
* **Court-Ready Formatting:** Automatically generates standard legal formats including centered court headers, "In the Court Of..." designations, precise paragraph counts, and relief/prayer matrices. 
* **One-Click Archiving:** Save generated drafts directly to the matter's litigation docket folder database or instantly copy for revision.

### 📑 Evidentiary Material Summary & Audit
* **Custom Analytical Formats:** Process raw client testimonies, evidentiary files, or opposition briefs into Brief matter summaries, Detailed legal segments, Issue-Wise dispute matrices (with judicial likelihood assessments), Chronology lists, or IRAC Judicial Case Briefs.
* **Structured Outputs:** Data is rendered dynamically into highly readable grid layouts, tables, and high-contrast checklists for rapid review.

### 📂 Case Management Ledger
* **Factual Chronology:** Map case history milestones visually with custom status badges.
* **Chamber Calendar:** Schedule upcoming hearings, note presiding trial benches, and track case outcomes.
* **Coordination Bulletins:** Publish real-time strategy memos to align with co-counsel and team practitioners.

## 🎨 UI/UX & Visual Identity
The application features a **"Sleek Interface"** designed to evoke the dignity of a judge's chamber while maintaining modern SaaS usability:
* **Typography System:** A clean interface pairing Space Grotesk headings and Inter layout styles, reserving formal Court Serif (Georgia/Times New Roman with justified alignment and double line-heights) strictly for generated pleadings.
* **Unified Blue & Slate Palette:** A premium palette utilizing high-contrast professional blues (`#1e40af`, `#3b82f6`) and deep slate-navy accents (`#12161f`) for analytics cards and navigation rails.
* **Layout:** A responsive dual-column grid featuring a sticky left-hand administrative sidebar and an elegant global header.

## 🏗️ Architecture & Tech Stack
* **Frontend:** React/TypeScript (`App.tsx`, `AuthScreen.tsx`, etc.) for a fast, responsive Single Page Application.
* **Backend:** Node.js & Express (`server.ts`) managing secure custom proxy endpoints for the AI engine.
* **Database:** Google Cloud Firestore handling tenant isolation, subscription plan states, and docket storage.
* **AI Integration:** Google Gemini 3.5 Flash.

## 🛠️ Development & Contribution
While the core web application utilizes a JavaScript/TypeScript stack, our broader engineering workflow for building auxiliary machine learning evaluation tools, data preprocessing scripts, and algorithmic testing relies heavily on coding in Python and debugging in Java to ensure strict backend reliability before API integration.

### Prerequisites
* Node.js (v18+) & npm
* Firebase CLI (for Firestore database configuration)
* Google Gemini API Key

## 📜 Origin & Authorship
This repository serves as the technical implementation of the foundational concept, structural vision, and operational workflow for a comprehensive Legal AI platform as originally conceptualized by **Aishik Lahiri** (Concept Note: May 2026).
