import { useState } from "react";
import { useRouter } from "next/router";
import {
	TextInput,
	PasswordInput,
	Button,
	Paper,
	Title,
	Text,
	Stack,
	Alert
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import Image from "next/image";

const MOCK_USERS = [
	{ email: "johndoe@gmail.com", password: "password123", name: "Jane Doe" },
	{ email: "admin@undp.org", password: "admin123", name: "Admin User" }
];

export default function SignIn() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const user = MOCK_USERS.find(
			(u) => u.email === email && u.password === password
		);

		if (user) {
			localStorage.setItem(
				"auth_user",
				JSON.stringify({ name: user.name, email: user.email })
			);
			router.push("/");
		} else {
			setError("Invalid email or password.");
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<Paper shadow="md" radius="md" p="xl" className="w-full max-w-sm">
				<Stack align="center" mb="xl">
					<div className="flex items-center gap-3">
						<Image
							src="/undp-logo.png"
							alt="UNDP"
							width={120}
							height={120}
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = "none";
							}}
						/>
					</div>
				</Stack>

				<form onSubmit={handleSubmit}>
					<Stack>
						{error && (
							<Alert
								icon={<IconAlertCircle size={16} />}
								color="red"
								variant="light">
								{error}
							</Alert>
						)}
						<TextInput
							label="Email"
							size="xs"
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.currentTarget.value)}
							required
						/>
						<PasswordInput
							label="Password"
							size="xs"
							placeholder="Your password"
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
							required
						/>
						<Button type="submit" loading={loading} fullWidth mt="sm">
							Sign In
						</Button>
					</Stack>
				</form>

				<Text size="xs" c="dimmed" ta="center" mt="md">
					Demo: johndoe@gmail.com / password123
				</Text>
			</Paper>
		</div>
	);
}
