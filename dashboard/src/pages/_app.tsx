import "@mantine/core/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import {
  Badge,
  Button,
  createTheme,
  Modal,
  Paper,
  SegmentedControl,
  Tabs,
  MantineProvider,
  rem,
} from "@mantine/core";

const theme = createTheme({
  fontFamily: "DMSans, system-ui, sans-serif",
  fontFamilyMonospace: "DMSans, ui-monospace, monospace",
  primaryColor: "accent",
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: "md",
  colors: {
    // Single signature accent — calm deep teal
    accent: [
      "#e4f1ef",
      "#c6e2df",
      "#a1d1cb",
      "#76beb6",
      "#52aaa1",
      "#36978d",
      "#15706b",
      "#0f5d59",
      "#0a4b47",
      "#063633",
    ],
    ink: [
      "#f5f4f1",
      "#e6e3da",
      "#d6d2c6",
      "#b4b0a3",
      "#8d897d",
      "#5c594f",
      "#3a382f",
      "#2a2922",
      "#1c1b18",
      "#0f0e0c",
    ],
  },
  headings: {
    fontFamily: "DMSans, system-ui, sans-serif",
    fontWeight: "700",
  },
  shadows: {
    sm: "0 1px 2px rgba(28,27,24,0.06), 0 2px 8px -3px rgba(28,27,24,0.08)",
    md: "0 8px 26px -10px rgba(28,27,24,0.2)",
    lg: "0 22px 56px -16px rgba(28,27,24,0.3)",
  },
  components: {
    Paper: Paper.extend({
      defaultProps: { radius: "md" },
      styles: {
        root: {
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--ink)",
        },
      },
    }),
    Button: Button.extend({
      defaultProps: { radius: "md" },
      styles: { root: { fontWeight: 600 } },
    }),
    Badge: Badge.extend({
      defaultProps: { radius: "sm", fw: 600 },
      styles: { root: { textTransform: "none", letterSpacing: 0 } },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { radius: "md" },
      styles: {
        root: { background: "var(--sunken)" },
        indicator: { background: "var(--surface)", boxShadow: "var(--shadow-xs)" },
        label: { fontWeight: 600, fontSize: rem(12.5) },
      },
    }),
    Modal: Modal.extend({
      defaultProps: { radius: "lg", centered: true, overlayProps: { backgroundOpacity: 0.5, blur: 3 } },
      styles: {
        title: { fontWeight: 700, fontSize: rem(16) },
        header: { borderBottom: "1px solid var(--border)", paddingBottom: rem(12), background: "var(--surface)" },
        content: { boxShadow: "var(--shadow-lg)", background: "var(--surface)" },
        body: { background: "var(--surface)" },
      },
    }),
    Tabs: Tabs.extend({
      styles: { tab: { fontWeight: 600 } },
    }),
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Component {...pageProps} />
    </MantineProvider>
  );
}
