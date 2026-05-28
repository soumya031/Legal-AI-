/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Ensure Gemini API Key is present but guard initialization
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables!");
}

// Lazy initialization pattern to avoid crashing if API key doesn't load initially
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const app = express();
app.use(express.json({ limit: "50mb" })); // Support larger text pasting for legal documents

// API: Health probe
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API ROUTE: Legal Draft Generation (Server-Side proxying of Gemini API)
app.post("/api/gemini/draft", async (req, res) => {
  const { courtName, applicableLaw, factualBackground, natureOfProceeding, clientRole, opponentName } = req.body;

  if (!courtName || !factualBackground || !natureOfProceeding) {
    res.status(400).json({ error: "Missing required inputs for legal drafting." });
    return;
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `You are an elite legal drafting expert and senior advocate specializing in Indian, Commonwealth, and general international common law systems.
Your job is to generate highly structured, formal, production-ready legal pleadings and documents in HTML format.
Use standard visual layout formats of classical courts:
- Centered, capitalized court headers with spacing
- "IN THE COURT OF..." framing
- Traditional margin spacing and double-spaced alignment
- Numbered paragraphs for legal contentions
- Formal styling: serif text, crisp borders, appropriate titles, and signature blocks.
Maintain extreme professional and formal linguistic discipline. Never add casual explanations before or after the HTML block. Output ONLY clean valid HTML code wrapped in structural classes (like .legal-document) – do NOT use full HTML declarations unless styling embedded elements. Wrap content inside a styled <div class="legal-document">.`;

    const userPrompt = `Generate a comprehensive formal court pleading/draft with the following parameters:
- Court: ${courtName}
- Nature of Proceeding / Document Type: ${natureOfProceeding}
- Client Position/Role: ${clientRole || "Petitioner/Plaintiff"}
- Opponent Details: ${opponentName || "Respondent/Defendant"}
- Applicable Law/Provisions: ${applicableLaw || "General Civil/Criminal Procedure and substantive governing law"}
- Factual Background / Context: ${factualBackground}

Please ensure the generated legal draft is perfectly structured, highly detailed, uses precise legal jargon, incorporates sections for jurisdiction, facts of the case, grounds of petition, and absolute formal prayers / relief sought, ending with Verification and Solemn Affirmations. Do not return markdown wraps like \`\`\`html. Return ONLY raw legal HTML text inside <div class="legal-document">.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.3, // Consistent, structured legal definitions
      }
    });

    const generatedHtml = response.text || "<div>Failed to generate legal draft content</div>";
    res.json({ draftHtml: generatedHtml });

  } catch (error: any) {
    console.error("Gemini Drafting Error:", error);
    res.status(500).json({ error: error.message || "An error occurred while generating the legal draft." });
  }
});

// API ROUTE: Document Legal AI Summary (Server-Side proxying of Gemini API)
app.post("/api/gemini/summarize", async (req, res) => {
  const { title, content, summaryType } = req.body;

  if (!content) {
    res.status(400).json({ error: "No document text content provided." });
    return;
  }

  try {
    const ai = getGeminiClient();

    let modelFocus = "";
    switch (summaryType) {
      case "brief":
        modelFocus = "Provide a brief matter summary (1-2 paragraphs) capturing the essence, the core conflict, the key parties, and status.";
        break;
      case "detailed":
        modelFocus = `Provide a highly detailed legal summary segmented into:
1. Introduction & Background
2. Summary of Key Pleadings and Statements
3. Disputed Facts vs. Undisputed Facts
4. Legal Questions and Substantive Issues
5. Relevant Statutory Provisions or Case Laws Cited
6. Conclusion & Recommendations. Use clean, professional headings in HTML formatting.`;
        break;
      case "issues":
        modelFocus = "Identify the core underlying Legal Issues, the contentions of both parties regarding each issue, and a strategic assessment of how a court or judge is likely to resolve each issue based on common law doctrine. Structure as a clean HTML grid/table or list.";
        break;
      case "chronology":
        modelFocus = "Extract all significant dates, letters, filings, responses, hearings, and historical actions described in the text. Format them as an elegant, clean chronological HTML list or grid containing date columns and event descriptions, ordered chronologically.";
        break;
      case "case_brief":
        modelFocus = "Analyze the text and produce a classic IRAC Case Brief (Issue, Rule of Law, Application/Analysis, and Conclusion) structured in formal appellate review format.";
        break;
      case "hearing_prep":
        modelFocus = "Based on the text, create action-oriented Hearing Preparation Notes: list critical action items for counsel, sample cross-examination/examination questions to ask witnesses, key vulnerable elements in the opponent's case to expose, and critical files to double-check. Format in high-contrast checklist styles.";
        break;
      default:
        modelFocus = "Provide a general detailed summary of this legal material in neat headings.";
    }

    const systemInstruction = `You are an elite Senior Legal Research Associate and Supreme Court Judicial Clerk.
Your job is to read legal files, testimonies, or pleadings and produce analytical reports in crisp HTML format.
Use precise typography, spacing, tables, or high-contrast list indicators.
Output ONLY clean HTML formatting (no outer wrapping template, no markdown tick enclosures like \`\`\`html) to display on a card. Start within a <div class="legal-summary">.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Document Title: ${title || "Untitled Legal Material"}
Analysis Request: ${modelFocus}
Target Text:
${content}`,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    const summaryHtml = response.text || "<div>Failed to summarize content</div>";
    res.json({ summaryHtml });

  } catch (error: any) {
    console.error("Gemini Summarization Error:", error);
    res.status(500).json({ error: error.message || "An error occurred while summarizing legal document." });
  }
});

// Configure Vite middleware in development vs static path in production
async function runServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Legal AI Workspace running on http://localhost:${PORT}`);
  });
}

runServer();
