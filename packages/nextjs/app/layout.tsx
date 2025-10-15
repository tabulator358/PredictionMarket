// ⬇️ PŘIDAT: import backgroundu (client komponenta)
import { NetworkBackground } from "../components/NetworkBackground";
import "@rainbow-me/rainbowkit/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Tabmarket",
  description: "Built with 🏗 Scaffold-ETH 2",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning>
      <body>
        {/* ⬇️ PŘIDAT: canvas background (nebude blokovat kliky) */}
        <NetworkBackground />

        {/* ⬇️ JEMNÝ WRAP: ať je UI vždy nad pozadím */}
        <div className="relative z-10 pointer-events-auto">
          <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} themes={["dark"]}>
            <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
