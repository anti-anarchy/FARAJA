import { useRouter } from "next/router";
import {
	ActionIcon,
	Avatar,
	Menu,
	Text,
	UnstyledButton,
	useMantineColorScheme,
	useComputedColorScheme,
} from "@mantine/core";
import Image from "next/image";
import {
	IconMap2,
	IconAlertCircle,
	IconUsers,
	IconAdjustmentsHorizontal,
	IconLogout,
	IconChevronDown,
	IconSun,
	IconMoon,
	IconLayoutGrid,
	IconCheck,
} from "@tabler/icons-react";
import { FarajaMark } from "@/components/icons";

interface User {
	name: string;
	email: string;
}

interface HeaderProps {
	user: User;
	/** When provided, shows the Faraja co-pilot trigger. */
	onOpenAssistant?: () => void;
}

const NAV_LINKS = [
	{ label: "Operations", href: "/", icon: IconMap2 },
	{ label: "Incidents", href: "/incidents", icon: IconAlertCircle },
	{ label: "Responders", href: "/responders", icon: IconUsers },
	{ label: "Weighting", href: "/scoring", icon: IconAdjustmentsHorizontal },
];

export default function Header({ user, onOpenAssistant }: HeaderProps) {
	const router = useRouter();
	const { setColorScheme } = useMantineColorScheme();
	const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });

	function handleSignOut() {
		localStorage.removeItem("auth_user");
		router.push("/signin");
	}

	const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
	const current = NAV_LINKS.find((l) => l.href === router.pathname) ?? NAV_LINKS[0];
	const CurrentIcon = current.icon;

	return (
		<header
			className="h-14 flex items-center justify-between shrink-0 px-4"
			style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", zIndex: 50 }}
		>
			{/* Left: nav launcher + brand */}
			<div className="flex items-center gap-2.5">
				<Menu position="bottom-start" width={208} radius="md" shadow="md" offset={6}>
					<Menu.Target>
						<UnstyledButton
							className="flex items-center gap-2 transition-colors"
							style={{
								height: 36,
								padding: "0 12px 0 10px",
								borderRadius: 10,
								border: "1px solid var(--border)",
								background: "var(--surface)",
							}}
						>
							<IconLayoutGrid size={16} color="var(--ink-2)" />
							<Text fw={600} style={{ fontSize: 12.5 }}>{current.label}</Text>
							<IconChevronDown size={14} color="var(--ink-3)" />
						</UnstyledButton>
					</Menu.Target>
					<Menu.Dropdown>
						<Menu.Label>Navigate</Menu.Label>
						{NAV_LINKS.map((link) => {
							const Icon = link.icon;
							const active = router.pathname === link.href;
							return (
								<Menu.Item
									key={link.href}
									leftSection={<Icon size={16} />}
									rightSection={active ? <IconCheck size={14} color="var(--accent)" /> : null}
									onClick={() => router.push(link.href)}
									style={{ fontWeight: active ? 600 : 500 }}
								>
									{link.label}
								</Menu.Item>
							);
						})}
					</Menu.Dropdown>
				</Menu>

				<div style={{ width: 1, height: 22, background: "var(--border)" }} aria-hidden />

				<div className="flex items-center gap-2.5">
					<Image src="/undp-logo.png" alt="UNDP" width={72} height={36} style={{ objectFit: "contain" }} priority />
					<Text fw={700} style={{ fontSize: 13, letterSpacing: "-0.01em" }}>Response Console</Text>
				</div>
			</div>

			{/* Right: theme + Faraja + user */}
			<div className="flex items-center gap-2">
				<ActionIcon
					variant="default"
					radius="md"
					size={36}
					aria-label="Toggle colour theme"
					onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
					style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink-2)" }}
				>
					{computed === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
				</ActionIcon>

				{onOpenAssistant && (
					<button
						onClick={onOpenAssistant}
						className="flex items-center gap-2 transition-colors"
						style={{
							height: 36,
							padding: "0 14px 0 6px",
							borderRadius: 999,
							border: "1px solid var(--border)",
							background: "var(--surface)",
							cursor: "pointer",
							fontSize: 12.5,
							fontWeight: 600,
							color: "var(--ink)",
						}}
						onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
						onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
					>
						<FarajaMark size={26} />
						Ask Faraja
					</button>
				)}

				<Menu position="bottom-end" width={210} radius="md" shadow="md">
					<Menu.Target>
						<UnstyledButton className="flex items-center gap-2" style={{ padding: "4px 6px 4px 4px", borderRadius: 999 }}>
							<Avatar radius="xl" size={30} styles={{ placeholder: { background: "var(--ink)", color: "var(--surface)", fontSize: 12, fontWeight: 600 } }}>
								{initials}
							</Avatar>
							<div className="hidden sm:block text-left leading-tight">
								<Text fw={600} style={{ fontSize: 12.5 }}>{user.name}</Text>
								<Text style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{user.email}</Text>
							</div>
							<IconChevronDown size={14} color="var(--ink-3)" />
						</UnstyledButton>
					</Menu.Target>
					<Menu.Dropdown>
						<Menu.Label>{user.email}</Menu.Label>
						<Menu.Item leftSection={<IconLogout size={15} />} color="red" onClick={handleSignOut}>
							Sign out
						</Menu.Item>
					</Menu.Dropdown>
				</Menu>
			</div>
		</header>
	);
}
