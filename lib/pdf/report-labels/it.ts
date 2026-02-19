export interface ReportLabels {
  coverTitle: string;
  contractLabel: string;
  dateLabel: string;
  totalFindingsLabel: string;
  strengthBox: string;
  importantiBox: string;
  consigliatiBox: string;
  suggerimentiBox: string;
  priorityImportante: string;
  priorityConsigliato: string;
  prioritySuggerimento: string;
  priorityStrength: string;
  executiveSummaryTitle: string;
  strengthsTitle: string;
  improvementsTitle: string;
  clauseLabel: string;
  explanationLabel: string;
  redlineLabel: string;
  footerDisclaimer: string;
  pageLabel: string;
  // Metadata section
  metadataTitle: string;
  partyALabel: string;
  partyBLabel: string;
  contractTypeLabel: string;
  jurisdictionLabel: string;
  // Contract type translations for PDF (static, not using next-intl)
  contractTypes: Record<string, string>;
  // Jurisdiction translations for PDF
  jurisdictions: Record<string, string>;
  // Actor section headers (functions that take party name)
  actorSectionPartyA: (name: string) => string;
  actorSectionPartyB: (name: string) => string;
  actorSectionGeneral: string;
  // Norm citation label
  normCitationsLabel: string;
}

export const LABELS: ReportLabels = {
  coverTitle: 'Report Analisi Contrattuale',
  contractLabel: 'Contratto:',
  dateLabel: 'Data analisi:',
  totalFindingsLabel: 'Findings totali:',
  strengthBox: 'Forza',
  importantiBox: 'Importanti',
  consigliatiBox: 'Consigliati',
  suggerimentiBox: 'Suggerimenti',
  priorityImportante: 'IMPORTANTE',
  priorityConsigliato: 'CONSIGLIATO',
  prioritySuggerimento: 'SUGGERIMENTO',
  priorityStrength: 'PUNTO DI FORZA',
  executiveSummaryTitle: 'Riepilogo Esecutivo',
  strengthsTitle: 'Punti di Forza',
  improvementsTitle: 'Aree di Miglioramento',
  clauseLabel: 'Clausola:',
  explanationLabel: 'Spiegazione:',
  redlineLabel: 'Suggerimento di modifica:',
  footerDisclaimer: 'ContractGuardian — Analisi generata da intelligenza artificiale. Non costituisce consulenza legale.',
  pageLabel: 'Pagina',
  metadataTitle: 'Metadati del Contratto',
  partyALabel: 'Parte A:',
  partyBLabel: 'Parte B:',
  contractTypeLabel: 'Tipo:',
  jurisdictionLabel: 'Giurisdizione:',
  contractTypes: {
    nda: 'NDA (Accordo di Non Divulgazione)',
    service_agreement: 'Contratto di Servizi',
    employment: 'Contratto di Lavoro',
    partnership: 'Accordo di Partnership',
    purchase: 'Contratto di Compravendita',
    lease: 'Contratto di Locazione',
    license: 'Contratto di Licenza',
    vendor: 'Contratto con Fornitore',
    loan: 'Contratto di Finanziamento',
    distribution: 'Contratto di Distribuzione',
    franchise: 'Contratto di Franchising',
    other: 'Altro',
  },
  jurisdictions: {
    italia: 'Italia',
    eu: 'Unione Europea',
    usa: 'Stati Uniti',
    unknown: 'Non specificata',
  },
  actorSectionPartyA: (name: string) => name,
  actorSectionPartyB: (name: string) => name,
  actorSectionGeneral: 'Generali',
  normCitationsLabel: 'Riferimenti normativi:',
};
