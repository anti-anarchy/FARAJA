import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
    Alert,
    Badge,
    Button,
    Center,
    Divider,
    Group,
    Loader,
    Modal,
    Paper,
    SegmentedControl,
    Select,
    Stack,
    Text,
    Textarea,
    Tooltip,
} from "@mantine/core";
import {
    IconChartHistogram,
    IconClipboardList,
    IconSubtask,
    IconRoute,
    IconAlertTriangle,
    IconArrowRight,
    IconArrowLeft,
    IconMapPin,
    IconExternalLink,
    IconBuildingCommunity,
    IconUsersGroup,
    IconUserExclamation,
    IconFileText,
    IconFlag,
    IconMapPins,
} from "@tabler/icons-react";
import Header from "@/components/Header";
import AiAssistant from "@/components/AiAssistant";
import { DisasterGlyph, FarajaMark } from "@/components/icons";
import type { DamageLevel, DisasterType, PointFeature, TaskAssignment, TaskStatus, ZoneFeature } from "@/types";
import { DAMAGE_COLORS, DAMAGE_WEIGHT } from "@/types";
import type { MapSelection } from "@/components/DashboardMap";

const DashboardMap = dynamic(() => import("@/components/DashboardMap"), {
    ssr: false,
    loading: () => (
        <Center style={{ height: "100%" }}>
            <Loader />
        </Center>
    ),
});

interface AuthUser {
    name: string;
    email: string;
}

const TASK_STATUS_STYLES: Record<TaskStatus, { bg: string; color: string }> = {
    unassigned: { bg: "var(--sev-critical-soft)", color: "var(--sev-critical)" },
    assigned: { bg: "var(--accent-soft)", color: "var(--accent-ink)" },
    resolved: { bg: "var(--sev-low-soft)", color: "var(--sev-low)" },
};

/* ---------- atoms ---------- */

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 mb-2">
            {icon && <span style={{ color: "var(--ink-3)" }}>{icon}</span>}
            <span className="section-label">{children}</span>
        </div>
    );
}

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
    return (
        <div>
            <Text style={{ fontSize: 11, color: "var(--ink-3)" }}>{label}</Text>
            <div className="metric-value" style={{ fontSize: 19, color: accent ?? "var(--ink)", marginTop: 2 }}>
                {value}
            </div>
        </div>
    );
}

function SeverityPin({ level, disaster, size = 30 }: { level: DamageLevel; disaster: DisasterType; size?: number }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: DAMAGE_COLORS[level],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "var(--shadow-xs)",
            }}
        >
            <DisasterGlyph type={disaster} size={Math.round(size * 0.5)} color="#fff" stroke={2.2} />
        </div>
    );
}

function Casualties({ n }: { n: number }) {
    if (n <= 0) return null;
    return (
        <span className="flex items-center gap-1" style={{ color: "var(--sev-critical)", fontSize: 11, fontWeight: 600 }}>
            <IconAlertTriangle size={12} stroke={2.2} />
            {n} {n === 1 ? "casualty" : "casualties"}
        </span>
    );
}

function StatusBadge({ status }: { status: TaskStatus }) {
    const s = TASK_STATUS_STYLES[status];
    return <Badge size="xs" style={{ backgroundColor: s.bg, color: s.color }}>{status}</Badge>;
}

const PRIORITY_STYLES: Record<TaskAssignment["priority"], { bg: string; color: string }> = {
    Critical: { bg: "var(--sev-critical-soft)", color: "var(--sev-critical)" },
    Medium: { bg: "var(--sev-medium-soft)", color: "var(--sev-medium)" },
    Low: { bg: "var(--sev-low-soft)", color: "var(--sev-low)" },
};

function PriorityBadge({ priority }: { priority: TaskAssignment["priority"] }) {
    const s = PRIORITY_STYLES[priority];
    return (
        <Badge size="xs" leftSection={<IconFlag size={10} />} styles={{ root: { background: s.bg, color: s.color }, section: { marginRight: 3 } }}>
            {priority}
        </Badge>
    );
}

function TaskRow({ task, point, onOpen, rail }: { task: TaskAssignment; point?: PointFeature; onOpen?: (p: PointFeature) => void; rail?: boolean }) {
    const infraName = point?.properties.infrastructure_name ?? task.point_id;
    return (
        <Paper
            withBorder
            p="sm"
            className={`hoverable${rail ? " rail-critical" : ""}`}
            style={{ cursor: point ? "pointer" : "default" }}
            onClick={() => point && onOpen?.(point)}
        >
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    {point ? (
                        <SeverityPin level={point.properties.damage_level} disaster={point.properties.disaster_type} size={28} />
                    ) : (
                        <span className="icon-chip" style={{ width: 28, height: 28 }}><IconSubtask size={15} /></span>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <Text fw={600} size="sm" truncate>{infraName}</Text>
                        <Text size="xs" c="dimmed" truncate>
                            Zone {task.zone_id}{task.responder_name ? ` · ${task.responder_name}` : ""}
                        </Text>
                    </div>
                </Group>
                <Stack gap={4} align="flex-end">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                </Stack>
            </Group>
        </Paper>
    );
}

function KpiTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
    return (
        <Paper withBorder p="sm">
            <span style={{ color: "var(--ink-3)" }}>{icon}</span>
            <div className="metric-value" style={{ fontSize: 22, marginTop: 6, color: accent ?? "var(--ink)" }}>{value}</div>
            <Text style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{label}</Text>
        </Paper>
    );
}

function DamageMixBar({ pct_critical, pct_partial, pct_low }: { pct_critical: number; pct_partial: number; pct_low: number }) {
    return (
        <div>
            <div className="flex" style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "var(--sunken)" }}>
                <div style={{ width: `${pct_low * 100}%`, background: DAMAGE_COLORS.Low }} />
                <div style={{ width: `${pct_partial * 100}%`, background: DAMAGE_COLORS.Medium }} />
                <div style={{ width: `${pct_critical * 100}%`, background: DAMAGE_COLORS.Critical }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <Text size="xs" c="dimmed">Low {Math.round(pct_low * 100)}%</Text>
                <Text size="xs" c="dimmed">Med {Math.round(pct_partial * 100)}%</Text>
                <Text size="xs" c="dimmed">Crit {Math.round(pct_critical * 100)}%</Text>
            </div>
        </div>
    );
}

function DisasterBreakdown({ breakdown, total }: { breakdown: Partial<Record<DisasterType, number>>; total: number }) {
    const sorted = (Object.entries(breakdown) as [DisasterType, number][]).sort((a, b) => b[1] - a[1]);
    return (
        <Stack gap={7}>
            {sorted.map(([type, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--ink-2)", display: "inline-flex", width: 16 }}>
                            <DisasterGlyph type={type} size={14} stroke={2} />
                        </span>
                        <Text size="xs" style={{ width: 74, flexShrink: 0 }}>{type}</Text>
                        <div style={{ flex: 1, height: 5, background: "var(--sunken)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "var(--ink-3)", borderRadius: 3 }} />
                        </div>
                        <Text size="xs" c="dimmed" className="tnum" style={{ minWidth: 22, textAlign: "right" }}>{count}</Text>
                    </div>
                );
            })}
        </Stack>
    );
}

function AreaBreakdown({ zones }: { zones: ZoneFeature[] }) {
    const stats = useMemo(() => {
        if (zones.length === 0) return null;
        const totalReports = zones.reduce((s, z) => s + z.properties.count, 0);
        const pct_critical = totalReports > 0 ? zones.reduce((s, z) => s + z.properties.count * z.properties.pct_critical, 0) / totalReports : 0;
        const pct_partial = totalReports > 0 ? zones.reduce((s, z) => s + z.properties.count * z.properties.pct_partial, 0) / totalReports : 0;
        const pct_low = totalReports > 0 ? zones.reduce((s, z) => s + z.properties.count * z.properties.pct_low, 0) / totalReports : 0;
        const disasterBreakdown: Partial<Record<DisasterType, number>> = {};
        for (const zone of zones) {
            for (const [type, count] of Object.entries(zone.properties.disaster_breakdown ?? {})) {
                const t = type as DisasterType;
                disasterBreakdown[t] = (disasterBreakdown[t] ?? 0) + (count as number);
            }
        }
        return { totalReports, pct_critical, pct_partial, pct_low, disasterBreakdown };
    }, [zones]);

    if (!stats) return null;
    return (
        <Paper withBorder p="md" className="anim-fade">
            <SectionTitle icon={<IconChartHistogram size={13} />}>Area overview · {zones.length} zones</SectionTitle>
            <div className="space-y-3">
                <DamageMixBar pct_critical={stats.pct_critical} pct_partial={stats.pct_partial} pct_low={stats.pct_low} />
                <DisasterBreakdown breakdown={stats.disasterBreakdown} total={stats.totalReports} />
            </div>
        </Paper>
    );
}

function ClusterStats({ zone, onAssign }: { zone: ZoneFeature; onAssign: () => void }) {
    const tierColor = DAMAGE_COLORS[zone.properties.tier] ?? "var(--ink-3)";
    const total = zone.properties.count;
    return (
        <Stack gap="md" className="anim-rise">
            <Paper withBorder p="md" className={`rail-${zone.properties.tier.toLowerCase()}`}>
                <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm">{zone.properties.zone_id}</Text>
                    <div style={{ display: "flex", gap: 5 }}>
                        <Badge variant="default" leftSection={<DisasterGlyph type={zone.properties.dominant_disaster} size={12} />} styles={{ root: { background: "var(--sunken)", color: "var(--ink)", border: "1px solid var(--border)" } }}>
                            {zone.properties.dominant_disaster}
                        </Badge>
                        <Badge style={{ backgroundColor: tierColor, color: "#fff" }} size="sm">{zone.properties.tier}</Badge>
                    </div>
                </Group>
                <Text size="xs" c="dimmed" mb="md">{zone.properties.label}</Text>

                <div style={{ display: "flex", gap: 28, marginBottom: 14 }}>
                    <Metric label="Reports" value={zone.properties.count} />
                    <Metric label="Casualties" value={zone.properties.casualties} accent="var(--sev-critical)" />
                    <Metric label="Score" value={zone.properties.score} />
                </div>

                <div style={{ marginBottom: 14 }}>
                    <Text size="xs" c="dimmed" mb={6}>Damage breakdown</Text>
                    <DamageMixBar pct_critical={zone.properties.pct_critical} pct_partial={zone.properties.pct_partial} pct_low={zone.properties.pct_low} />
                </div>

                {Object.keys(zone.properties.disaster_breakdown ?? {}).length > 0 && (
                    <div>
                        <Text size="xs" c="dimmed" mb={8}>Disaster breakdown</Text>
                        <DisasterBreakdown breakdown={zone.properties.disaster_breakdown ?? {}} total={total} />
                    </div>
                )}

                <Button fullWidth mt="md" size="sm" onClick={onAssign} rightSection={<IconArrowRight size={15} />}>
                    Assign responder
                </Button>
            </Paper>
        </Stack>
    );
}

function PointStats({
    point,
    cluster,
    assignments,
    onAssign,
    onViewReport,
}: {
    point: PointFeature;
    cluster: ZoneFeature | null;
    assignments: TaskAssignment[];
    onAssign: () => void;
    onViewReport: () => void;
}) {
    const damageColor = DAMAGE_COLORS[point.properties.damage_level] ?? "var(--ink-3)";
    const activeAssignment = assignments.find((a) => a.status !== "resolved") ?? null;
    const isAssigned = activeAssignment !== null;

    return (
        <Stack gap="md" className="anim-rise">
            {cluster && (
                <Paper withBorder p="md">
                    <SectionTitle icon={<IconUsersGroup size={13} />}>Zone context</SectionTitle>
                    <Group justify="space-between" mb={6}>
                        <Text size="sm" fw={600}>{cluster.properties.label}</Text>
                        <Badge style={{ backgroundColor: DAMAGE_COLORS[cluster.properties.tier], color: "#fff" }} size="sm">{cluster.properties.tier}</Badge>
                    </Group>
                    <div style={{ display: "flex", gap: 24 }}>
                        <Metric label="Reports in zone" value={cluster.properties.count} />
                        <Metric label="Casualties" value={cluster.properties.casualties} accent="var(--sev-critical)" />
                    </div>
                </Paper>
            )}

            <Paper withBorder p="md">
                <SectionTitle icon={<IconBuildingCommunity size={13} />}>Infrastructure detail</SectionTitle>
                <Group gap="sm" mb={10} wrap="nowrap">
                    <SeverityPin level={point.properties.damage_level} disaster={point.properties.disaster_type} size={34} />
                    <Text fw={700} size="sm">{point.properties.infrastructure_name}</Text>
                </Group>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    <Badge variant="default" leftSection={<DisasterGlyph type={point.properties.disaster_type} size={12} />} styles={{ root: { background: "var(--sunken)", color: "var(--ink)", border: "1px solid var(--border)" } }}>
                        {point.properties.disaster_type}
                    </Badge>
                    <Badge style={{ backgroundColor: damageColor, color: "#fff" }} size="sm">{point.properties.damage_level}</Badge>
                </div>
                <div style={{ marginBottom: 8 }}>
                    <Text size="xs" c="dimmed">Infrastructure type</Text>
                    <Text size="sm" fw={500}>{point.properties.infrastructure_type}</Text>
                </div>
                <Divider my="xs" color="var(--border)" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text size="xs" c="dimmed">Assignment status</Text>
                    {isAssigned ? (
                        <Badge style={{ backgroundColor: "var(--sev-low-soft)", color: "var(--sev-low)" }} size="sm">{activeAssignment!.responder_name}</Badge>
                    ) : (
                        <Badge style={{ backgroundColor: "var(--sev-critical-soft)", color: "var(--sev-critical)" }} size="sm">Not assigned</Badge>
                    )}
                </div>
                <Group gap="xs" grow>
                    {!isAssigned ? (
                        <Button size="sm" onClick={onAssign} rightSection={<IconArrowRight size={15} />}>Assign task</Button>
                    ) : (
                        <Button size="sm" variant="light" onClick={onAssign} rightSection={<IconArrowRight size={15} />}>Reassign</Button>
                    )}
                    <Button size="sm" variant="default" onClick={onViewReport} leftSection={<IconFileText size={15} />}>Report</Button>
                </Group>
            </Paper>
        </Stack>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [checking, setChecking] = useState(true);
    const [selection, setSelection] = useState<MapSelection>({ cluster: null, point: null });
    const [visibleZones, setVisibleZones] = useState<ZoneFeature[]>([]);
    const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
    const [visiblePoints, setVisiblePoints] = useState<PointFeature[]>([]);
    const [selectedReport, setSelectedReport] = useState<PointFeature | null>(null);
    const [showResolvedTasks, setShowResolvedTasks] = useState(false);
    const [feedView, setFeedView] = useState<"feed" | "tasks" | "routes">("feed");
    const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; seq: number } | null>(null);
    const [routeOrigin, setRouteOrigin] = useState("Current location");
    const [routeDestination, setRouteDestination] = useState("");
    const [routeWaypoints, setRouteWaypoints] = useState("");
    const [assistantOpen, setAssistantOpen] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem("auth_user");
        if (!raw) {
            router.replace("/signin");
        } else {
            try {
                setUser(JSON.parse(raw) as AuthUser);
            } catch {
                router.replace("/signin");
            }
        }
        setChecking(false);
    }, [router]);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch("/api/tasks");
                if (res.ok) setAssignments((await res.json()) as TaskAssignment[]);
            } catch {
                // ignore
            }
        };
        fetchTasks();
    }, []);

    // visiblePoints is now driven by DashboardMap's ViewportTracker (onVisiblePointsChange)
    // so no separate fetch needed here

    const pointById = useMemo(() => {
        const map = new Map<string, PointFeature>();
        for (const pt of visiblePoints) map.set(pt.properties.point_id, pt);
        return map;
    }, [visiblePoints]);

    const kpis = useMemo(() => {
        const total = visiblePoints.length;
        const critical = visiblePoints.filter((p) => p.properties.damage_level === "Critical").length;
        const casualties = visiblePoints.reduce((s, p) => s + (p.properties.casualties ?? 0), 0);
        const unassigned = visiblePoints.filter((p) => p.properties.task_status === "unassigned").length;
        return { total, critical, casualties, unassigned };
    }, [visiblePoints]);

    const sortedReports = useMemo(() => {
        return [...visiblePoints].sort((a, b) => {
            const w = (DAMAGE_WEIGHT[b.properties.damage_level] ?? 0) - (DAMAGE_WEIGHT[a.properties.damage_level] ?? 0);
            if (w !== 0) return w;
            return (b.properties.casualties ?? 0) - (a.properties.casualties ?? 0);
        });
    }, [visiblePoints]);

    const suggestedRouteStops = useMemo(() => {
        const seen = new Set<string>();
        return visiblePoints
            .map((point) => point.properties.infrastructure_name)
            .filter((name): name is string => {
                if (!name || seen.has(name)) return false;
                seen.add(name);
                return true;
            });
    }, [visiblePoints]);

    const routeOptionData = useMemo(
        () => [{ value: "Current location", label: "Current location" }, ...suggestedRouteStops.map((name) => ({ value: name, label: name }))],
        [suggestedRouteStops]
    );
    const destinationOptionData = useMemo(() => suggestedRouteStops.map((name) => ({ value: name, label: name })), [suggestedRouteStops]);

    const flyTo = (lat: number, lng: number) => setFlyTarget({ lat, lng, seq: Date.now() });

    const openPoint = (point: PointFeature) => {
        const [lng, lat] = point.geometry.coordinates;
        flyTo(lat, lng);
        setSelection({ cluster: null, point });
    };

    const openRouteOptimization = () => {
        const origin = routeOrigin.trim();
        const destination = routeDestination.trim();
        const waypoints = routeWaypoints.split("\n").map((item) => item.trim()).filter(Boolean);
        if (!origin || !destination) return;
        const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
        params.set("waypoints", waypoints.length > 0 ? `optimize:true|${waypoints.join("|")}` : "optimize:true");
        window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
    };

    if (checking || !user) {
        return (
            <Center style={{ height: "100vh" }}>
                <Loader />
            </Center>
        );
    }

    const assignZone = (zoneId: string) => router.push(`/responders?zone=${zoneId}`);
    const clearSelection = () => setSelection({ cluster: null, point: null });

    const hasSelection = selection.point !== null || selection.cluster !== null;

    const renderDetail = () => {
        if (selection.point) {
            const zoneId = selection.cluster?.properties.zone_id ?? selection.point.properties.zone_id;
            const zoneAssignments = assignments.filter((a) => a.zone_id === zoneId);
            return (
                <PointStats
                    point={selection.point}
                    cluster={selection.cluster}
                    assignments={zoneAssignments}
                    onAssign={() => assignZone(zoneId)}
                    onViewReport={() => setSelectedReport(selection.point)}
                />
            );
        }
        if (selection.cluster) {
            return <ClusterStats zone={selection.cluster} onAssign={() => assignZone(selection.cluster!.properties.zone_id)} />;
        }
        return null;
    };

    const activeTasks = assignments.filter((a) => a.status === "assigned");
    const unassignedTasks = assignments.filter((a) => a.status === "unassigned");
    const resolvedTasks = assignments.filter((a) => a.status === "resolved");

    return (
        <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--canvas)" }}>
            <Header user={user} onOpenAssistant={() => setAssistantOpen(true)} />

            <AiAssistant
                opened={assistantOpen}
                onClose={() => setAssistantOpen(false)}
                points={visiblePoints}
                assignments={assignments}
                onFlyTo={(lat, lng) => flyTo(lat, lng)}
                onAssign={(zoneId) => assignZone(zoneId)}
            />

            {/* Report detail modal */}
            <Modal
                opened={selectedReport !== null}
                onClose={() => setSelectedReport(null)}
                title={selectedReport?.properties.infrastructure_name ?? ""}
                size="md"
            >
                {selectedReport && (() => {
                    const damageColor = DAMAGE_COLORS[selectedReport.properties.damage_level];
                    return (
                        <Stack gap="md">
                            <Group gap="xs">
                                <Badge variant="default" leftSection={<DisasterGlyph type={selectedReport.properties.disaster_type} size={12} />} styles={{ root: { background: "var(--sunken)", color: "var(--ink)", border: "1px solid var(--border)" } }}>
                                    {selectedReport.properties.disaster_type}
                                </Badge>
                                <Badge style={{ backgroundColor: damageColor, color: "#fff" }}>{selectedReport.properties.damage_level}</Badge>
                            </Group>

                            <div>
                                <Text fw={600} size="sm" mb={4}>Summary</Text>
                                <Text size="sm">{selectedReport.properties.report_summary}</Text>
                            </div>

                            <div>
                                <Text fw={600} size="sm" mb={8}>Details</Text>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                                    <div>
                                        <Text size="xs" c="dimmed">Infrastructure type</Text>
                                        <Text size="sm" fw={500}>{selectedReport.properties.infrastructure_type}</Text>
                                    </div>
                                    <div>
                                        <Text size="xs" c="dimmed">Zone ID</Text>
                                        <Text size="sm" fw={500}>{selectedReport.properties.zone_id}</Text>
                                    </div>
                                    <div>
                                        <Text size="xs" c="dimmed">Casualties</Text>
                                        <Text size="sm" fw={500}>{selectedReport.properties.casualties}</Text>
                                    </div>
                                    <div>
                                        <Text size="xs" c="dimmed">Task status</Text>
                                        <StatusBadge status={selectedReport.properties.task_status} />
                                    </div>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <Text size="xs" c="dimmed">Assigned to</Text>
                                        <Text size="sm" fw={500}>{selectedReport.properties.assigned_to ?? "Unassigned"}</Text>
                                    </div>
                                </div>
                            </div>

                            {selectedReport.properties.task_status === "unassigned" && (
                                <Button rightSection={<IconArrowRight size={15} />} onClick={() => router.push(`/responders?zone=${selectedReport.properties.zone_id}&point=${selectedReport.properties.point_id}`)}>
                                    Assign responder
                                </Button>
                            )}
                            {selectedReport.properties.task_status === "assigned" && (
                                <Button variant="light" rightSection={<IconArrowRight size={15} />} onClick={() => router.push(`/responders?zone=${selectedReport.properties.zone_id}&point=${selectedReport.properties.point_id}`)}>
                                    Reassign
                                </Button>
                            )}
                            {selectedReport.properties.task_status === "resolved" && (
                                <Text size="sm" c="dimmed">Resolved — no action needed</Text>
                            )}
                        </Stack>
                    );
                })()}
            </Modal>

            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 relative">
                    <DashboardMap
                        onSelect={setSelection}
                        onVisibleZonesChange={setVisibleZones}
                        onVisiblePointsChange={setVisiblePoints}
                        flyTo={flyTarget}
                        onViewReport={(pt) => {
                            setSelectedReport(pt);
                            setFeedView("feed");
                        }}
                    />

                    {!assistantOpen && (
                        <Tooltip label="Ask Faraja" position="left" withArrow>
                            <button
                                onClick={() => setAssistantOpen(true)}
                                aria-label="Open Faraja assistant"
                                className="anim-rise"
                                style={{
                                    position: "absolute",
                                    right: 18,
                                    bottom: 18,
                                    zIndex: 1000,
                                    border: "2px solid var(--surface)",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                    padding: 0,
                                    background: "transparent",
                                    boxShadow: "var(--shadow-md)",
                                    transition: "transform 0.18s var(--ease)",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                            >
                                <FarajaMark size={52} radius={26} />
                            </button>
                        </Tooltip>
                    )}
                </div>

                <aside
                    className="flex flex-col overflow-hidden shrink-0"
                    style={{ width: 384, borderLeft: "1px solid var(--border)", background: "var(--surface)" }}
                >
                    {/* Sidebar header */}
                    <div className="flex items-center justify-between px-4" style={{ height: 48, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                        <Text fw={700} size="sm">Operations</Text>
                        <Badge variant="light" color="ink" size="sm" styles={{ root: { background: "var(--sunken)", color: "var(--ink-2)" } }}>
                            {visiblePoints.length} in view
                        </Badge>
                    </div>

                    {/* KPI tiles */}
                    <div className="px-3 pt-3" style={{ flexShrink: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <KpiTile icon={<IconClipboardList size={16} />} label="Reports" value={kpis.total} />
                            <KpiTile icon={<IconAlertTriangle size={16} />} label="Critical" value={kpis.critical} accent="var(--sev-critical)" />
                            <KpiTile icon={<IconUserExclamation size={16} />} label="Casualties" value={kpis.casualties} />
                            <KpiTile icon={<IconSubtask size={16} />} label="Unassigned" value={kpis.unassigned} />
                        </div>
                    </div>

                    {/* Segmented switch (hidden while drilled into a selection) */}
                    {!hasSelection && (
                        <div className="px-3 pt-3" style={{ flexShrink: 0 }}>
                            <SegmentedControl
                                fullWidth
                                value={feedView}
                                onChange={(v) => setFeedView(v as typeof feedView)}
                                data={[
                                    { value: "feed", label: <span className="flex items-center justify-center gap-1.5"><IconClipboardList size={14} />Feed</span> },
                                    { value: "tasks", label: <span className="flex items-center justify-center gap-1.5"><IconSubtask size={14} />Tasks</span> },
                                    { value: "routes", label: <span className="flex items-center justify-center gap-1.5"><IconRoute size={14} />Routes</span> },
                                ]}
                            />
                        </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
                        {hasSelection ? (
                            <Stack gap="sm">
                                <Button variant="subtle" size="compact-sm" leftSection={<IconArrowLeft size={15} />} onClick={clearSelection} style={{ alignSelf: "flex-start", color: "var(--ink-2)" }}>
                                    Back to operations
                                </Button>
                                {renderDetail()}
                            </Stack>
                        ) : feedView === "feed" ? (
                            <Stack gap="sm">
                                <AreaBreakdown zones={visibleZones} />
                                {visiblePoints.length === 0 ? (
                                    <Text size="sm" c="dimmed" ta="center" mt="xl">No reports in view</Text>
                                ) : (
                                    <Stack gap="xs" className="stagger">
                                        {sortedReports.map((point) => {
                                            const [lng, lat] = point.geometry.coordinates;
                                            return (
                                                <Paper
                                                    key={point.properties.point_id}
                                                    withBorder
                                                    p="sm"
                                                    className="hoverable"
                                                    style={{ cursor: "pointer" }}
                                                    onClick={() => {
                                                        flyTo(lat, lng);
                                                        setSelection({ cluster: null, point });
                                                    }}
                                                >
                                                    <Group align="center" gap="sm" wrap="nowrap">
                                                        <SeverityPin level={point.properties.damage_level} disaster={point.properties.disaster_type} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <Text fw={600} size="sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {point.properties.infrastructure_name}
                                                            </Text>
                                                            <Text size="xs" c="dimmed" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {point.properties.infrastructure_type} · {point.properties.disaster_type}
                                                            </Text>
                                                            <Group gap={8} mt={5}>
                                                                <StatusBadge status={point.properties.task_status} />
                                                                <Casualties n={point.properties.casualties} />
                                                            </Group>
                                                        </div>
                                                        <IconArrowRight size={15} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
                                                    </Group>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Stack>
                        ) : feedView === "tasks" ? (
                            <div>
                                <Group gap={6} mb="md">
                                    <Badge variant="light" styles={{ root: { background: "var(--accent-soft)", color: "var(--accent-ink)" } }} size="sm">{activeTasks.length} active</Badge>
                                    <Badge style={{ background: "var(--sev-critical-soft)", color: "var(--sev-critical)" }} size="sm">{unassignedTasks.length} unassigned</Badge>
                                    <Badge style={{ background: "var(--sev-low-soft)", color: "var(--sev-low)" }} size="sm">{resolvedTasks.length} resolved</Badge>
                                </Group>

                                {activeTasks.length > 0 && (
                                    <Stack gap="xs" mb="md">
                                        <SectionTitle icon={<IconSubtask size={13} />}>Active</SectionTitle>
                                        {activeTasks.map((task) => (
                                            <TaskRow key={task.id} task={task} point={pointById.get(task.point_id)} onOpen={openPoint} />
                                        ))}
                                    </Stack>
                                )}

                                {unassignedTasks.length > 0 && (
                                    <Stack gap="xs" mb="md">
                                        <SectionTitle icon={<IconAlertTriangle size={13} />}>Unassigned</SectionTitle>
                                        {unassignedTasks.map((task) => (
                                            <TaskRow key={task.id} task={task} point={pointById.get(task.point_id)} onOpen={openPoint} rail />
                                        ))}
                                    </Stack>
                                )}

                                {resolvedTasks.length > 0 && (
                                    <Stack gap="xs">
                                        <Group justify="space-between">
                                            <SectionTitle icon={<IconSubtask size={13} />}>Resolved ({resolvedTasks.length})</SectionTitle>
                                            <Button size="compact-xs" variant="subtle" onClick={() => setShowResolvedTasks((v) => !v)}>{showResolvedTasks ? "Hide" : "Show"}</Button>
                                        </Group>
                                        {showResolvedTasks &&
                                            resolvedTasks.map((task) => (
                                                <TaskRow key={task.id} task={task} point={pointById.get(task.point_id)} onOpen={openPoint} />
                                            ))}
                                    </Stack>
                                )}

                                {assignments.length === 0 && <Text size="sm" c="dimmed" ta="center" mt="xl">No tasks yet</Text>}
                            </div>
                        ) : (
                            <Stack gap="sm">
                                <Alert color="accent" variant="light" icon={<IconRoute size={18} />} title="Route planning">
                                    Open Google Maps with optimized aid-delivery stops. Waypoints are reordered automatically to shorten the path for responders.
                                </Alert>
                                <Select label="Start / current location" value={routeOrigin} onChange={(value) => setRouteOrigin(value ?? "Current location")} data={routeOptionData} placeholder="Select a starting area" searchable clearable={false} />
                                <Select label="Destination / affected area" value={routeDestination} onChange={(value) => setRouteDestination(value ?? "")} data={destinationOptionData} placeholder="Select an affected area" searchable clearable />
                                <div>
                                    <Group justify="space-between" mb={4}>
                                        <Text size="sm" fw={500}>Waypoint stops (one per line)</Text>
                                        {suggestedRouteStops.length > 0 && (
                                            <Button size="compact-xs" variant="subtle" leftSection={<IconMapPins size={13} />} onClick={() => setRouteWaypoints(suggestedRouteStops.slice(0, 8).join("\n"))}>
                                                Fill {Math.min(suggestedRouteStops.length, 8)} visible
                                            </Button>
                                        )}
                                    </Group>
                                    <Textarea minRows={5} value={routeWaypoints} onChange={(event) => setRouteWaypoints(event.currentTarget.value)} placeholder={"Affected site 1\nAffected site 2\nAffected site 3"} />
                                </div>
                                <Button onClick={openRouteOptimization} rightSection={<IconExternalLink size={15} />}>Open optimized route in Google Maps</Button>

                                {suggestedRouteStops.length > 0 && (
                                    <Paper withBorder p="sm">
                                        <SectionTitle icon={<IconMapPin size={13} />}>Suggested affected stops</SectionTitle>
                                        <Stack gap="xs">
                                            {suggestedRouteStops.slice(0, 8).map((name) => (
                                                <Button key={name} variant="light" size="compact-xs" justify="flex-start" leftSection={<IconMapPin size={13} />} onClick={() => setRouteWaypoints((prev) => (prev ? `${prev}\n${name}` : name))}>
                                                    {name}
                                                </Button>
                                            ))}
                                        </Stack>
                                    </Paper>
                                )}
                            </Stack>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
