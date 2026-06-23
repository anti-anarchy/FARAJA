export interface SurveyImage {
  data: string;     // base64-encoded bytes
  mimeType: string;
  filename: string;
}

export interface ClassificationResult {
  prediction: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface SurveyData {
  incidentType: string;
  infrastructure: string[];
  otherText: string;
  infraName: string;
  infraCount: string;
  damageClass: string;
  debris: string;
  description: string;
  location: [number, number] | null;
  image?: SurveyImage | null;
}
