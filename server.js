import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-extra";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// Charger le template
const templatePath = path.join(process.cwd(), "template.html");
const templateSource = fs.readFileSync(templatePath, "utf-8");
const template = handlebars.compile(templateSource);

// Helper pour afficher JSON
handlebars.registerHelper("json", (context) => JSON.stringify(context));

app.post("/generate-pdf", async (req, res) => {
  try {
    const { auditId, auditData, userDetails, generatedDate } = req.body;

    // On utilise auditData (historique, pas businessName etc.)
    if (!auditData) {
      return res.status(400).json({ error: "auditData requis" });
    }

    const html = template({
      audit_score: auditData.audit_score,
      audit_results: auditData.audit_results,
      strengths: auditData.audit_results?.strengths,
      criticalIssues: auditData.audit_results?.critical_issues,
      recommendations: auditData.audit_results?.recommendations,
      categoryScores: auditData.audit_results?.category_scores,
      userDetails,
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
          : "Votre fiche nécessite une optimisation complète",
    });

    // 🚀 Puppeteer config pour Render (no-sandbox obligatoire)
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("🚨 Erreur génération PDF:", err);
    res.status(500).json({
      error: "Erreur génération PDF",
      details: err.message,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Service PDF en écoute sur http://localhost:${PORT}`);
});

