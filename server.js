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
    const { businessName, auditScore, auditData, userDetails, generatedDate } = req.body;

    const html = template({
      businessName,
      auditScore,
      categoryScores: auditData.category_scores,
      strengths: auditData.strengths,
      criticalIssues: auditData.critical_issues,
      recommendations: auditData.recommendations,
      userDetails,
      generatedDate,
      scoreBgClass: auditScore >= 80 ? "green-bg" : auditScore >= 60 ? "yellow-bg" : "red-bg",
      scoreTextColor: auditScore >= 80 ? "green-text" : auditScore >= 60 ? "yellow-text" : "red-text",
      auditScoreInterpretation:
        auditScore >= 80
          ? "Votre fiche est très bien optimisée"
          : auditScore >= 60
          ? "Votre fiche est correcte mais améliorable"
          : "Votre fiche nécessite une optimisation complète",
    });

    const browser = await puppeteer.launch({ headless: "new" });
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
    console.error("Erreur génération PDF:", err);
    res.status(500).json({ error: "Erreur génération PDF", details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Service PDF en écoute sur http://localhost:${PORT}`);
});
