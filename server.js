import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// ----------------------
// Charger le template
// ----------------------
let template;
try {
  const templatePath = path.join(process.cwd(), "template.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("⚠️ template.html introuvable, fallback minimal.");
    template = handlebars.compile("<html><body><h1>Template manquant</h1></body></html>");
  } else {
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    template = handlebars.compile(templateSource);
  }
} catch (err) {
  console.error("❌ Erreur template:", err);
  template = handlebars.compile("<html><body><h1>Erreur template</h1></body></html>");
}

// ----------------------
// Endpoint test
// ----------------------
app.get("/", (req, res) => {
  res.send("✅ PDF Service is running with chrome-aws-lambda");
});

app.get("/test-pdf", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });

    const page = await browser.newPage();
    await page.setContent("<h1>Hello PDF 🚀</h1>");
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("🚨 Erreur test PDF:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Endpoint /generate
// ----------------------
app.post("/generate", async (req, res) => {
  try {
    const { auditData, userDetails, generatedDate } = req.body;

    if (!auditData) {
      return res.status(400).json({ error: "auditData requis" });
    }

    const html = template({
      businessName: userDetails?.name || "Entreprise",
      auditScore: auditData.audit_score,
      audit_results: auditData.audit_results,
      strengths: auditData.audit_results?.strengths,
      criticalIssues: auditData.audit_results?.critical_issues,
      recommendations: auditData.audit_results?.recommendations,
      categoryScores: auditData.audit_results?.category_scores,
      generatedDate,
      scoreBgClass:
        auditData.audit_score >= 80
          ? "green-bg"
          : auditData.audit_score >= 60
          ? "yellow-bg"
          : "red-bg",
      scoreTextColor:
        auditData.audit_score >= 80
          ? "green-text"
          : auditData.audit_score >= 60
          ? "yellow-text"
          : "red-text",
      auditScoreInterpretation:
        auditData.audit_score >= 80
          ? "Votre fiche est très bien optimisée"
          : auditData.audit_score >= 60
          ? "Votre fiche est correcte mais améliorable"
          : "Votre fiche nécessite une optimisation complète"
    });

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("🚨 Erreur génération PDF:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Lancer le serveur
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Service PDF en écoute sur http://localhost:${PORT}`);
});
