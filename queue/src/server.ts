import express, { type Request, type Response } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import multer from "multer";
import { surveyQueue } from "./queue";
import { startWorkers } from "./workers";
import type { SurveyData } from "./types";

const CLASSIFIER_URL = process.env.CLASSIFIER_URL ?? "http://localhost:6000";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(express.json());

// ── Bull Board UI ──────────────────────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
	queues: [new BullMQAdapter(surveyQueue)],
	serverAdapter
});

app.use("/admin/queues", serverAdapter.getRouter());

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Survey endpoint ────────────────────────────────────────────────────────────
app.post("/survey", async (req: Request, res: Response) => {
	const body = req.body as Partial<SurveyData>;

	if (!body.incidentType || typeof body.incidentType !== "string") {
		res
			.status(400)
			.json({ error: "incidentType is required and must be a string" });
		return;
	}

	if (body.location !== null && body.location !== undefined) {
		if (
			!Array.isArray(body.location) ||
			body.location.length !== 2 ||
			body.location.some((v) => typeof v !== "number")
		) {
			res
				.status(400)
				.json({ error: "location must be [longitude, latitude] or null" });
			return;
		}
	}

	const surveyData: SurveyData = {
		incidentType: body.incidentType,
		infrastructure: Array.isArray(body.infrastructure)
			? body.infrastructure
			: [],
		otherText: body.otherText ?? "",
		infraName: body.infraName ?? "",
		infraCount: body.infraCount ?? "",
		damageClass: body.damageClass ?? "",
		debris: body.debris ?? "",
		description: body.description ?? "",
		location: body.location ?? null,
		image: body.image ?? null
	};

	const job = await surveyQueue.add("process-survey", surveyData, {
		jobId: `survey-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
	});

	res.status(202).json({
		message: "Survey queued successfully",
		jobId: job.id,
		queueDashboard: `http://localhost:${PORT}/admin/queues`
	});
});

// ── Test classifier endpoint ───────────────────────────────────────────────────
app.post(
	"/test-classify",
	upload.single("image"),
	async (req: Request, res: Response) => {
		if (!req.file) {
			res.status(400).json({ error: "No image provided — send as multipart/form-data with key 'image'" });
			return;
		}

		const fd = new FormData();
		const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
		fd.append("image", blob, req.file.originalname);

		const classRes = await fetch(`${CLASSIFIER_URL}/predict`, { method: "POST", body: fd });
		const data = await classRes.json();
		res.status(classRes.status).json(data);
	}
);

// ── Start workers & server ─────────────────────────────────────────────────────
startWorkers();

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
	console.log(`[Server] Listening on http://localhost:${PORT}`);
	console.log(`[Server] Bull Board UI → http://localhost:${PORT}/admin/queues`);
});
