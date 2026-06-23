import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Text, ActionIcon, Badge, Loader } from "@mantine/core";
import { IconX, IconNavigation } from "@tabler/icons-react";
import { useAuth } from "@/context/AuthContext";
import { CrisisReport } from "@/types";
import { mockReports } from "@/data/mockData";
import { fetchRoute, NavigationTarget } from "@/utils/routing";
import ReportDetailDrawer from "@/components/ReportDetailDrawer";
import BottomNav from "@/components/BottomNav";

const ResponderMap = dynamic(() => import("@/components/ResponderMap"), {
	ssr: false,
	loading: () => (
		<div
			style={{
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#e5e3db"
			}}>
			<Loader color="dark" size="sm" />
		</div>
	)
});

export default function MapPage() {
	const { responder, isLoading } = useAuth();
	const router = useRouter();
	const [reports, setReports] = useState<CrisisReport[]>(mockReports);
	const [selectedReport, setSelectedReport] = useState<CrisisReport | null>(null);
	const [navTarget, setNavTarget] = useState<NavigationTarget | null>(null);
	const [userPos, setUserPos] = useState<[number, number] | null>(null);

	useEffect(() => {
		if (!isLoading && !responder) router.replace("/login");
	}, [responder, isLoading, router]);

	const handleNavigate = useCallback(
		async (report: CrisisReport) => {
			const from: [number, number] = userPos ?? [-1.2921, 36.8219];
			const to: [number, number] = [report.location.lat, report.location.lng];
			const route = await fetchRoute(from, to);
			setNavTarget({ report, route });
		},
		[userPos]
	);

	const handleMarkAttended = useCallback(
		(report: CrisisReport, notes: string) => {
			setReports(prev =>
				prev.map(r =>
					r.id === report.id
						? {
								...r,
								status: "attended" as const,
								attendedAt: new Date().toISOString(),
								notes
							}
						: r
				)
			);
		},
		[]
	);

	if (isLoading || !responder) {
		return (
			<div
				style={{
					height: "100dvh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#f0eee6"
				}}>
				<Loader color="dark" />
			</div>
		);
	}

	const activeCount = reports.filter(r => r.status === "assigned").length;

	return (
		<div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
			{/* Top bar */}
			<div
				style={{
					height: 52,
					background: "#f0eee6",
					borderBottom: "1px solid #e5e3db",
					display: "flex",
					alignItems: "center",
					padding: "0 16px",
					gap: 8,
					flexShrink: 0,
					zIndex: 20
				}}>
				<Text fw={700} size="sm" style={{ flex: 1 }}>
					Crisis Map
				</Text>
				<Badge color="red" variant="filled" size="sm">
					{activeCount} active
				</Badge>
			</div>

			{/* Navigation banner */}
			{navTarget && (
				<div
					style={{
						background: "#1a1a1a",
						color: "white",
						padding: "10px 16px",
						display: "flex",
						alignItems: "center",
						gap: 8,
						flexShrink: 0,
						zIndex: 20
					}}>
					<IconNavigation size={16} />
					<Text size="sm" fw={500} c="white" style={{ flex: 1 }}>
						Navigating → {navTarget.report.title}
					</Text>
					<ActionIcon
						variant="subtle"
						size="sm"
						onClick={() => setNavTarget(null)}
						style={{ color: "white" }}>
						<IconX size={16} />
					</ActionIcon>
				</div>
			)}

			{/* Map fills remaining space above bottom nav */}
			<div style={{ flex: 1, overflow: "hidden", position: "relative", paddingBottom: 64 }}>
				<ResponderMap
					reports={reports}
					onReportClick={setSelectedReport}
					navigationTarget={navTarget}
					onUserPosition={setUserPos}
				/>
			</div>

			<BottomNav />

			<ReportDetailDrawer
				report={selectedReport}
				onClose={() => setSelectedReport(null)}
				onNavigate={report => {
					handleNavigate(report);
					setSelectedReport(null);
				}}
				onMarkAttended={handleMarkAttended}
			/>
		</div>
	);
}
