import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import type { SurveyData } from "./types";

export const surveyQueue = new Queue<SurveyData>("survey", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
