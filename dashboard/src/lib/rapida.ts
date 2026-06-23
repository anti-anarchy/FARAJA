/**
 * Shared type definitions and transform helpers for the RAPIDA API.
 * Server-side only — no browser APIs.
 */

import type {
  PointFeature,
  PointProperties,
  DisasterType,
  InfrastructureType,
  DamageLevel,
  Responder,
  TaskAssignment,
  TaskStatus,
} from "@/types";

// ─── Raw RAPIDA shapes ────────────────────────────────────────────────────────

export interface RapidaFinalReport {
  report_id: string;
  original_report_id: string | null;
  lat: number | null;
  lon: number | null;
  building_footprint_id: string;
  infrastructure_type: string | null;
  nature_of_crisis: string | null;
  damage_level: string | null;
  submitted_at: string;
  // AI-enhanced classification fields (present on final-reports endpoint)
  ai_disaster_type: string | null;
  ai_damage_severity: string | null;
}

export interface RapidaResponder {
  responder_id: string;
  name: string;
  organization: string;
  is_active: boolean;
  location: { type: string; coordinates: [number, number] } | null;
}

export interface RapidaAssignment {
  assignment_id: string;
  report: string;                     // UUID of the linked CrisisReport
  responder: string;                  // UUID of the Responder
  responder_name: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | null;
  priority: "low" | "normal" | "high" | "critical" | null;
  notes: string | null;
  assigned_at: string;
  due_date: string | null;
  completed_at: string | null;
  assigned_by: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export async function fetchAllPages<T>(baseUrl: string): Promise<T[]> {
  const firstRes = await fetch(baseUrl);
  if (!firstRes.ok) return [];

  const firstData = (await firstRes.json()) as PaginatedResponse<T>;
  // Non-paginated response (plain array)
  if (Array.isArray(firstData)) return firstData as unknown as T[];
  if (!firstData.results) return [];
  if (!firstData.next || firstData.results.length === 0) return firstData.results;

  const pageSize = firstData.results.length;
  const totalPages = Math.ceil(firstData.count / pageSize);
  const pageUrls = Array.from({ length: totalPages - 1 }, (_, i) =>
    `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${i + 2}`,
  );

  const rest = await Promise.all(
    pageUrls.map((url) =>
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<PaginatedResponse<T>>) : { results: [] as T[] }))
        .then((d) => (Array.isArray(d) ? (d as unknown as T[]) : d.results ?? [])),
    ),
  );

  return [firstData.results, ...rest].flat();
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

export function mapDisasterType(aiType: string | null, crisis: string | null): DisasterType {
  const raw = (aiType ?? crisis ?? "").toLowerCase().replace(/_/g, " ");
  switch (raw) {
    case "flood":                         return "Flood";
    case "fire": case "wildfire":         return "Fire";
    case "earthquake":                    return "Earthquake";
    case "hurricane":                     return "Hurricane";
    case "cyclone":                       return "Cyclone";
    case "landslide":                     return "Landslide";
    case "tsunami":                       return "Tsunami";
    case "civil unrest": case "unrest":   return "Civil Unrest";
    case "conflict": case "armed conflict":
    case "violence":                      return "Conflict";
    default:                              return "Other";
  }
}

export function mapDamageLevel(raw: string | null, ai: string | null): DamageLevel {
  switch (raw?.toLowerCase()) {
    case "minimal": return "Low";
    case "partial": return "Medium";
    case "complete": return "Critical";
  }
  switch (ai?.toLowerCase()) {
    case "little_or_no_damage": return "Low";
    case "mild_damage":         return "Medium";
    case "severe_damage":       return "Critical";
  }
  return "Low";
}

export function mapInfrastructureType(raw: string | null): InfrastructureType {
  switch (raw?.toLowerCase()) {
    case "residential": return "Residential";
    case "commercial":  return "Commercial";
    case "government":  return "Government";
    case "utility":     return "Utility";
    case "transport":   return "Transport & Communication";
    case "community":   return "Community";
    case "recreation":  return "Public Space";
    default:            return "Other";
  }
}

// Zone ID from 0.1° geographic grid (~11 km cells)
export function zoneIdFromCoords(lat: number, lon: number): string {
  const gridLat = (Math.round(lat * 10) / 10).toFixed(1);
  const gridLon = (Math.round(lon * 10) / 10).toFixed(1);
  return `Z${gridLat}_${gridLon}`;
}

// ─── Transform functions ──────────────────────────────────────────────────────

export function rapidaReportToPoint(report: RapidaFinalReport): PointFeature | null {
  if (report.lat == null || report.lon == null) return null;

  const infrastructure_type = mapInfrastructureType(report.infrastructure_type);
  const disaster_type = mapDisasterType(report.ai_disaster_type, report.nature_of_crisis);
  const damage_level = mapDamageLevel(report.damage_level, report.ai_damage_severity);

  const properties: PointProperties = {
    point_id: report.report_id,
    zone_id: zoneIdFromCoords(report.lat, report.lon),
    infrastructure_name: `${infrastructure_type} (${report.building_footprint_id.slice(0, 6)})`,
    infrastructure_type,
    disaster_type,
    damage_level,
    casualties: 0,
    assigned: false,
    assigned_to: null,
    task_status: "unassigned",
    report_summary: `${infrastructure_type} affected by ${report.nature_of_crisis ?? "unknown event"} — ${report.damage_level ?? "unknown"} damage.`,
    original_report_id: report.original_report_id ?? null,
  };

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [report.lon, report.lat] },
    properties,
  };
}

export function rapidaResponderToInternal(r: RapidaResponder): Responder {
  return {
    id: r.responder_id,
    name: r.name,
    team: r.organization,
    status: r.is_active ? "available" : "offline",
    current_task_zone: null,
    lat: r.location?.coordinates[1] ?? 0,
    lng: r.location?.coordinates[0] ?? 0,
    active_task_count: 0,
    max_tasks: 5,
  };
}

function mapAssignmentStatus(s: RapidaAssignment["status"]): TaskStatus {
  switch (s) {
    case "in_progress": return "assigned";
    case "completed":
    case "cancelled":   return "resolved";
    default:            return "unassigned";
  }
}

function mapAssignmentPriority(p: RapidaAssignment["priority"]): TaskAssignment["priority"] {
  switch (p) {
    case "critical": return "Critical";
    case "high":     return "Medium";
    default:         return "Low";
  }
}

export function rapidaAssignmentToTask(a: RapidaAssignment): TaskAssignment {
  return {
    id: a.assignment_id,
    zone_id: "",
    point_id: a.report,
    responder_name: a.responder_name ?? "",
    priority: mapAssignmentPriority(a.priority),
    status: mapAssignmentStatus(a.status),
    created_at: a.assigned_at,
  };
}
