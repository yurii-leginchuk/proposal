const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const Proposal = require('../models/Proposal');
const Screen = require('../models/Screen');
const path = require('path');
const fs = require('fs').promises;

// Генерація PDF з пропозиції
router.post('/generate/:proposalId', async (req, res) => {
  let browser = null;

  try {
    const proposal = await Proposal.findById(req.params.proposalId)
      .populate('screenOrder.screenId');

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (!proposal.screenOrder || proposal.screenOrder.length === 0) {
      return res.status(400).json({ error: 'Proposal has no screens' });
    }

    // Створити HTML для PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .screen-page {
            page-break-after: always;
            margin: 0;
            padding: 20px;
          }
          .screen-page:last-child {
            page-break-after: auto;
          }
        </style>
      </head>
      <body>
    `;

    // Додати екрани у вказаному порядку (з proposal.screenOrder)
    for (const item of proposal.screenOrder) {
      if (item.screenId) {
        const screen = item.screenId;
        const screenHtml = screen.editedHtml || screen.originalHtml;
        htmlContent += `<div class="screen-page">${screenHtml}</div>`;
      }
    }

    htmlContent += `
      </body>
      </html>
    `;

    // Запустити Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Генерувати PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();
    browser = null;

    // Зберегти PDF
    const outputDir = path.join(__dirname, '..', 'generated');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Директорія вже існує
    }

    const fileName = `${proposal.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    // Відправити PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Генерація PDF з кастомного порядку (використовує порядок з бази даних)
router.post('/generate-custom', async (req, res) => {
  let browser = null;

  try {
    const { clientId, isDefault } = req.body;

    // Отримати екрани в порядку з бази даних
    const query = {};
    if (clientId === 'null' || clientId === null || !clientId) {
      query.isDefault = true;
    } else if (clientId) {
      query.clientId = clientId;
    } else if (isDefault === 'true' || isDefault === true) {
      query.isDefault = true;
    } else {
      query.isDefault = true;
    }

    const screens = await Screen.find(query).sort({ order: 1 });

    if (screens.length === 0) {
      return res.status(400).json({ error: 'No screens found' });
    }

    // Створити HTML для PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
          }
          .screen-page {
            page-break-after: always;
            margin: 0;
          }
          .screen-page:last-child {
            page-break-after: auto;
          }
        </style>
      </head>
      <body>
    `;

    // Додати екрани у порядку з бази даних (вже відсортовані по order)
    for (const screen of screens) {
      const screenHtml = screen.editedHtml || screen.originalHtml;
      htmlContent += `<div class="screen-page">${screenHtml}</div>`;
    }

    htmlContent += `
      </body>
      </html>
    `;

    // Запустити Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Генерувати PDF
    const pdfBuffer = await page.pdf({
      //format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    await browser.close();
    browser = null;

    // Відправити PDF
    const fileName = `proposal_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

