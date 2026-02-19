import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { LABELS as IT_LABELS } from './report-labels/it';
import { LABELS as EN_LABELS } from './report-labels/en';
import type { ReportLabels } from './report-labels/it';
import { getNormById } from '@/lib/legal-norms/query';

export interface ReportData {
  contractFilename: string;
  analysisDate: string;
  executiveSummary: string;
  counts: { total: number; strengths: number; importante: number; consigliato: number; suggerimento: number };
  findings: Array<{
    title: string | null;
    type: string | null;
    severity: string;
    clauseText: string;
    explanation: string;
    redlineSuggestion: string | null;
  }>;
  language?: string; // 'it' | 'en', defaults to 'it'
  // Enhanced fields (optional for backward compat)
  enhanced?: boolean;
  metadata?: {
    partyA: string | null;
    partyB: string | null;
    contractType: string | null;
    jurisdiction: string | null;
  };
  findingsByActor?: {
    partyA: Array<ReportData['findings'][0] & { normIds?: string[] }>;
    partyB: Array<ReportData['findings'][0] & { normIds?: string[] }>;
    general: Array<ReportData['findings'][0] & { normIds?: string[] }>;
  };
}

const MARGIN = { top: 50, bottom: 50, left: 40, right: 40 };
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;

const COLORS = {
  primary: rgb(0.118, 0.227, 0.541),
  black: rgb(0.059, 0.09, 0.165),
  gray: rgb(0.396, 0.455, 0.525),
  lightGray: rgb(0.886, 0.906, 0.929),
  white: rgb(1, 1, 1),
  strength: rgb(0.059, 0.631, 0.443),
  importante: rgb(0.882, 0.243, 0.318),
  consigliato: rgb(0.835, 0.635, 0.035),
  suggerimento: rgb(0.231, 0.51, 0.961),
  redlineBox: rgb(1, 0.976, 0.922),
  redlineBorder: rgb(0.961, 0.804, 0.447),
  normBadge: rgb(0.929, 0.949, 0.996),
  normBorder: rgb(0.678, 0.749, 0.894),
};

const PRIORITY_COLORS: Record<string, ReturnType<typeof rgb>> = {
  importante: COLORS.importante,
  consigliato: COLORS.consigliato,
  suggerimento: COLORS.suggerimento,
};

function wrapText(text: string, maxWidth: number, fontSize: number, charWidth: number): string[] {
  const avgCharPerLine = Math.floor(maxWidth / (fontSize * charWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > avgCharPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateReportPDF(data: ReportData): Promise<Uint8Array> {
  // Select labels based on language
  const labels: ReportLabels = data.language === 'en' ? EN_LABELS : IT_LABELS;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN.top;
  let pageNum = 1;

  function addPage() {
    drawFooter(page, fontRegular, pageNum);
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN.top;
    pageNum++;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN.bottom) addPage();
  }

  function drawFooter(p: typeof page, font: typeof fontRegular, num: number) {
    p.drawText(labels.footerDisclaimer, {
      x: MARGIN.left, y: 25, size: 7, font, color: COLORS.gray,
    });
    const pageText = `${labels.pageLabel} ${num}`;
    const pw = font.widthOfTextAtSize(pageText, 7);
    p.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN.right - pw, y: 25, size: 7, font, color: COLORS.gray,
    });
  }

  // === COVER ===
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 120, width: PAGE_WIDTH, height: 120, color: COLORS.primary,
  });

  page.drawText('ContractGuardian', {
    x: MARGIN.left, y: PAGE_HEIGHT - 55, size: 28, font: fontBold, color: COLORS.white,
  });

  page.drawText(labels.coverTitle, {
    x: MARGIN.left, y: PAGE_HEIGHT - 85, size: 14, font: fontRegular, color: rgb(0.75, 0.82, 0.92),
  });

  y = PAGE_HEIGHT - 160;

  // Contract info
  page.drawText(labels.contractLabel, {
    x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
  });
  page.drawText(data.contractFilename, {
    x: MARGIN.left + 70, y, size: 10, font: fontRegular, color: COLORS.black,
  });

  y -= 20;
  page.drawText(labels.dateLabel, {
    x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
  });
  page.drawText(data.analysisDate, {
    x: MARGIN.left + 70, y, size: 10, font: fontRegular, color: COLORS.black,
  });

  y -= 20;
  page.drawText(labels.totalFindingsLabel, {
    x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
  });
  page.drawText(String(data.counts.total), {
    x: MARGIN.left + 90, y, size: 10, font: fontRegular, color: COLORS.black,
  });

  // Count summary boxes
  y -= 40;
  const boxWidth = (CONTENT_WIDTH - 30) / 4;
  const countBoxes = [
    { label: labels.strengthBox, count: data.counts.strengths, color: COLORS.strength },
    { label: labels.importantiBox, count: data.counts.importante, color: COLORS.importante },
    { label: labels.consigliatiBox, count: data.counts.consigliato, color: COLORS.consigliato },
    { label: labels.suggerimentiBox, count: data.counts.suggerimento, color: COLORS.suggerimento },
  ];

  countBoxes.forEach((s, i) => {
    const x = MARGIN.left + i * (boxWidth + 10);
    page.drawRectangle({ x, y: y - 35, width: boxWidth, height: 45, color: COLORS.lightGray, borderColor: s.color, borderWidth: 2 });
    const countText = String(s.count);
    const cw = fontBold.widthOfTextAtSize(countText, 20);
    page.drawText(countText, { x: x + (boxWidth - cw) / 2, y: y - 10, size: 20, font: fontBold, color: s.color });
    const lw = fontRegular.widthOfTextAtSize(s.label, 9);
    page.drawText(s.label, { x: x + (boxWidth - lw) / 2, y: y - 28, size: 9, font: fontRegular, color: COLORS.gray });
  });

  // === METADATA SECTION (enhanced only, on cover page below summary boxes) ===
  function drawMetadataSection() {
    ensureSpace(120);

    // Section title
    page.drawText(labels.metadataTitle, {
      x: MARGIN.left, y, size: 16, font: fontBold, color: COLORS.primary,
    });
    y -= 8;
    page.drawRectangle({ x: MARGIN.left, y, width: 80, height: 2, color: COLORS.primary });
    y -= 25;

    // Party A
    if (data.metadata!.partyA) {
      page.drawText(labels.partyALabel, {
        x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
      });
      page.drawText(data.metadata!.partyA, {
        x: MARGIN.left + 90, y, size: 10, font: fontRegular, color: COLORS.black,
      });
      y -= 18;
    }

    // Party B
    if (data.metadata!.partyB) {
      page.drawText(labels.partyBLabel, {
        x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
      });
      page.drawText(data.metadata!.partyB, {
        x: MARGIN.left + 90, y, size: 10, font: fontRegular, color: COLORS.black,
      });
      y -= 18;
    }

    // Contract Type
    if (data.metadata!.contractType) {
      page.drawText(labels.contractTypeLabel, {
        x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
      });
      const typeLabel = labels.contractTypes[data.metadata!.contractType] || data.metadata!.contractType;
      page.drawText(typeLabel, {
        x: MARGIN.left + 90, y, size: 10, font: fontRegular, color: COLORS.black,
      });
      y -= 18;
    }

    // Jurisdiction
    if (data.metadata!.jurisdiction) {
      page.drawText(labels.jurisdictionLabel, {
        x: MARGIN.left, y, size: 10, font: fontBold, color: COLORS.gray,
      });
      const jurisLabel = labels.jurisdictions[data.metadata!.jurisdiction] || data.metadata!.jurisdiction;
      page.drawText(jurisLabel, {
        x: MARGIN.left + 90, y, size: 10, font: fontRegular, color: COLORS.black,
      });
      y -= 18;
    }

    y -= 15; // Extra spacing after metadata
  }

  if (data.enhanced && data.metadata) {
    y -= 30;
    drawMetadataSection();
  }

  // === EXECUTIVE SUMMARY ===
  addPage();

  page.drawText(labels.executiveSummaryTitle, {
    x: MARGIN.left, y, size: 18, font: fontBold, color: COLORS.primary,
  });
  y -= 8;
  page.drawRectangle({ x: MARGIN.left, y, width: 80, height: 2, color: COLORS.primary });
  y -= 20;

  const summaryLines = wrapText(data.executiveSummary, CONTENT_WIDTH, 10, 0.5);
  for (const line of summaryLines) {
    ensureSpace(14);
    page.drawText(line, { x: MARGIN.left, y, size: 10, font: fontRegular, color: COLORS.black });
    y -= 14;
  }

  // === FINDINGS ===
  if (data.enhanced && data.findingsByActor) {
    // Enhanced: Actor-grouped rendering
    const actorGroups = [
      {
        findings: data.findingsByActor.partyA,
        title: labels.actorSectionPartyA(data.metadata?.partyA || 'Parte A'),
      },
      {
        findings: data.findingsByActor.partyB,
        title: labels.actorSectionPartyB(data.metadata?.partyB || 'Parte B'),
      },
      {
        findings: data.findingsByActor.general,
        title: labels.actorSectionGeneral,
      },
    ];

    for (const group of actorGroups) {
      if (group.findings.length === 0) continue; // Skip empty groups

      y -= 30;
      ensureSpace(30);
      page.drawText(group.title, {
        x: MARGIN.left, y, size: 16, font: fontBold, color: COLORS.primary,
      });
      y -= 8;
      page.drawRectangle({ x: MARGIN.left, y, width: 100, height: 2, color: COLORS.primary });
      y -= 25;

      for (const finding of group.findings) {
        const priorityColor = PRIORITY_COLORS[finding.severity] ?? COLORS.gray;
        const priorityLabel = finding.severity === 'importante' ? labels.priorityImportante :
                              finding.severity === 'consigliato' ? labels.priorityConsigliato :
                              finding.severity === 'suggerimento' ? labels.prioritySuggerimento :
                              finding.type === 'strength' ? labels.priorityStrength :
                              finding.severity.toUpperCase();
        const accentColor = finding.type === 'strength' ? COLORS.strength : priorityColor;
        drawFinding(finding, accentColor, priorityLabel);
      }
    }
  } else {
    // Legacy: Existing strengths + improvements rendering
    const strengths = data.findings.filter((f) => f.type === 'strength');
    const improvements = data.findings.filter((f) => f.type !== 'strength');

    // Strengths section
    if (strengths.length > 0) {
      y -= 30;
      ensureSpace(30);
      page.drawText(labels.strengthsTitle, {
        x: MARGIN.left, y, size: 18, font: fontBold, color: COLORS.strength,
      });
      y -= 8;
      page.drawRectangle({ x: MARGIN.left, y, width: 60, height: 2, color: COLORS.strength });
      y -= 25;

      for (const finding of strengths) {
        drawFinding(finding, COLORS.strength, labels.priorityStrength);
      }
    }

    // Improvements section
    if (improvements.length > 0) {
      y -= 30;
      ensureSpace(30);
      page.drawText(labels.improvementsTitle, {
        x: MARGIN.left, y, size: 18, font: fontBold, color: COLORS.primary,
      });
      y -= 8;
      page.drawRectangle({ x: MARGIN.left, y, width: 80, height: 2, color: COLORS.primary });
      y -= 25;

      for (const finding of improvements) {
        const priorityColor = PRIORITY_COLORS[finding.severity] ?? COLORS.gray;
        const priorityLabel = finding.severity === 'importante' ? labels.priorityImportante :
                              finding.severity === 'consigliato' ? labels.priorityConsigliato :
                              finding.severity === 'suggerimento' ? labels.prioritySuggerimento :
                              finding.severity.toUpperCase();
        drawFinding(finding, priorityColor, priorityLabel);
      }
    }
  }

  function drawFinding(finding: ReportData['findings'][0], accentColor: ReturnType<typeof rgb>, badgeLabel: string) {
    const titleText = finding.title ?? finding.clauseText.slice(0, 80);
    const clauseLines = wrapText(finding.clauseText, CONTENT_WIDTH - 20, 9, 0.48);
    const explanationLines = wrapText(finding.explanation, CONTENT_WIDTH - 20, 9, 0.48);
    const redlineLines = finding.redlineSuggestion
      ? wrapText(finding.redlineSuggestion, CONTENT_WIDTH - 30, 9, 0.48)
      : [];
    const estimatedHeight = 30 + clauseLines.length * 12 + 20 + explanationLines.length * 12 + (redlineLines.length > 0 ? 25 + redlineLines.length * 12 : 0) + 15;

    ensureSpace(Math.min(estimatedHeight, 200));

    // Left border
    page.drawRectangle({
      x: MARGIN.left, y: y - estimatedHeight + 10, width: 3, height: estimatedHeight - 5, color: accentColor,
    });

    // Badge
    const badgeWidth = fontBold.widthOfTextAtSize(badgeLabel, 8) + 12;
    page.drawRectangle({
      x: MARGIN.left + 10, y: y - 10, width: badgeWidth, height: 15, color: accentColor,
    });
    page.drawText(badgeLabel, {
      x: MARGIN.left + 16, y: y - 6, size: 8, font: fontBold, color: COLORS.white,
    });

    // Title
    const titleLines = wrapText(titleText, CONTENT_WIDTH - badgeWidth - 30, 9, 0.48);
    page.drawText(titleLines[0] ?? '', {
      x: MARGIN.left + 15 + badgeWidth + 5, y: y - 6, size: 9, font: fontBold, color: COLORS.black,
    });

    y -= 25;

    // Clause text
    page.drawText(labels.clauseLabel, {
      x: MARGIN.left + 10, y, size: 8, font: fontBold, color: COLORS.gray,
    });
    y -= 13;
    for (const line of clauseLines) {
      ensureSpace(12);
      page.drawText(line, { x: MARGIN.left + 15, y, size: 9, font: fontRegular, color: COLORS.black });
      y -= 12;
    }

    y -= 5;

    // Explanation
    ensureSpace(14);
    page.drawText(labels.explanationLabel, {
      x: MARGIN.left + 10, y, size: 8, font: fontBold, color: COLORS.gray,
    });
    y -= 13;
    for (const line of explanationLines) {
      ensureSpace(12);
      page.drawText(line, { x: MARGIN.left + 15, y, size: 9, font: fontRegular, color: COLORS.black });
      y -= 12;
    }

    // Norm citations (enhanced findings only)
    const findingWithNorms = finding as ReportData['findings'][0] & { normIds?: string[] };
    if (findingWithNorms.normIds && findingWithNorms.normIds.length > 0) {
      y -= 8;
      ensureSpace(20);

      page.drawText(labels.normCitationsLabel, {
        x: MARGIN.left + 10, y, size: 8, font: fontBold, color: COLORS.gray,
      });
      y -= 14;

      let xOffset = MARGIN.left + 15;
      for (const normId of findingWithNorms.normIds) {
        const norm = getNormById(normId);
        if (!norm) continue;

        const badgeText = norm.citation;
        const badgeWidth = fontRegular.widthOfTextAtSize(badgeText, 8) + 10;

        // Line wrap check
        if (xOffset + badgeWidth > PAGE_WIDTH - MARGIN.right) {
          y -= 16;
          xOffset = MARGIN.left + 15;
          ensureSpace(16);
        }

        // Badge background
        page.drawRectangle({
          x: xOffset, y: y - 3, width: badgeWidth, height: 14,
          color: COLORS.normBadge, borderColor: COLORS.normBorder, borderWidth: 0.5,
        });

        // Badge text
        page.drawText(badgeText, {
          x: xOffset + 5, y: y + 1, size: 8, font: fontRegular, color: COLORS.primary,
        });

        xOffset += badgeWidth + 6;
      }

      y -= 18; // spacing after norm badges
    }

    // Redline suggestion (only for improvements)
    if (redlineLines.length > 0 && finding.type !== 'strength') {
      y -= 8;
      ensureSpace(30 + redlineLines.length * 12);

      page.drawText(labels.redlineLabel, {
        x: MARGIN.left + 10, y, size: 8, font: fontBold, color: COLORS.gray,
      });
      y -= 5;

      const boxHeight = 10 + redlineLines.length * 12;
      page.drawRectangle({
        x: MARGIN.left + 12, y: y - boxHeight, width: CONTENT_WIDTH - 25, height: boxHeight,
        color: COLORS.redlineBox, borderColor: COLORS.redlineBorder, borderWidth: 0.5,
      });

      y -= 10;
      for (const line of redlineLines) {
        page.drawText(line, { x: MARGIN.left + 18, y, size: 9, font: fontRegular, color: rgb(0.45, 0.3, 0.02) });
        y -= 12;
      }
    }

    y -= 20;
  }

  // Footer on last page
  drawFooter(page, fontRegular, pageNum);

  return doc.save();
}
