import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { AuthProvider } from "@/context/AuthContext";

const theme = createTheme({
	fontFamily: "DMSans",
	primaryColor: "dark"
});

export default function App({ Component, pageProps }: AppProps) {
	return (
		<MantineProvider theme={theme}>
			<Notifications position="top-right" />
			<AuthProvider>
				<Component {...pageProps} />
			</AuthProvider>
		</MantineProvider>
	);
}
