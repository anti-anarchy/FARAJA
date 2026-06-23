import { CrisisReport } from "@/types";

export interface NavigationTarget {
	report: CrisisReport;
	route: [number, number][];
}

// Placeholder routing function — replace implementation with a custom router
export async function fetchRoute(
	from: [number, number],
	to: [number, number]
): Promise<[number, number][]> {
	try {
		const url =
			`https://router.project-osrm.org/route/v1/driving/` +
			`${from[1]},${from[0]};${to[1]},${to[0]}?geometries=geojson&overview=full`;
		const res = await fetch(url);
		if (!res.ok) throw new Error("routing failed");
		const data = await res.json();
		return (data.routes[0].geometry.coordinates as [number, number][]).map(
			([lng, lat]) => [lat, lng]
		);
	} catch {
		return [from, to]; // straight-line fallback
	}
}
