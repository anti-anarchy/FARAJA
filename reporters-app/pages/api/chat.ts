import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method !== "POST") return res.status(405).end();

	res.json({
		reply:
			"This is a placeholder response. Connect a real AI backend to enable the assistant."
	});
}
