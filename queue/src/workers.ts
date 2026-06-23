import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import type { ClassificationResult, SurveyData } from "./types";

const NUM_WORKERS = 5;
const CLASSIFIER_URL = process.env.CLASSIFIER_URL ?? "http://localhost:6000";

async function classify(
	image: NonNullable<SurveyData["image"]>
): Promise<Record<string, ClassificationResult> | null> {
	const buffer = Buffer.from(image.data, "base64");
	const blob = new Blob([buffer], { type: image.mimeType });
	const fd = new FormData();
	fd.append("image", blob, image.filename);

	console.log("[Classifier] Sending image for classification...");
	const res = await fetch(`${CLASSIFIER_URL}/predict`, {
		method: "POST",
		body: fd
	});
	if (!res.ok) return null;
	const body = (await res.json()) as {
		results: Record<string, ClassificationResult>;
	};
	console.log("[Classifier] Received classification results:", body.results);
	return body.results;
}

function createWorker(id: number): Worker<SurveyData> {
	const worker = new Worker<SurveyData>(
		"survey",
		async (job) => {
			console.log(`[Worker ${id}] Starting job ${job.id}`);

			const { image, ...surveyFields } = job.data;

			let classification: Record<string, ClassificationResult> | null = null;
			if (image?.data) {
				try {
					classification = await classify(image);
					console.log(`[Worker ${id}] Classification done for job ${job.id}`);
				} catch (err) {
					console.error(
						`[Worker ${id}] Classifier error: ${(err as Error).message}`
					);
				}
			}

			console.log(`[Worker ${id}] Completed job ${job.id} — full survey:`);
			console.log(JSON.stringify({ ...surveyFields, classification }, null, 2));
		},
		{
			connection: redisConnection,
			concurrency: 1
		}
	);

	worker.on("completed", (job) => {
		console.log(`[Worker ${id}] Job ${job.id} marked completed`);
	});

	worker.on("failed", (job, err) => {
		console.error(`[Worker ${id}] Job ${job?.id} failed: ${err.message}`);
	});

	worker.on("error", (err) => {
		console.error(`[Worker ${id}] Worker error: ${err.message}`);
	});

	return worker;
}

export function startWorkers(): Worker<SurveyData>[] {
	const workers = Array.from({ length: NUM_WORKERS }, (_, i) =>
		createWorker(i + 1)
	);
	console.log(`[Workers] ${NUM_WORKERS} survey workers started`);
	return workers;
}
