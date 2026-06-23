import { useState } from "react";
import { useRouter } from "next/router";
import {
	TextInput,
	PasswordInput,
	Button,
	Text,
	Stack,
	Alert
} from "@mantine/core";
import { IconShieldHalf, IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
	const { login } = useAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(false);
		await new Promise(r => setTimeout(r, 600)); // simulate network
		const ok = login(email.trim(), password);
		if (ok) {
			router.push("/map");
		} else {
			setError(true);
			setLoading(false);
		}
	};

	return (
		<div
			style={{
				minHeight: "100dvh",
				background: "#f0eee6",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "24px 16px"
			}}>
			<div style={{ width: "100%", maxWidth: 360 }}>
				{/* Logo */}
				<Stack align="center" mb={40} gap={10}>
					<div
						style={{
							width: 64,
							height: 64,
							background: "#1a1a1a",
							borderRadius: "50%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}>
						<IconShieldHalf size={32} color="white" />
					</div>
					<Text fw={700} size="xl" ta="center">
						Crisis Responders
					</Text>
					<Text size="sm" c="dimmed" ta="center">
						Nairobi Emergency Response Unit
					</Text>
				</Stack>

				<form onSubmit={handleSubmit}>
					<Stack gap={14}>
						{error && (
							<Alert
								icon={<IconAlertCircle size={16} />}
								color="red"
								variant="light"
								radius="md">
								Invalid credentials. Please try again.
							</Alert>
						)}

						<TextInput
							label="Email"
							placeholder="you@nairobi.go.ke"
							value={email}
							onChange={e => setEmail(e.currentTarget.value)}
							radius="md"
							required
							styles={{
								input: { background: "white", borderColor: "#e5e3db" },
								label: { fontWeight: 500, marginBottom: 4 }
							}}
						/>

						<PasswordInput
							label="Password"
							placeholder="••••••••"
							value={password}
							onChange={e => setPassword(e.currentTarget.value)}
							radius="md"
							required
							styles={{
								input: { background: "white", borderColor: "#e5e3db" },
								label: { fontWeight: 500, marginBottom: 4 }
							}}
						/>

						<Button
							type="submit"
							color="dark"
							radius="xl"
							size="md"
							fullWidth
							loading={loading}
							mt={8}>
							Sign In
						</Button>
					</Stack>
				</form>

				<Text size="xs" c="dimmed" ta="center" mt={32}>
					Demo credentials:{" "}
					<Text span fw={500}>
						j.odhiambo@nairobi.go.ke
					</Text>{" "}
					/ <Text span fw={500}>responder123</Text>
				</Text>
			</div>
		</div>
	);
}
