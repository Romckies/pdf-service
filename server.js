import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";       // Puppeteer léger
import chromium from "chrome-aws-lambda";     // Chromium optimisé serverless
import handlebars from "handlebars";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// ----------------------
// Chargement du template
// ----------------------
let template;
try {
  const templatePath = path.join(process.cwd(), "template.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("⚠️ template.html introuvable. Le PDF risque de ne pas fonctionner.");
    template = handlebars.compile("<html><body><h1>Template manquant</h1></body></html>");
  } else {
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    template = handlebars.compile(templateSource);
  }
} catch (err) {
  console.error("❌ Erreur chargement template:", err);
  template = handlebars.compile("<html><body><h1>Erreur template</h1></body></html>");
}

// Helper pour debug JSON dans le template
handlebars.registerHelper("json", (context) => JSON.stringify(context, null, 2));

// ----------------------
// Endpoint racine
// ----------------------
app.get("/", (req, res) => {
  res.send("✅ PDF Service is running");
});

// ----------------------
// Endpoint test simple PDF
// ----------------------
app.get("/test-pdf", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent("<h1>Hello World depuis Optileo 🚀</h1>");
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    console.log("✅ PDF test généré. Taille:", pdf.length);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("🚨 Erreur test PDF:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Endpoint génération PDF audit
// ----------------------
app.post("/generate-pdf", async (req, res) => {
  try {
    const { auditData, userDetails, generatedDate } = req.body;

    if (!auditData) {
      return res.status(400).json({ error: "auditData requis" });
    }

    // Préparer HTML avec Handlebars
    const html = template({
      auditScore: auditData.audit_score,
      audit_results: auditData.audit_results,
      strengths: auditData.audit_results?.strengths,
      criticalIssues: auditData.audit_results?.critical_issues,
      recommendations: auditData.audit_results?.recommendations,
      categoryScores: auditData.audit_results?.category_scores,
      userDetails,
      generatedDate,
      scoreBgClass:
        auditData.audit_score >= 80 ? "green-bg"
        : auditData.audit_score >= 60 ? "yellow-bg"
        : "red-bg",
      scoreTextColor:
        auditData.audit_score >= 80 ? "green-text"
        : auditData.audit_score >= 60 ? "yellow-text"
        : "red-text",
      auditScoreInterpretation:
        auditData.audit_score >= 80
          ? "Votre fiche est très bien optimisée"
          : auditData.audit_score >= 60
          ? "Votre fiche est correcte mais améliorable"
          : "Votre fiche nécessite une optimisation complète"
    });

    // Lancement Chromium via chrome-aws-lambda
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    console.log("✅ PDF audit généré. Taille:", pdf.length);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("🚨 Erreur génération PDF:", err);
    res.status(500).json({
      error: "Erreur génération PDF",
      details: err.message
    });
  }
});

// ----------------------
// Lancement serveur
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Service PDF en écoute sur http://localhost:${PORT}`);
});
