export type Urgency = "low" | "medium" | "high" | "critical";
export type ReportStatus = "assigned" | "attended";

export interface SurveyData {
	infrastructureTypes: string[];
	description: string;
	damageLevel: string;
	debrisPresent: boolean;
	affectedCount: number;
}

export interface CrisisReport {
	id: string;
	title: string;
	location: { lat: number; lng: number };
	address: string;
	reportedAt: string;
	urgency: Urgency;
	status: ReportStatus;
	attendedAt?: string;
	notes?: string;
	survey: SurveyData;
	images: string[];
	reporter: string;
}

export interface Responder {
	id: string;
	name: string;
	badge: string;
	department: string;
	phone: string;
	email: string;
	stats: {
		reportsAttended: number;
		avgResponseTime: string;
		activeReports: number;
	};
}
