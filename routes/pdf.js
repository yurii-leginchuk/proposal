const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const Proposal = require('../models/Proposal');
const Screen = require('../models/Screen');
const path = require('path');
const fs = require('fs').promises;

const PAGE_SIZE_REGEX = /--slide-(w|h)\s*:\s*([0-9.]+)(px|cm|mm|in)/i;
const DEFAULT_PAGE_SIZE = { width: '1440px', height: '1024px' };

function detectPageSize(htmlChunks = []) {
  for (const chunk of htmlChunks) {
    if (typeof chunk !== 'string') continue;
    const widthMatch = chunk.match(/--slide-w\s*:\s*([0-9.]+)(px|cm|mm|in)/i);
    const heightMatch = chunk.match(/--slide-h\s*:\s*([0-9.]+)(px|cm|mm|in)/i);
    if (widthMatch && heightMatch) {
      return {
        width: `${widthMatch[1]}${widthMatch[2]}`,
        height: `${heightMatch[1]}${heightMatch[2]}`,
      };
    }
  }
  return DEFAULT_PAGE_SIZE;
}

function unitToPixels(value) {
  const match = value.match(/([0-9.]+)(px|cm|mm|in)/i);
  if (!match) return null;
  const numeric = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'px':
      return numeric;
    case 'in':
      return numeric * 96;
    case 'cm':
      return numeric * 37.795275591;
    case 'mm':
      return numeric * 3.7795275591;
    default:
      return null;
  }
}

function buildGlobalStyle(pageSize) {
  return `
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }
      .screen-page {
        page-break-after: always;
        margin: 0;
      }
      .screen-page:last-child {
        page-break-after: auto;
      }
      :root {
        --slide-w: ${pageSize.width};
        --slide-h: ${pageSize.height};
      }
      @page {
        size: ${pageSize.width} ${pageSize.height};
        margin: 0;
      }
    </style>
  `;
}

async function applyViewport(page, pageSize) {
  const widthPx = unitToPixels(pageSize.width);
  const heightPx = unitToPixels(pageSize.height);
  if (widthPx && heightPx) {
    await page.setViewport({
      width: Math.round(widthPx),
      height: Math.round(heightPx),
    });
  }
}

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

    const screenHtmlBlocks = [];
  for (const item of proposal.screenOrder) {
    if (item.screenId) {
      const screen = item.screenId;
      const screenHtml = screen.editedHtml || screen.originalHtml;
        screenHtmlBlocks.push(screenHtml);
    }
  }

    const pageSize = detectPageSize(screenHtmlBlocks);

    // Створити HTML для PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${buildGlobalStyle(pageSize)}
      </head>
      <body>
    `;

    for (const screenHtml of screenHtmlBlocks) {
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
    await applyViewport(page, pageSize);
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  await page.emulateMediaType('print');

  // Генерувати PDF з параметрами сторінки з CSS
  const pdfBuffer = await page.pdf({
    width: DEFAULT_PAGE_SIZE.width,  
    height: DEFAULT_PAGE_SIZE.height,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    // preferCSSPageSize: true,   // більше не потрібно
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
  const { clientId, templateId, isDefault } = req.body;

  // Отримати екрани в порядку з бази даних
  const query = {};
  if (templateId) {
    query.templateId = templateId;
  } else if (clientId === 'null' || clientId === null || !clientId) {
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

  const screenHtmlBlocks = [];
  for (const screen of screens) {
    const screenHtml = screen.editedHtml || screen.originalHtml;
    screenHtmlBlocks.push(screenHtml);
  }

  const pageSize = detectPageSize(screenHtmlBlocks);

  // Створити HTML для PDF
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${buildGlobalStyle(pageSize)}
    </head>
    <body>
  `;

  for (const screenHtml of screenHtmlBlocks) {
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
  await applyViewport(page, pageSize);
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  // Генерувати PDF
  const pdfBuffer = await page.pdf({
    width: DEFAULT_PAGE_SIZE.width,  
    height: DEFAULT_PAGE_SIZE.height,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    // preferCSSPageSize: true,   // більше не потрібно
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

